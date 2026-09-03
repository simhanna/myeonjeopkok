# 면접콕 OpenAI 음성 연결 안내

## 파일 구분

- `index.html`: 기존 비대면 면접 화면과 스크립트 로딩
- `remote-interview.css`: 말하기·듣기 상태와 입 모양 애니메이션
- `remote-interview.js`: 면접 질문, 자동 재생, 다시 듣기, 음성 입력
- `tts_server/main.py`: OpenAI TTS를 호출하는 비공개 키 보관 서버
- `tts_server/requirements.txt`: Python 서버 패키지
- `render.yaml`: Render Web Service 자동 배포 설정

## 처음 한 번만 할 작업

1. Render에서 이 저장소를 `Blueprint`로 배포합니다.
2. 생성되는 `myeonjeopkok-simhanna-tts` Web Service의 환경변수에 `OPENAI_API_KEY`를 입력합니다.
3. `https://myeonjeopkok-simhanna-tts.onrender.com/health`에서 `{"status":"ok"}`가 표시되는지 확인합니다.

API 키는 `index.html`이나 `remote-interview.js`에 넣지 않습니다. Render 환경변수에만 저장합니다.
