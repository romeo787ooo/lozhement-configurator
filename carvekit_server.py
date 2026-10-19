"""Small local CarveKit service used by the contour editor.

Run with: uvicorn carvekit_server:app --host 127.0.0.1 --port 7000
"""
import io
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image

app = FastAPI(title="Lozhement CarveKit matting")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_interface = None


def get_interface():
    global _interface
    if _interface is None:
        import torch
        from carvekit.api.high import HiInterface

        _interface = HiInterface(
            object_type="object",
            batch_size_seg=1,
            batch_size_matting=1,
            device="cuda" if torch.cuda.is_available() else "cpu",
            seg_mask_size=640,
            matting_mask_size=2048,
            trimap_prob_threshold=210,
            trimap_dilation=30,
            trimap_erosion_iters=0,
            fp16=False,
        )
    return _interface


@app.get("/health")
def health():
    return {"ok": True, "service": "carvekit"}


@app.post("/matting")
async def matting(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Ожидается файл изображения")
    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
        result = get_interface()([image])[0].convert("RGBA")
        out = io.BytesIO()
        result.save(out, format="PNG")
        out.seek(0)
        return StreamingResponse(out, media_type="image/png")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
