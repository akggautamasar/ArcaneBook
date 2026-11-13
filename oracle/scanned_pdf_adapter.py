#!/usr/bin/env python3
"""Conservative Oracle adapter for the validated DDA-style 120-question OCR workflow.

This is NOT a universal scanned-PDF parser. Run as a worker, never directly
from a public HTTP request. Output remains private until an operator reviews it.
Requires scanned_pdf_engine_v4.py and build_dda_interactive.py installed on VM.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path("/opt/arcane-pdf2mock")
ENGINE = ROOT / "scanned_pdf_engine_v4.py"
BUILDER = ROOT / "build_dda_interactive.py"
PYTHON = ROOT / ".venv/bin/python"

def run(command, timeout):
    subprocess.run(command, check=True, timeout=timeout)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    pdf = Path(args.pdf).resolve(strict=True)
    cfg_file = Path(args.config).resolve(strict=True)
    output = Path(args.output_dir).resolve()
    if not pdf.is_file() or pdf.suffix.lower() != ".pdf":
        parser.error("A PDF file is required")
    if pdf.stat().st_size > 100 * 1024 * 1024:
        parser.error("PDF exceeds 100 MiB safety limit")
    cfg = json.loads(cfg_file.read_text(encoding="utf-8"))
    papers = cfg.get("papers")
    if not isinstance(papers, list) or len(papers) != 1:
        parser.error("Only one DDA-style practice set is supported per job")
    pages = papers[0].get("pages")
    if not isinstance(pages, list) or len(pages) != 2 or not all(type(x) is int for x in pages):
        parser.error("Expected one [first_page, last_page] range")
    if pages[0] < 1 or pages[1] < pages[0] or pages[1] - pages[0] > 30:
        parser.error("Invalid or oversized question-page range")
    if cfg.get("page_offset", 0) != 0:
        parser.error("Page offsets are not yet supported in the adapter")
    if not all(p.is_file() for p in (ENGINE, BUILDER, PYTHON)):
        parser.error("V4 engine, interactive builder or Python venv is missing")
    if output.exists() and any(output.iterdir()):
        parser.error("Output directory must be empty to avoid overwriting jobs")
    output.mkdir(parents=True, exist_ok=True)
    # No public path is touched; keep output private until reviewed.
    os.chmod(output, 0o700)
    preview = output / "review.html"
    audit = output / "audit.json"
    candidate = output / "interactive-provisional.html"
    result = output / "status.json"
    try:
        run([str(PYTHON), str(ENGINE), "--pdf", str(pdf), "--config", str(cfg_file),
             "--out", str(preview), "--audit", str(audit), "--first-only"], timeout=1800)
        records = json.loads(audit.read_text(encoding="utf-8"))
        if len(records) != 1:
            raise ValueError("Expected exactly one paper in OCR audit")
        record = records[0]
        missing = record.get("missingQuestions", [])
        placeholders = record.get("placeholders", 999)
        conflicts = record.get("answerConflicts", {})
        if record.get("questions") != 120 or placeholders != 0 or missing or conflicts:
            raise ValueError("OCR audit failed: missing/ambiguous question boundaries or answer conflicts")
        # Existing builder intentionally excludes unverified answers from scoring.
        run([str(PYTHON), str(BUILDER), "--preview", str(preview),
             "--audit", str(audit), "--out", str(candidate)], timeout=120)
        state = {"status": "review_required", "questions": 120,
                 "unverified_answers": record.get("unverifiedAnswers", []),
                 "preview": str(preview), "candidate": str(candidate),
                 "scoring": "provisional_ocr_key",
                 "published": False}
    except Exception as exc:
        state = {"status": "failed_review_required", "error": str(exc), "published": False}
        result.write_text(json.dumps(state, indent=2), encoding="utf-8")
        raise
    result.write_text(json.dumps(state, indent=2), encoding="utf-8")
    print(json.dumps(state, indent=2))

if __name__ == "__main__":
    main()
