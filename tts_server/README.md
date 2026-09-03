# 면접콕 OpenAI TTS 서버

이 서버는 면접 질문만 받아 OpenAI `gpt-4o-mini-tts`로 MP3를 생성합니다. API 키는 프론트엔드에 포함하지 않고 Render 환경변수에서만 읽습니다.

## Render 연결

1. 저장소의 `render.yaml`을 이용해 Render Blueprint를 생성합니다.
2. `OPENAI_API_KEY` 값을 Render의 Secret 환경변수로 입력합니다.
3. 배포가 끝나면 `/health`가 `{"status":"ok"}`를 반환하는지 확인합니다.
4. 기본 서비스 이름을 바꾸면 프론트엔드의 `TTS_ENDPOINT`도 새 Render 주소로 변경합니다.

API 키를 소스 코드, Git 커밋, 브라우저 저장소에 넣지 마세요. 공개 엔드포인트의 비용 오남용을 줄이기 위해 입력 길이와 IP별 요청 횟수가 제한되어 있습니다.
