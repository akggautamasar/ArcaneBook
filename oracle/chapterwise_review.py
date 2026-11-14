#!/usr/bin/env python3
"""Conservative chapter-wise question candidate extractor for complex solved books.

Produces a private review HTML + JSON, NOT a scored mock. Original page image is
the source of truth, preserving diagrams and mathematical layout. No guess keys.
"""
import argparse
import base64
import html
import json
import re
from pathlib import Path
import pymupdf

QUESTION = re.compile(r"(?m)^\s*(\d{1,4})\s*[.,)]\s*(?:\n|\s+)")
ANSWER = re.compile(r"(?im)\bAns\s*:\s*[(]?\s*([a-d])\s*[)]?")
OPTION = re.compile(r"(?i)(?<!\\w)\\(([a-d])\\)\\s*")
# Common corrupt OCR glyphs are only evidence of an option, never a valid A-D label.
SUSPECT_OPTION = re.compile(r"(?<!\\w)\\(([0-9०-९])\\)\\s*")
ANSWER_LINE = re.compile(r"(?im)\\bAns\\s*:\\s*([^\\n]{0,45})")
CHAPTER = re.compile(r"(?i)collection of multiple.choice|questions asked in various examinations|प्रश्नों का संग्रह")


def page_columns(page):
    # Two-column PDFs have interleaved native text: extract by geometry first.
    width = page.rect.width
    regions = [pymupdf.Rect(0, 0, width / 2, page.rect.height),
               pymupdf.Rect(width / 2, 0, width, page.rect.height)]
    return [page.get_text("text", clip=r, sort=True) for r in regions]


def inspect(pdf, first, last, max_pages=30):
    doc = pymupdf.open(pdf)
    try:
        if doc.is_encrypted:
            raise ValueError("Encrypted PDF")
        if first < 1 or last < first or last > doc.page_count or last-first+1 > max_pages:
            raise ValueError("Invalid range or over 30 pages")
        pages = []
        for num in range(first, last + 1):
            page = doc[num-1]
            columns = page_columns(page)
            candidates = []
            for col_index, text in enumerate(columns):
                marks = list(QUESTION.finditer(text))
                for i, match in enumerate(marks):
                    end = marks[i+1].start() if i+1 < len(marks) else len(text)
                    fragment = text[match.end():end].strip()
                    if len(fragment) < 15:
                        continue
                    valid_options = [m.group(1).lower() for m in OPTION.finditer(fragment)]
                    suspect_options = [m.group(1) for m in SUSPECT_OPTION.finditer(fragment)]
                    option_count = len(valid_options)
                    keys = ANSWER.findall(fragment)
                    answer_lines = [m.group(1).strip() for m in ANSWER_LINE.finditer(fragment)]
                    issues = []
                    if len(valid_options) < 4:
                        issues.append("fewer_than_four_valid_option_labels")
                    if suspect_options:
                        issues.append("corrupt_or_numeric_option_labels")
                    if not keys:
                        issues.append("answer_not_verified")
                    if len(set(keys)) > 1:
                        issues.append("conflicting_answer_candidates")
                    candidates.append({
                        "number": int(match.group(1)),
                        "column": col_index+1,
                        "excerpt": fragment[:650],
                        "option_markers": option_count,
                        "valid_option_labels": valid_options,
                        "suspect_option_labels": suspect_options,
                        "answer_lines": answer_lines,
                        "review_issues": issues,
                        "answer_candidates": keys,
                        "answer_status": "review_required",
                        "confidence": "candidate_only"
                    })
            pages.append({"page": num, "candidates": candidates,
                          "question_candidates": len(candidates),
                          "has_chapter_collection_heading": bool(CHAPTER.search("\n".join(columns)))})
        return {"pdf_pages": doc.page_count, "range": [first, last],
                "mode": "chapterwise-review", "published": False, "scored": False,
                "preserve_images": True, "flag_uncertain_answers": True,
                "pages": pages, "total_candidates": sum(x["question_candidates"] for x in pages),
                "four_valid_option_candidates": sum(len(c["valid_option_labels"]) >= 4 for p in pages for c in p["candidates"]),
                "corrupt_option_candidates": sum(bool(c["suspect_option_labels"]) for p in pages for c in p["candidates"]),
                "warning": "Candidate detection only. OCR numbering, answers, diagrams and reading order require review."}
    finally:
        doc.close()


def render(pdf, result, out):
    doc = pymupdf.open(pdf)
    try:
        parts = ['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ArcaneBook Chapter Review</title><style>body{font:16px system-ui;background:#f5f7fb;color:#182235;margin:auto;max-width:1050px;padding:16px}section{background:white;padding:16px;margin:18px 0;border:1px solid #ddd;border-radius:12px}img{max-width:100%;height:auto}details{margin:8px 0;border:1px solid #ddd;padding:10px;border-radius:8px}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#a34d00}</style><h1>Chapter-wise extraction review</h1><p>Unverified candidates — not a scored mock test. Compare every item with the original page image.</p>']
        for record in result["pages"]:
            page = doc[record["page"]-1]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(1.15,1.15),alpha=False)
            encoded = base64.b64encode(pix.tobytes("jpeg",jpg_quality=68)).decode("ascii")
            parts.append(f'<section><h2>PDF page {record["page"]} — {len(record["candidates"])} candidates</h2><img loading="lazy" alt="Original PDF page with diagrams" src="data:image/jpeg;base64,{encoded}">')
            for c in record["candidates"]:
                excerpt = html.escape(c["excerpt"])
                parts.append(f'<details><summary>Candidate Q{c["number"]}, column {c["column"]} — REVIEW REQUIRED</summary><pre>{excerpt}</pre><small>Valid labels: {html.escape(str(c["valid_option_labels"]))}; suspicious labels: {html.escape(str(c["suspect_option_labels"]))}; answer candidates (unverified): {html.escape(str(c["answer_candidates"]))}; review issues: {html.escape(str(c["review_issues"]))}</small></details>')
            parts.append('</section>')
        parts.append('</html>')
        Path(out).write_text("\n".join(parts),encoding="utf-8")
    finally:
        doc.close()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",required=True)
    ap.add_argument("--first",type=int,required=True)
    ap.add_argument("--last",type=int,required=True)
    ap.add_argument("--out-dir",required=True)
    args=ap.parse_args()
    directory=Path(args.out_dir)
    if directory.exists() and any(directory.iterdir()):
        ap.error("Output directory must be empty")
    directory.mkdir(parents=True,exist_ok=True)
    result=inspect(args.pdf,args.first,args.last)
    (directory/"review.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    render(args.pdf,result,directory/"review.html")
    print(json.dumps({"candidates":result["total_candidates"],"pages":len(result["pages"]),"published":False,"scored":False}))


if __name__=="__main__":
    main()
