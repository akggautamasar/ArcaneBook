#!/usr/bin/env python3
"""Stage the smart-analysis FastAPI endpoint without changing existing routes.
Dry-run by default; --apply writes a timestamped backup. Does not restart.
"""
import argparse
import ast
from datetime import datetime
from pathlib import Path
import shutil

BLOCK = '''
# SMART_PDF_ANALYSIS_V1: isolated, read-only upload inspection.
from fastapi import UploadFile as SmartUploadFile, File as SmartFile, HTTPException as SmartHTTPException
from pathlib import Path as SmartPath
import importlib.util as smart_importlib
import tempfile as smart_tempfile

@app.post("/api/analyze")
async def smart_analyze_pdf(file: SmartUploadFile = SmartFile(...)):
    root = SmartPath("/opt/arcane-pdf2mock")
    analyzer = root / "smart_pdf_analyzer.py"
    if not analyzer.is_file():
        raise SmartHTTPException(503, "Smart PDF analyzer not installed")
    temporary = None
    received = 0
    try:
        with smart_tempfile.NamedTemporaryFile(prefix="smart-", suffix=".pdf",
                    dir=str(root / "jobs" / "tmp"), delete=False) as out:
            temporary = SmartPath(out.name)
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                received += len(chunk)
                if received > 100 * 1024 * 1024:
                    raise SmartHTTPException(413, "Smart analysis PDF limit is 100 MiB")
                out.write(chunk)
        if received < 5:
            raise SmartHTTPException(400, "PDF is empty")
        spec = smart_importlib.spec_from_file_location("smart_pdf_analyzer", analyzer)
        module = smart_importlib.module_from_spec(spec)
        spec.loader.exec_module(module)
        try:
            # Bounded synchronous analysis; does not create a conversion job.
            import asyncio
            return await asyncio.to_thread(module.inspect, temporary, True, True)
        except (ValueError, RuntimeError) as exc:
            raise SmartHTTPException(422, str(exc)) from exc
        except Exception as exc:
            raise SmartHTTPException(422, "PDF inspection failed") from exc
    finally:
        await file.close()
        if temporary:
            temporary.unlink(missing_ok=True)
'''

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default="/opt/arcane-pdf2mock/server.py")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    path = Path(args.server)
    source = path.read_text(encoding="utf-8")
    if "SMART_PDF_ANALYSIS_V1" in source:
        print("Already staged; no changes")
        return
    if '@app.post("/api/jobs")' not in source and "@app.post('/api/jobs')" not in source:
        raise SystemExit("Existing job route not recognized; refusing to patch")
    updated = source.rstrip() + "\n\n" + BLOCK + "\n"
    ast.parse(updated, filename=str(path))
    print("Validated: existing API preserved; smart analysis endpoint appended")
    if args.apply:
        backup = path.with_name(path.name + ".pre-smart-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
        shutil.copy2(path, backup)
        path.write_text(updated, encoding="utf-8")
        print("STAGED:", path, "BACKUP:", backup, "NO RESTART")

if __name__ == "__main__":
    main()
