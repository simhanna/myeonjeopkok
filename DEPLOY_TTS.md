# 면접콕 음성 및 선택형 Node.js TTS 배포 안내

면접콕은 기본적으로 비용이 들지 않는 브라우저 한국어 음성을 사용합니다. `OPENAI_API_KEY`나 TTS 백엔드가 없어도 면접 시작, 다음 질문, 질문 다시 듣기가 모두 작동합니다. Chrome보다 Edge에서 자연스러운 한국어 남성·여성 음성을 찾을 가능성이 높습니다.

Node.js 백엔드는 나중에 유료 OpenAI 음성을 선택하고 싶을 때만 사용하는 선택 기능입니다. 브라우저가 OpenAI를 직접 호출하지 않으며, 백엔드가 Render 환경변수의 API 키를 사용해 MP3를 반환합니다.

## 파일별 역할

- `tts_server/server.js`: CORS 검사, 입력 검증, 캐릭터별 음성 설정, OpenAI TTS 호출, MP3 반환
- `tts_server/package.json`: Node.js 실행 명령과 필요한 패키지
- `tts_server/.env.example`: 로컬 및 Render 환경변수 예시(진짜 키는 넣지 않음)
- `remote-interview.js`: `speakQuestion(text, interviewerType)` 호출, 자동 재생, 다시 듣기, 캐릭터 말하기 상태
- `render.yaml`: Render Web Service의 빌드·실행·환경변수 설정

## Render에 배포하기

무료 브라우저 음성만 사용할 때는 이 단계를 진행할 필요가 없습니다.

1. 이 저장소를 GitHub에 올립니다.
2. Render 대시보드에서 **New > Blueprint**를 선택하고 이 저장소를 연결합니다.
3. `render.yaml`에 따라 `myeonjeopkok-simhanna-tts` Web Service가 생성되는지 확인합니다.
4. 서비스의 **Environment**에서 `OPENAI_API_KEY`에 실제 키를 입력합니다.
5. `ALLOWED_ORIGINS`에 실제 프론트엔드 주소를 입력합니다. 여러 주소는 쉼표로 구분하고 `/`로 끝내지 않습니다.
6. 배포 후 `https://<백엔드-서비스>.onrender.com/health`가 `{"status":"ok","model":"gpt-4o-mini-tts"}`를 반환하는지 확인합니다.

기본 백엔드 서비스 주소를 변경했다면 `remote-interview.js`의 기본 `TTS_ENDPOINT`를 변경하거나, 해당 스크립트보다 먼저 다음 설정을 추가합니다.

```html
<script>
  window.MYEONJEOPKOK_TTS_API = "https://<백엔드-서비스>.onrender.com/tts";
  window.MYEONJEOPKOK_USE_OPENAI_TTS = true;
</script>
```

`OPENAI_API_KEY`는 위 코드, HTML, JavaScript, Git 저장소에 절대 넣지 않습니다.

## 로컬 실행

```bash
cd tts_server
cp .env.example .env
npm install
npm start
```

`.env`의 `OPENAI_API_KEY`를 실제 키로 바꾼 뒤 실행합니다. `.env`는 `.gitignore`에 포함되어 커밋되지 않습니다.

## 프론트엔드 사용법

페이지에서 아래처럼 호출할 수 있습니다.

```js
speakQuestion(
  "네, 그럼 이 경험에서 본인이 직접 맡았던 역할은 무엇이었나요?",
  "factWoman"
);
```

지원하는 유형은 `factWoman`, `kindMan`, `strictWoman`입니다. 기존 화면의 면접 시작, 다음 질문, 질문 다시 듣기 버튼에는 이미 연결되어 있습니다.
