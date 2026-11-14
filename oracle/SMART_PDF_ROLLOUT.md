# Smart PDF-to-Mock — staged integration

Branch: `feature/smart-pdf-to-mock`. This is **not** a universal converter and is not deployed by committing this branch.

## Implemented

- Read-only classification: first 10 pages plus representative pages throughout PDF.
- Native text inspection, OCR on text-poor sample pages if Tesseract is installed.
- Detects paper, practice-set and chapter evidence; question/answer-page hints.
- Reports uncertainty and refuses to recommend unsupported scanned/hybrid conversions.
- Admin-only `POST /api/analyze` proxy (normal multipart and existing chunk uploader).
- Frontend Smart Analyze action and report; existing conversion modes preserved.
- An isolated FastAPI endpoint installer with syntax validation and backup.

## Not implemented yet

- Reliable automatic section boundaries across arbitrary PDFs.
- Universal scanned/hybrid conversion, diagrams in arbitrary layouts, math OCR.
- Answer verification against the source for every question.
- Automatic scored HTML publication for scanned/hybrid PDFs.
- Durable analysis job queue, full-document classification, worker limits.

The existing text-PDF and DDA OCR converters remain independent. No existing jobs or Telegram data are changed.

## Oracle staged installation (requires human review)

1. Build frontend from branch in a **separate** checkout.
2. Copy `oracle/smart_pdf_analyzer.py` to `/opt/arcane-pdf2mock/smart_pdf_analyzer.py`.
3. Run `oracle/install_smart_analyzer.py` with `--server /opt/arcane-pdf2mock/server.py` (dry run), then `--apply`.
4. Verify `python -m py_compile` and `import pymupdf` using the converter venv.
5. Restart `arcane-pdf2mock` only when no jobs are running. Check `/healthz` and `/openapi.json`; restore timestamped backup if unhealthy.
6. Update the **running Node API source** with the reviewed `server/oracle-api.js` changes, restart `arcanebook-api`, verify health.
7. Test admin analysis with a small PDF, and confirm unauthenticated analysis is rejected. Confirm existing text and scanned DDA conversion still work.
8. Deploy built `dist/` into webroot only after backend tests pass. Preserve standalone HTML assets and backup the webroot.

Do not deploy the frontend first: it would expose a Smart Analyze button before the API exists.

## Security

- Node blocks non-admin access to `/api/analyze`, including chunk finish.
- FastAPI retains the existing API-key middleware.
- Upload analysis is capped at 100 MiB and sampled OCR is time-limited per page.
- Temporary uploaded PDF is deleted on success or error.
- This is a synchronous analysis request; large OCR samples can still consume CPU. A bounded job queue should be added before broad rollout.
