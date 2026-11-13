# Scanned PDF conversion adapter (staging)

This adapter is **not enabled in production**. It runs the DDA-specific V4 engine
on a single paper, checks the audit, and builds a private provisional mock-test
HTML. It does not alter `pdf2mock.py`, `oracle-api.js`, Caddy, or existing jobs.

## Requirements

- Oracle venv: `/opt/arcane-pdf2mock/.venv/bin/python`
- Existing tested `/opt/arcane-pdf2mock/scanned_pdf_engine_v4.py`
- Copy the previously tested `build_dda_interactive.py` into
  `/opt/arcane-pdf2mock/build_dda_interactive.py`
- Tesseract, PyMuPDF, Pillow already configured

## Private smoke test (after copying adapter to Oracle)

```bash
ROOT=/opt/arcane-pdf2mock
JOB=$ROOT/jobs/eea79050781a
sudo mkdir -p "$JOB/adapter-smoke"
sudo "$ROOT/.venv/bin/python" "$ROOT/scanned_pdf_adapter.py" \
  --pdf "$JOB/book.pdf" \
  --config "$JOB/config-single-set.json" \
  --output-dir "$JOB/adapter-smoke"
```

Create `config-single-set.json` from the existing DDA config with only
Practice Set 1, preserving its page range. This is intentional: the adapter
rejects multi-paper jobs. It also rejects answer conflicts, missing question
boundaries and oversized files. A successful run produces
`status.json` with `review_required` and `published: false`.

## Integration to do after inspecting the live API

1. Inspect `/home/ubuntu/arcanebook/server/oracle-api.js` job handling,
   worker spawning, authentication and download routes.
2. Add a separate opt-in `scanned-dda` mode behind the same admin gate.
3. Run the adapter in an isolated worker with resource and upload limits.
4. Keep the result private until reviewed; never mark OCR-derived scoring as
   verified. Question 51 in the sample DDA paper is unverified.
5. Test a text-based SSC JE PDF regression and scanned DDA smoke test.
6. Only then expose a reviewed interactive HTML download in the existing UI.

Do **not** automatically choose V4 for arbitrary PDFs. The engine assumes
120 numbered questions, a two-column layout, and the answer table on the
page after the question range. Its Q24 recovery is specific to the tested DDA
paper. A general engine needs layout detection and answer-key mapping first.
