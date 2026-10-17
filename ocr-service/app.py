import io
import os
import re
import fitz
import pytesseract
from PIL import Image, ImageOps
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ArcaneBook OCR", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["https://arcanebook.vercel.app", "http://localhost:8080", "http://localhost:5173"], allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])
MAX_FILE_BYTES = 22 * 1024 * 1024
MAX_PAGES = 10

def read_pages(spec: str, total: int):
    found = set()
    for item in spec.split(","):
        item = item.strip()
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", item)
        if not match:
            raise HTTPException(400, "Invalid page selection; use 1,3,5-7")
        first, last = int(match[1]), int(match[2] or match[1])
        if first < 1 or last > total or first > last or last-first > MAX_PAGES:
            raise HTTPException(400, f"Pages must be within 1-{total}")
        found.update(range(first, last+1))
        if len(found) > MAX_PAGES:
            raise HTTPException(400, "Maximum 10 pages per request")
    return sorted(found)

def ocr_image(img: Image.Image, columns: str):
    img = ImageOps.exif_transpose(img).convert("RGB")
    if img.width > 2300:
        img.thumbnail((2300, 3500))
    if columns == "two" or (columns == "auto" and img.width > 950 and img.width / img.height > 0.72):
        middle = img.width // 2
        parts = [img.crop((0, 0, middle, img.height)), img.crop((middle, 0, img.width, img.height))]
    else:
        parts = [img]
    return "\n".join(pytesseract.image_to_string(part, lang="hin+eng", config="--psm 6", timeout=75) for part in parts)

@app.get("/health")
def health():
    return {"ok": True, "engine": "tesseract", "languages": ["hin", "eng"]}

@app.post("/extract")
async def extract(file: UploadFile = File(...), pages: str = Form("1"), columns: str = Form("auto")):
    if columns not in ("auto", "one", "two"):
        raise HTTPException(400, "Invalid columns setting")
    data = await file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(413, "Maximum upload size is 22 MB")
    if not data:
        raise HTTPException(400, "Empty file")
    result = []
    try:
        if data.startswith(b"%PDF"):
            with fitz.open(stream=data, filetype="pdf") as doc:
                selected = read_pages(pages, len(doc))
                for number in selected:
                    page = doc[number-1]
                    native = page.get_text(sort=True).strip()
                    if len(native) > 120:
                        text = native
                        method = "embedded-text"
                    else:
                        pix = page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False)
                        image = Image.open(io.BytesIO(pix.tobytes("png")))
                        text = ocr_image(image, columns)
                        method = "ocr"
                    result.append({"page": number, "text": text, "method": method})
        else:
            with Image.open(io.BytesIO(data)) as image:
                result.append({"page": 1, "text": ocr_image(image, columns), "method": "ocr"})
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Could not process file: {type(exc).__name__}")
    return {"pages": result, "text": "\n".join(item["text"] for item in result), "count": len(result)}
