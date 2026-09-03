import hashlib
import os
import time
from collections import defaultdict, deque

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field


OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech"
VOICE_PROFILES = {
    "fact": {
        "voice": "coral",
        "speed": 0.93,
        "instructions": (
            "자연스러운 한국어를 사용하는 젊고 또렷한 여성 기업 면접관처럼 말하세요. "
            "꼼꼼하고 논리적이며 지원자 답변의 허점을 정확히 짚는 스타일입니다. "
            "차분하지만 날카롭고 단호하게 말하고 핵심 단어를 자연스럽게 강조하세요. "
            "무례하거나 화난 말투는 사용하지 마세요. 문장 사이에는 짧고 자연스러운 휴식을 두고, "
            "질문 마지막에는 지원자의 답변을 기다리는 듯한 억양을 사용하세요."
        ),
    },
    "manager": {
        "voice": "cedar",
        "speed": 0.88,
        "instructions": (
            "자연스러운 한국어를 사용하는 경험 많은 중년 남성 기업 면접관처럼 말하세요. "
            "따뜻하고 편안하며 지원자를 안심시키는 친절한 말투를 사용하세요. "
            "중요한 내용을 확인할 때는 목소리를 조금 더 진지하고 예리하게 바꾸세요. "
            "보통보다 약간 느린 속도로 말하고 문장 사이에 자연스러운 휴식을 두세요. "
            "질문 마지막에는 지원자의 답변을 차분히 기다리는 억양을 사용하세요."
        ),
    },
    "strict": {
        "voice": "marin",
        "speed": 0.91,
        "instructions": (
            "자연스러운 한국어를 사용하는 경력 많은 여성 관리자처럼 낮고 단호한 목소리로 말하세요. "
            "지원자의 답변을 냉정하게 검증하며 질문을 짧고 분명하게 전달하세요. "
            "감정 표현과 불필요한 친절함은 줄이되 모욕적이거나 공격적으로 들리지 않게 하세요. "
            "핵심 단어를 절제해서 강조하고 문장 사이에는 짧고 자연스러운 휴식을 두세요. "
            "질문 마지막에는 답변을 기다리는 단호한 억양을 사용하세요."
        ),
    },
}


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    interviewer: str = Field(default="fact")


app = FastAPI(title="면접콕 TTS API")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://simhanna.github.io,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

audio_cache: dict[str, bytes] = {}
request_times: dict[str, deque[float]] = defaultdict(deque)


def enforce_rate_limit(request: Request) -> None:
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    now = time.time()
    recent = request_times[client_ip]
    while recent and now - recent[0] > 3600:
        recent.popleft()
    if len(recent) >= 30:
        raise HTTPException(status_code=429, detail="시간당 음성 생성 한도를 초과했습니다.")
    recent.append(now)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": "gpt-4o-mini-tts"}


@app.post("/tts")
async def create_speech(payload: SpeechRequest, request: Request) -> Response:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    if payload.interviewer not in VOICE_PROFILES:
        raise HTTPException(status_code=400, detail="지원하지 않는 면접관입니다.")

    text = " ".join(payload.text.split())
    profile = VOICE_PROFILES[payload.interviewer]
    cache_key = hashlib.sha256(f"{payload.interviewer}:{text}".encode("utf-8")).hexdigest()
    if cache_key in audio_cache:
        return Response(audio_cache[cache_key], media_type="audio/mpeg", headers={"X-TTS-Cache": "HIT"})

    enforce_rate_limit(request)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            upstream = await client.post(
                OPENAI_SPEECH_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini-tts",
                    "voice": profile["voice"],
                    "input": text,
                    "instructions": profile["instructions"],
                    "speed": profile["speed"],
                    "response_format": "mp3",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="OpenAI 음성 서버에 연결하지 못했습니다.") from exc

    if upstream.status_code >= 400:
        try:
            message = upstream.json().get("error", {}).get("message", "OpenAI 음성 생성에 실패했습니다.")
        except ValueError:
            message = "OpenAI 음성 생성에 실패했습니다."
        raise HTTPException(status_code=upstream.status_code, detail=message)

    audio = upstream.content
    if len(audio_cache) >= 100:
        audio_cache.pop(next(iter(audio_cache)))
    audio_cache[cache_key] = audio
    return Response(audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})
