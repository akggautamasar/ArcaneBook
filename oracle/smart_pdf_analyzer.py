#!/usr/bin/env python3
"""Read-only, bounded PDF classifier. Does not convert, publish, or modify jobs."""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

import pymupdf

LABELS = {
    "papers": r"previous\s*year|previous\s*paper|solved\s*paper|ssc\s*je|rrb\s*je|exam\s*(?:held|date)|विगत\s*वर्ष|पिछले\s*वर्ष",
    "sets": r"practice\s*set|model\s*paper|mock\s*test|sample\s*paper|अभ्यास\s*सेट|प्रैक्टिस\s*सेट",
    "chapters": r"chapter\s*\d+|unit\s*\d+|topic\s*[- ]?wise|chapter\s*[- ]?wise|अध्याय\s*\d+|अध्यायवार|अध्याय\s*वार|विषयवार",
}
QUESTION = re.compile(r"(?m)^\s*(?:Q(?:uestion)?\.?\s*)?\d{1,4}\s*[.)]\s+")
OPTIONS = re.compile(r"(?im)(?:^|\s)[(]?[a-dA-D][).]\s+")
ANSWERS = re.compile(r"(?i)answer\s*key|correct\s*answer|\bans(?:wer)?\s*[:.]|उत्तर\s*माला|उत्तरमाला")
CONTENTS = re.compile(r"(?i)table\s+of\s+contents|contents|index|विषय\s*सूची|अनुक्रमणिका")


def samples(count):
    first = list(range(min(10, count)))
    if count <= 10:
        return first
    extra = [int((count - 1) * k / 8) for k in range(1, 9)]
    return sorted(set(first + extra + [count - 1]))[:20]


def ocr_page(page):
    if not shutil.which("tesseract"):
        return "", "tesseract_unavailable"
    try:
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        proc = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "eng+hin", "--psm", "3"],
            input=pix.tobytes("png"), capture_output=True, timeout=25, check=False
        )
        if proc.returncode:
            return "", "ocr_failed"
        return proc.stdout.decode("utf-8", "replace")[:15000], "ok"
    except subprocess.TimeoutExpired:
        return "", "ocr_timeout"


def inspect(pdf_path, preserve_images=True, flag_uncertain=True):
    pdf_path = Path(pdf_path).resolve(strict=True)
    if pdf_path.stat().st_size > 500 * 1024 * 1024:
        raise ValueError("Analysis limit: 500 MiB")
    doc = pymupdf.open(pdf_path)
    try:
        if doc.is_encrypted:
            raise ValueError("Encrypted PDF is not supported")
        if not doc.page_count:
            raise ValueError("Empty PDF")
        total = doc.page_count
        chosen = samples(total)
        records = []
        evidence = {key: [] for key in LABELS}
        counts = {key: 0 for key in LABELS}
        all_text = []
        scanned = 0
        image_overlay = 0
        question_pages = []
        answer_pages = []
        index_pages = []
        for idx in chosen:
            page = doc.load_page(idx)
            native = page.get_text("text")[:15000]
            image_count = len(page.get_images(full=False))
            # Large raster covering a page indicates image-backed OCR even with selectable text.
            image_info = page.get_image_info()
            if len(native.strip()) >= 120 and any((pymupdf.Rect(img["bbox"]).get_area() / max(page.rect.get_area(),1)) > .65 for img in image_info):
                image_overlay += 1
            # OCR only image-heavy / text-poor sampled pages; no external service.
            needs_ocr = len(native.strip()) < 120
            text, ocr_state = (ocr_page(page) if needs_ocr else ("", "not_needed"))
            if needs_ocr:
                scanned += 1
            combined = (native + "\n" + text)[:20000]
            all_text.append(combined)
            for label, pattern in LABELS.items():
                matches = list(re.finditer(pattern, combined, re.I))
                if matches:
                    counts[label] += min(len(matches), 3)
                    if len(evidence[label]) < 4:
                        evidence[label].append({"page": idx + 1, "match": matches[0].group(0)[:70]})
            q = len(QUESTION.findall(combined))
            opt = len(OPTIONS.findall(combined))
            if q >= 2 or opt >= 6:
                question_pages.append(idx + 1)
            if ANSWERS.search(combined):
                answer_pages.append(idx + 1)
            if CONTENTS.search(combined):
                index_pages.append(idx + 1)
            records.append({
                "page": idx + 1, "native_characters": len(native.strip()),
                "ocr_characters": len(text.strip()), "ocr_status": ocr_state,
                "images": image_count, "questions_detected": q, "option_markers": opt
            })
        scanned_fraction = scanned / len(chosen)
        pdf_kind = "scanned" if scanned_fraction >= .75 else ("hybrid" if scanned_fraction >= .2 or image_overlay >= len(chosen)*.3 else "text")
        best = max(counts, key=counts.get)
        if counts[best] == 0:
            best = "unknown"
        elif counts[best] == counts.get("sets") and best != "sets" and counts["sets"] > 0:
            best = "sets"
        # A book title/TOC is stronger evidence than individual exam credits within questions.
        opening = "\n".join(doc.load_page(i).get_text("text")[:9000] for i in range(min(total, 10)))
        chapter_title = re.search(r"chapter\s*[- ]?wise|topic\s*[- ]?wise|अध्यायवार|अध्याय\s*वार", opening, re.I)
        if chapter_title:
            best = "chapters"
        confidence = "high" if chapter_title else ("low" if best == "unknown" or counts.get(best, 0) < 2 else ("medium" if counts[best] < 5 else "high"))
        # Image-first retains source PDF pixels; uncertain candidates remain unscored.
        # The legacy DDA-specific OCR converter remains manually selectable.
        strategy = "universal"
        warnings = []
        if pdf_kind == "hybrid":
            warnings.append("Image-backed OCR: original page image crops are safer than reconstructed text.")
        if pdf_kind == "scanned":
            warnings.append("Scanned pages without reliable question boundaries become unscored page-review cards.")
        if best == "unknown":
            warnings.append("Document grouping uncertain; universal mode can still preserve source page images.")
        if not answer_pages:
            warnings.append("No answer key in samples; unverified questions will not be scored.")
        if any(x["ocr_status"] not in ("ok", "not_needed") for x in records):
            warnings.append("OCR was unavailable or failed on some sampled pages.")
        return {
            "version": 2, "pages": total, "sampled_pages": [i + 1 for i in chosen],
            "initial_pages": list(range(1, min(total, 10) + 1)),
            "pdf_type": pdf_kind, "classification": best, "confidence": confidence,
            "recommended_strategy": strategy,
            "supported_automatic_conversion": True, "image_first_supported": True,
            "evidence": evidence, "question_pages_sampled": question_pages,
            "answer_pages_sampled": answer_pages, "contents_pages_sampled": index_pages,
            "sample_details": records, "preserve_images": bool(preserve_images),
            "flag_uncertain_answers": bool(flag_uncertain), "warnings": warnings,
            "review_required": True
        }
    finally:
        doc.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out")
    args = ap.parse_args()
    result = inspect(args.pdf)
    data = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(data, encoding="utf-8")
    else:
        print(data)
