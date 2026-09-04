import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 10000);
const model = "gpt-4o-mini-tts";
const maxTextLength = 1200;
const maxRequestsPerHour = 30;
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  || "https://simhanna.github.io,https://myeonjeopkok.onrender.com,http://localhost:8000,http://127.0.0.1:8000")
  .split(",")
  .map(origin => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const interviewerProfiles = {
  factWoman: {
    voice: "marin",
    speed: 1.06,
    instructions: [
      "Speak in natural Korean as a young female corporate recruiter.",
      "Use a clear, calm, attentive voice at a slightly brisk pace.",
      "Sound like a real interviewer who checks facts carefully, not like an announcer.",
      "Use short natural pauses and end questions with an intonation that invites an answer."
    ].join(" ")
  },
  kindMan: {
    voice: "cedar",
    speed: 0.9,
    instructions: [
      "Speak in natural Korean as an experienced male interviewer with a warm mid-to-low voice.",
      "Be kind, comfortable, and reassuring so the applicant does not feel intimidated.",
      "Speak slightly slowly with natural pauses while still sounding professionally attentive.",
      "End questions gently as if patiently waiting for the applicant's answer."
    ].join(" ")
  },
  strictWoman: {
    voice: "marin",
    speed: 1.02,
    instructions: [
      "Speak in natural Korean as an experienced female manager conducting a pressure interview.",
      "Use a firm, cool, incisive voice, but never sound angry, insulting, or theatrical.",
      "Keep questions precise and emphasize weak claims with restrained sharpness.",
      "Use brief pauses and end with a decisive intonation that expects a concrete answer."
    ].join(" ")
  }
};

const requestLog = new Map();
const audioCache = new Map();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(cors({
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      callback(null, true);
      return;
    }
    callback(new Error("허용되지 않은 출처입니다."));
  }
}));

function enforceRateLimit(request, response, next) {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const key = request.ip || "unknown";
  const recent = (requestLog.get(key) || []).filter(timestamp => timestamp > cutoff);

  if (recent.length >= maxRequestsPerHour) {
    response.status(429).json({ error: "시간당 음성 생성 한도를 초과했습니다." });
    return;
  }

  recent.push(now);
  requestLog.set(key, recent);
  next();
}

function cacheAudio(key, audio) {
  if (audioCache.size >= 100) {
    audioCache.delete(audioCache.keys().next().value);
  }
  audioCache.set(key, audio);
}

app.get("/", (_request, response) => {
  response.json({ service: "면접콕 OpenAI TTS API", status: "ok", health: "/health" });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok", model });
});

app.post("/tts", enforceRateLimit, async (request, response) => {
  const text = typeof request.body?.text === "string"
    ? request.body.text.replace(/\s+/g, " ").trim()
    : "";
  const interviewerType = request.body?.interviewerType || request.body?.interviewer;
  const profile = interviewerProfiles[interviewerType];

  if (!text || text.length > maxTextLength) {
    response.status(400).json({ error: `text는 1자 이상 ${maxTextLength}자 이하여야 합니다.` });
    return;
  }
  if (!profile) {
    response.status(400).json({ error: "지원하지 않는 interviewerType입니다." });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    response.status(503).json({ error: "음성 서버 환경변수가 설정되지 않았습니다." });
    return;
  }

  const cacheKey = crypto
    .createHash("sha256")
    .update(`${interviewerType}:${text}`)
    .digest("hex");
  const cached = audioCache.get(cacheKey);
  if (cached) {
    response.set({ "Content-Type": "audio/mpeg", "X-TTS-Cache": "HIT" });
    response.send(cached);
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({
      model,
      voice: profile.voice,
      input: text,
      instructions: profile.instructions,
      speed: profile.speed,
      response_format: "mp3"
    });
    const audio = Buffer.from(await speech.arrayBuffer());
    cacheAudio(cacheKey, audio);
    response.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
      "X-TTS-Cache": "MISS"
    });
    response.send(audio);
  } catch (error) {
    const status = Number(error?.status) >= 400 && Number(error?.status) < 600
      ? Number(error.status)
      : 502;
    console.error("TTS request failed", {
      status,
      type: error?.name,
      requestId: error?.request_id
    });
    response.status(status).json({ error: "면접관 음성을 생성하지 못했습니다. 잠시 후 다시 시도해주세요." });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.message === "허용되지 않은 출처입니다.") {
    response.status(403).json({ error: error.message });
    return;
  }
  console.error("Unhandled server error", error?.name || "Error");
  response.status(500).json({ error: "서버 요청을 처리하지 못했습니다." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`면접콕 TTS server listening on port ${port}`);
  });
}

export { app, interviewerProfiles, model };

