import asyncio
import io
import os
import subprocess
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import hf_hub_download
from scipy.signal import resample_poly

MODEL_ID = os.getenv("ASR_MODEL_ID", "Abdou/quran-asr-small")
MODEL_DIR = Path(os.getenv("ASR_MODEL_DIR", "/data/models/quran-asr-small"))
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(4 * 1024 * 1024)))
MAX_AUDIO_SECONDS = float(os.getenv("MAX_AUDIO_SECONDS", "12"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))

recognizer = None
rate_lock = threading.Lock()
request_times = defaultdict(deque)


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


def enforce_rate_limit(key: str) -> None:
    now = time.monotonic()
    with rate_lock:
        bucket = request_times[key]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= RATE_LIMIT_PER_MINUTE:
            raise HTTPException(status_code=429, detail="طلبات كثيرة في وقت قصير. انتظر دقيقة ثم حاول مجددًا.")
        bucket.append(now)


def load_recognizer():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = hf_hub_download(repo_id=MODEL_ID, filename="model.int8.onnx", local_dir=str(MODEL_DIR))
    tokens_path = hf_hub_download(repo_id=MODEL_ID, filename="tokens.txt", local_dir=str(MODEL_DIR))
    return sherpa_onnx.OfflineRecognizer.from_zipformer_ctc(
        model=model_path,
        tokens=tokens_path,
        num_threads=max(1, min(4, os.cpu_count() or 1)),
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
        provider="cpu",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global recognizer
    recognizer = await asyncio.to_thread(load_recognizer)
    yield
    recognizer = None


app = FastAPI(
    title="Tajweed Quran Recitation ASR",
    version="0.1.0",
    description="Open-source Quran recitation transcription using sherpa-onnx.",
    lifespan=lifespan,
)

origins = [item.strip() for item in os.getenv(
    "ALLOWED_ORIGINS",
    "https://8kaneki8.github.io,http://localhost:5500,http://127.0.0.1:5500",
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/")
def root():
    return {"service": "Tajweed Quran ASR", "model": MODEL_ID, "status": "ready" if recognizer else "loading"}


@app.get("/v1/health")
def health():
    return {"ok": True, "model_loaded": recognizer is not None, "model": MODEL_ID}


def decode_audio(raw: bytes) -> np.ndarray:
    # Browser MediaRecorder formats (WebM/Opus, MP4/AAC) are decoded by FFmpeg.
    decoded = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
         "-f", "wav", "-ac", "1", "-ar", "16000", "pipe:1"],
        input=raw,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
        timeout=25,
    ).stdout
    samples, sample_rate = sf.read(io.BytesIO(decoded), dtype="float32", always_2d=True)
    if samples.size == 0:
        raise ValueError("لم يتم العثور على صوت داخل التسجيل.")
    mono = samples.mean(axis=1)
    if sample_rate != 16000:
        # FFmpeg already requests 16 kHz; keep this guard for unusual decoder output.
        from math import gcd
        divisor = gcd(int(sample_rate), 16000)
        mono = resample_poly(mono, 16000 // divisor, int(sample_rate) // divisor).astype(np.float32)
    if not np.isfinite(mono).all():
        raise ValueError("التسجيل الصوتي غير صالح.")
    duration = len(mono) / 16000
    if duration > MAX_AUDIO_SECONDS:
        raise ValueError(f"المقطع أطول من المسموح ({MAX_AUDIO_SECONDS:g} ثانية).")
    if duration < 0.35:
        raise ValueError("المقطع قصير جدًا. اقرأ قليلًا ثم حاول مرة أخرى.")
    return np.ascontiguousarray(np.clip(mono, -1.0, 1.0), dtype=np.float32)


def run_recognition(samples: np.ndarray) -> str:
    stream = recognizer.create_stream()
    stream.accept_waveform(16000, samples)
    recognizer.decode_stream(stream)
    return str(stream.result.text or "").strip()


@app.post("/v1/transcribe")
async def transcribe(request: Request, audio: UploadFile = File(...)):
    if recognizer is None:
        raise HTTPException(status_code=503, detail="محرك التعرف ما زال يبدأ التشغيل. حاول بعد قليل.")
    enforce_rate_limit(client_key(request))
    raw = await audio.read(MAX_AUDIO_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="لم يصل تسجيل صوتي.")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="حجم التسجيل أكبر من الحد المسموح.")
    try:
        samples = await asyncio.to_thread(decode_audio, raw)
        transcript = await asyncio.to_thread(run_recognition, samples)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=422, detail="استغرق فك التسجيل وقتًا أطول من اللازم.")
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=415, detail="صيغة التسجيل الصوتي غير مدعومة.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="حدث خطأ أثناء التعرف على التلاوة.")
    return {
        "text": transcript,
        "duration_seconds": round(len(samples) / 16000, 2),
        "sample_rate": 16000,
        "model": MODEL_ID,
    }
