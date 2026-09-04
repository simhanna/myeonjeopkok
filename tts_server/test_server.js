import assert from "node:assert/strict";
import { after, before, test } from "node:test";

delete process.env.OPENAI_API_KEY;

const { app } = await import("./server.js");
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test("health endpoint reports the configured TTS model", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    model: "gpt-4o-mini-tts"
  });
});

test("unknown interviewer types are rejected", async () => {
  const response = await fetch(`${baseUrl}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:8000"
    },
    body: JSON.stringify({ text: "안녕하세요.", interviewerType: "unknown" })
  });
  assert.equal(response.status, 400);
});

test("the server requires its private API key", async () => {
  const response = await fetch(`${baseUrl}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:8000"
    },
    body: JSON.stringify({ text: "안녕하세요.", interviewerType: "factWoman" })
  });
  assert.equal(response.status, 503);
});

test("CORS blocks an origin outside the allowlist", async () => {
  const response = await fetch(`${baseUrl}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://not-allowed.example"
    },
    body: JSON.stringify({ text: "안녕하세요.", interviewerType: "factWoman" })
  });
  assert.equal(response.status, 403);
});

