#!/usr/bin/env python3
"""Regression tests for image-first conversion. Uses synthetic PDFs only."""
import tempfile
import unittest
import sys
from pathlib import Path
import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from universal_image_engine import build, analyze


class ImageMockTests(unittest.TestCase):
    def test_text_question_and_original_solution_images(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            pdf = root / "source.pdf"
            doc = pymupdf.open()
            page = doc.new_page(width=595, height=842)
            for y, line in [
                (100, "1. What is the value?"),
                (130, "(a) one"), (155, "(b) two"),
                (180, "(c) three"), (205, "(d) four"),
                (240, "Ans: (b) Two is correct."),
                (400, "2. Which option?"),
                (440, "(a) red"), (465, "(b) blue"),
                (490, "(c) green"), (515, "(d) black"),
                (550, "Ans: (c) Green is correct.")
            ]:
                page.insert_text((57, y), line, fontsize=12)
            doc.save(pdf)
            doc.close()
            report = analyze(pdf)
            self.assertEqual(report["pages"], 1)
            result = build(pdf, root / "out", 1, 1, "Synthetic Question Test")
            self.assertEqual(result["quality"]["questions"], 2)
            self.assertEqual(result["quality"]["scored"], 2)
            self.assertEqual([q["answer"] for q in result["items"]], ["b", "c"])
            for q in result["items"]:
                for name in ("question_image", "options_image", "solution_image"):
                    self.assertTrue((root / "out" / q[name]).is_file())

    def test_image_only_page_falls_back_without_fake_answer(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            pdf = root / "scanned.pdf"
            doc = pymupdf.open()
            page = doc.new_page(width=595, height=842)
            page.draw_rect(pymupdf.Rect(50, 100, 500, 700),
                           color=(0, 0, 0), fill=(.95, .95, .95))
            doc.save(pdf)
            doc.close()
            result = build(pdf, root / "out")
            self.assertEqual(result["quality"]["review_pages"], 1)
            self.assertEqual(result["quality"]["scored"], 0)
            self.assertEqual(result["items"][0]["kind"], "page-review")


if __name__ == "__main__":
    unittest.main()
