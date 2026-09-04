# 면접콕 OpenAI TTS Node.js 서버

프론트엔드에서 받은 면접 질문을 OpenAI `gpt-4o-mini-tts`로 읽고 MP3로 돌려주는 Express 서버입니다. API 키는 `process.env.OPENAI_API_KEY`에서만 읽으므로 브라우저로 전달되지 않습니다.

## API

### `GET /health`

서버 실행 상태와 모델 이름을 반환합니다.

### `POST /tts`

요청 예시:

```json
{
  "text": "지원 동기를 말씀해주세요.",
  "interviewerType": "kindMan"
}
```

`interviewerType`은 다음 중 하나입니다.

- `factWoman`: 젊고 또렷하며 차분한 여성 인사담당자
- `kindMan`: 중저음이고 편안한 남성 면접관
- `strictWoman`: 단호하고 날카롭지만 화내지 않는 여성 관리자

정상 응답은 `audio/mpeg` 형식의 MP3입니다.

## 환경변수

- `OPENAI_API_KEY`: 필수. Render의 Secret 환경변수로만 입력
- `ALLOWED_ORIGINS`: 요청을 허용할 프론트엔드 주소를 쉼표로 구분
- `PORT`: 선택. Render가 자동 제공하며 로컬 기본값은 `10000`

설치와 Render 배포 순서는 저장소 루트의 `DEPLOY_TTS.md`를 참고하세요.

OpenAI TTS 안내: https://platform.openai.com/docs/guides/text-to-speech
