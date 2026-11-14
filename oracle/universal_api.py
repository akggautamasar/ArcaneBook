"""Isolated, authenticated universal PDF image mock API.

Keeps all legacy conversion routes untouched. Each generated job has separate
image assets, an HTML browser viewer and an offline ZIP.
"""
from __future__ import annotations
import asyncio
import hmac
import json
import os
import re
import secrets
import shutil
import sys
import zipfile
from pathlib import Path
from fastapi import BackgroundTasks, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

BASE = Path(__file__).resolve().parent
JOBS = BASE / "jobs"
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))
from universal_image_engine import build, write_status


def auth(value):
    secret = os.getenv("PDF2MOCK_API_KEY", "")
    if not secret or not value or not hmac.compare_digest(secret, value):
        raise HTTPException(status_code=403, detail="Converter authorization required")


def jobfolder(jobid):
    if not re.fullmatch(r"[a-f0-9]{16}", jobid):
        raise HTTPException(status_code=404, detail="Job not found")
    folder = JOBS / ("universal_" + jobid)
    if not folder.is_dir():
        raise HTTPException(status_code=404, detail="Job not found")
    return folder


def status(jobid):
    p = jobfolder(jobid) / "status.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Status not found")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        raise HTTPException(status_code=503, detail="Status unavailable")


def finished(jobid):
    folder = jobfolder(jobid)
    if status(jobid).get("status") != "done":
        raise HTTPException(status_code=409, detail="Job is not complete")
    return folder


def worker(folder, config):
    def step(done, total, cards):
        write_status(folder, status="running", phase="Cropping original question, option and solution images",
                     progress=round(done / total * 100), pages_processed=done,
                     question_cards=cards)
    try:
        write_status(folder, status="running", progress=0, phase="Inspecting PDF")
        manifest = build(folder / "upload.pdf", folder, config["start_page"],
                         config["end_page"], config["title"], step)
        quality = manifest["quality"]
        write_status(folder, status="done", phase="Complete — review uncertain cards before publishing",
                     progress=100, quality=quality, question_count=quality["questions"],
                     review_required=bool(quality["unscored"]), format="image-first",
                     classification=manifest["classification"], download_type="zip",
                     message=f"{quality['questions']} question cards; {quality['unscored']} need review")
        # Only remove this job's temporary uploaded copy after a successful build.
        (folder / "upload.pdf").unlink(missing_ok=True)
    except Exception as exc:
        write_status(folder, status="error", phase="Conversion failed", error=str(exc)[:500])


def make_zip(folder):
    target = folder / "offline-mock.zip"
    if target.is_file():
        return target
    temporary = folder / "offline-mock.zip.tmp"
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as z:
            for name in ("index.html", "manifest.json"):
                z.write(folder / name, name)
            for item in sorted((folder / "assets").glob("*.jpg")):
                z.write(item, "assets/" + item.name)
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return target


def register_universal_routes(app):
    @app.post("/api/universal/jobs")
    async def create_image_job(background_tasks: BackgroundTasks, file: UploadFile = File(...),
                               config: str = Form("{}"),
                               x_api_key: str | None = Header(default=None, alias="x-api-key")):
        auth(x_api_key)
        try:
            cfg = json.loads(config)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid configuration JSON")
        if not isinstance(cfg, dict):
            raise HTTPException(status_code=400, detail="Invalid configuration")
        try:
            first = int(cfg.get("start_page", 1))
            last = int(cfg.get("end_page", 0))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid page range")
        if not 1 <= first <= last <= 10000 or last - first + 1 > 600:
            raise HTTPException(status_code=400, detail="Select 1–600 PDF pages")
        title = str(cfg.get("title", "ArcaneBook Image Mock"))[:160].strip() or "ArcaneBook Image Mock"
        JOBS.mkdir(parents=True, exist_ok=True)
        if shutil.disk_usage(JOBS).free < 800 * 1024 * 1024:
            raise HTTPException(status_code=507, detail="Insufficient converter disk space")
        jobid = secrets.token_hex(8)
        folder = JOBS / ("universal_" + jobid)
        folder.mkdir(mode=0o700)
        received = 0
        try:
            with (folder / "upload.pdf").open("xb") as dest:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    received += len(chunk)
                    if received > 500 * 1024 * 1024:
                        raise HTTPException(status_code=413, detail="Maximum PDF size is 500 MiB")
                    dest.write(chunk)
            with (folder / "upload.pdf").open("rb") as check:
                header = check.read(5)
            if received < 6 or header != b"%PDF-":
                raise HTTPException(status_code=400, detail="Uploaded file is not a PDF")
            import pymupdf
            try:
                with pymupdf.open(folder / "upload.pdf") as doc:
                    if doc.needs_pass or last > doc.page_count:
                        raise HTTPException(status_code=422, detail="Encrypted PDF or page range exceeds document")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=422, detail="PDF cannot be opened")
            write_status(folder, id=jobid, status="queued", progress=0,
                         phase="Queued for image extraction", received_bytes=received)
            background_tasks.add_task(worker, folder, {
                "start_page": first, "end_page": last, "title": title
            })
            return {"id": jobid, "job_id": jobid, "status": "queued"}
        except Exception:
            shutil.rmtree(folder, ignore_errors=True)
            raise
        finally:
            await file.close()

    @app.get("/api/universal/jobs/{jobid}")
    async def get_image_status(jobid: str, x_api_key: str | None = Header(default=None, alias="x-api-key")):
        auth(x_api_key)
        return JSONResponse(status(jobid), headers={"Cache-Control": "no-store"})

    @app.get("/api/universal/jobs/{jobid}/html")
    async def open_image_mock(jobid: str, x_api_key: str | None = Header(default=None, alias="x-api-key")):
        auth(x_api_key)
        return FileResponse(finished(jobid) / "index.html", media_type="text/html",
                            headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})

    @app.get("/api/universal/jobs/{jobid}/assets/{asset_name}")
    async def get_image_asset(jobid: str, asset_name: str,
                              x_api_key: str | None = Header(default=None, alias="x-api-key")):
        auth(x_api_key)
        if not re.fullmatch(r"[A-Za-z0-9_-]+\.jpg", asset_name):
            raise HTTPException(status_code=404, detail="Image not found")
        image = finished(jobid) / "assets" / asset_name
        if not image.is_file():
            raise HTTPException(status_code=404, detail="Image not found")
        return FileResponse(image, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=600"})

    @app.get("/api/universal/jobs/{jobid}/zip")
    async def download_offline_mock(jobid: str, x_api_key: str | None = Header(default=None, alias="x-api-key")):
        auth(x_api_key)
        archive = await asyncio.to_thread(make_zip, finished(jobid))
        return FileResponse(archive, media_type="application/zip",
                            filename="ArcaneBook-image-mock.zip",
                            headers={"Cache-Control": "private, no-store"})
