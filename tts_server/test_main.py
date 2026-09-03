import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class FakeResponse:
    status_code = 200
    content = b"ID3-test-audio"


class FakeAsyncClient:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse()


class TtsApiTests(unittest.TestCase):
    def setUp(self):
        os.environ["OPENAI_API_KEY"] = "test-only-key"
        main.audio_cache.clear()
        main.request_times.clear()
        FakeAsyncClient.calls.clear()
        self.client = TestClient(main.app)

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["model"], "gpt-4o-mini-tts")

    @patch("main.httpx.AsyncClient", FakeAsyncClient)
    def test_each_interviewer_uses_a_distinct_profile(self):
        expected = {
            "fact": ("coral", 0.93, "젊고 또렷한 여성"),
            "manager": ("cedar", 0.88, "중년 남성"),
            "strict": ("marin", 0.91, "여성 관리자"),
        }
        for interviewer, (voice, speed, phrase) in expected.items():
            response = self.client.post(
                "/tts",
                json={"text": f"{interviewer} 자기소개를 해주세요.", "interviewer": interviewer},
                headers={"Origin": "https://simhanna.github.io"},
            )
            self.assertEqual(response.status_code, 200)
            body = FakeAsyncClient.calls[-1][1]["json"]
            self.assertEqual(body["model"], "gpt-4o-mini-tts")
            self.assertEqual(body["voice"], voice)
            self.assertEqual(body["speed"], speed)
            self.assertIn(phrase, body["instructions"])
            self.assertNotIn("test-only-key", str(body))

    def test_rejects_unknown_interviewer(self):
        response = self.client.post("/tts", json={"text": "질문", "interviewer": "unknown"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
