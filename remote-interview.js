(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const interviewerMap = {
    fact: {
      name: "한지우 면접관",
      image: "s/g2.png",
      talkImage: "s/g2-talk.png",
      gender: "female",
      difficulty: "팩트형",
      prompt: "젊고 꼼꼼합니다. 뼈를 때리듯 직설적이지만 정확한 근거로 허점을 짚어 반박하기 어려운 질문을 합니다."
    },
    manager: {
      name: "박준호 부장",
      image: "s/bv.png",
      talkImage: "s/bv-talk.png",
      gender: "male",
      difficulty: "인자한 부장님형",
      prompt: "말투는 인자하고 편안하지만 답변의 역할, 행동, 결과를 하나씩 놓치지 않고 깐깐하게 확인합니다."
    },
    strict: {
      name: "김서현 부장",
      image: "s/g1.png",
      talkImage: "s/g1-talk.png",
      gender: "female",
      difficulty: "까칠한 부장님형",
      prompt: "경력이 느껴지는 까칠하고 냉정한 여자 부장님 스타일로, 애매한 표현을 넘기지 않고 성과와 책임 범위를 집요하게 확인합니다."
    }
  };
  const state = {
    interviewer: "fact",
    project: null,
    questions: [],
    answers: [],
    index: 0,
    running: false,
    listening: false,
    recognition: null,
    finalSpeech: "",
    baseText: "",
    questionStartedAt: 0,
    interviewStartedAt: 0,
    timer: null,
    speechRun: 0,
    listeningRequested: false,
    recognitionStarting: false,
    questionAudio: null,
    questionAudioUrl: "",
    questionAudioRequest: null
  };

  const TTS_ENDPOINT = window.MYEONJEOPKOK_TTS_API
    || localStorage.getItem("mk_tts_api")
    || "";

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function getProject() {
    return window.MyeonjeopkokProjects?.getActiveProject?.() || null;
  }

  function projectQuestions(project) {
    if ((project.expectedQuestions || []).length >= 5) return project.expectedQuestions.slice(0, 5);
    const school = project.type === "school";
    const target = project.targetName;
    const role = project.role;
    const cover = (project.covers || [])[0]?.text || "";
    const strengthQuestion = school
      ? `${role} 진학을 위해 준비한 활동과 그 과정에서 배운 점을 말씀해주세요.`
      : `${role} 업무에 필요한 역량을 발휘한 경험을 말씀해주세요.`;
    const tailored = cover
      ? "자기소개서에 작성한 경험에서 본인이 직접 수행한 행동과 결과를 구체적으로 설명해주세요."
      : "본인의 강점을 보여주는 대표적인 경험을 설명해주세요.";
    const questions = [
      `${target}의 ${role}에 지원한 이유를 말씀해주세요.`,
      strengthQuestion,
      tailored,
      "협업 과정에서 의견 충돌이나 문제가 발생했을 때 어떻게 해결했나요?",
      school
        ? `${target} 입학 후 이루고 싶은 학업 목표와 계획을 말씀해주세요.`
        : `${target} 입사 후 이루고 싶은 목표와 기여 방안을 말씀해주세요.`
    ];
    if (state.interviewer === "manager") return questions.map((question, index) => index
      ? `좋습니다. 한 가지만 더 구체적으로 확인하겠습니다. ${question}`
      : question);
    if (state.interviewer === "fact") return [
      `${target}의 ${role}에 지원했다고 했는데, 다른 지원자 대신 본인을 선택해야 하는 명확한 이유가 무엇인가요?`,
      `${role} 역량이 있다고 판단할 수 있는 행동과 결과를 수치나 변화로 증명해주세요.`,
      cover
        ? "자기소개서의 경험에서 본인이 빠졌어도 같은 결과가 나왔을 것 같은데, 본인만의 기여는 정확히 무엇이었나요?"
        : "강점이라고 말한 내용이 단순한 자기평가가 아니라는 객관적인 근거를 말씀해주세요.",
      "협업 갈등을 해결했다고 했는데, 상대방이 양보한 것을 본인의 해결 능력이라고 해석한 것은 아닌가요?",
      school
        ? `말씀한 학업 계획이 꼭 ${target} ${role}여야만 가능한 이유를 설명해주세요.`
        : `말씀한 목표가 본인의 성장뿐 아니라 ${target}에 실제로 어떤 이익을 주는지 설명해주세요.`
    ];
    if (state.interviewer === "strict") return [
      `${target}의 ${role} 지원 동기가 본인 입장에서만 좋은 이야기로 들리는데, 우리 지원처가 얻는 것은 정확히 무엇인가요?`,
      `본인이 ${role} 역량을 갖췄다고 했는데, 그 주장을 검증할 수 있는 수치와 결과부터 말씀해보세요.`,
      cover
        ? "자기소개서 내용이 다소 포장된 것 같습니다. 본인이 실제로 한 행동과 다른 사람이 한 일을 명확히 구분해주세요."
        : "강점이라는 표현은 누구나 할 수 있습니다. 실패하거나 부족했던 상황에서도 같은 강점이 드러났다는 근거가 있나요?",
      "갈등을 해결했다고 했는데, 상대방 입장에서는 본인이 갈등의 원인이었을 가능성은 검토했나요?",
      school
        ? `이 정도 계획이라면 다른 학교에서도 가능한데, 반드시 ${target} ${role}여야 하는 이유가 있나요?`
        : `말씀한 목표가 실제 업무 성과로 이어지지 않는다면 회사가 본인을 계속 선택해야 할 이유는 무엇인가요?`
    ];
    return questions;
  }

  function fillerCount(text) {
    return (String(text).match(/어+|음+|약간|뭔가|그냥|저기/g) || []).length;
  }

  function setStage(mode, message) {
    const stage = $(".interviewer-stage");
    stage?.classList.toggle("speaking", mode === "speaking");
    stage?.classList.toggle("listening", mode === "listening");
    const badge = $("#remoteLiveBadge");
    badge?.classList.toggle("live", mode === "listening");
    if (badge) badge.textContent = mode === "speaking" ? "질문 중" : mode === "listening" ? "답변 듣는 중" : mode === "waiting" ? "답변 대기 중" : "대기 중";
    if ($("#remoteInterviewerStatus")) $("#remoteInterviewerStatus").textContent = message || interviewerMap[state.interviewer].prompt;
  }

  function selectInterviewer(key) {
    if (state.running) {
      alert("면접이 진행 중일 때는 면접관을 변경할 수 없어요.");
      return;
    }
    state.interviewer = key;
    const config = interviewerMap[key];
    $$(".interviewer-option").forEach(button => button.classList.toggle("on", button.dataset.interviewer === key));
    $("#remoteInterviewerImage").src = config.image;
    $("#remoteMouthLayer").src = config.talkImage;
    $(".interviewer-stage").dataset.interviewer = key;
    $("#remoteInterviewerName").textContent = config.name;
    setStage("idle", config.prompt);
  }

  function stopQuestionAudio() {
    window.speechSynthesis?.cancel();
    state.questionAudioRequest?.abort();
    state.questionAudioRequest = null;
    if (state.questionAudio) {
      state.questionAudio.pause();
      state.questionAudio.removeAttribute("src");
      state.questionAudio.load();
      state.questionAudio = null;
    }
    if (state.questionAudioUrl) {
      URL.revokeObjectURL(state.questionAudioUrl);
      state.questionAudioUrl = "";
    }
  }

  function preferredKoreanVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const korean = voices.filter(voice => /^ko/i.test(voice.lang) || /ko[-_]KR/i.test(voice.lang));
    const wantsMale = interviewerMap[state.interviewer].gender === "male";
    const genderPattern = wantsMale
      ? /InJoon|BongJin|GookMin|Hyunsu|YoungMin|Male|남성/i
      : /SunHi|Yuna|Heami|Female|여성/i;
    const score = voice =>
      (/Natural|Neural/i.test(voice.name) ? 100 : 0)
      + (/Online/i.test(voice.name) ? 30 : 0)
      + (genderPattern.test(voice.name) ? 50 : 0);
    return korean.sort((a, b) => score(b) - score(a))[0] || voices[0] || null;
  }

  function speakBrowserQuestion() {
    if (!state.running || !state.questions[state.index] || !window.speechSynthesis) return;
    stopListening(false);
    stopQuestionAudio();
    const run = ++state.speechRun;
    const voice = preferredKoreanVoice();
    const segments = String(state.questions[state.index]).match(/[^,.!?]+[,.!?]?/g) || [state.questions[state.index]];
    $("#remoteMic").disabled = true;
    $("#remoteReplay").disabled = true;
    const finish = () => {
      if (run !== state.speechRun) return;
      setStage("waiting", "답변 대기 중");
      $("#remoteMic").disabled = !state.recognition;
      $("#remoteMic").classList.toggle("ready", !!state.recognition);
      $("#remoteReplay").disabled = false;
    };
    const playSegment = index => {
      if (run !== state.speechRun) return;
      if (index >= segments.length) return finish();
      const utterance = new SpeechSynthesisUtterance(segments[index].trim());
      utterance.lang = "ko-KR";
      if (voice) utterance.voice = voice;
      utterance.rate = state.interviewer === "manager" ? 0.84 : state.interviewer === "strict" ? 0.91 : 0.9;
      utterance.pitch = state.interviewer === "manager" ? 0.76 : state.interviewer === "strict" ? 0.88 : 1.02;
      utterance.volume = 1;
      utterance.onstart = () => setStage("speaking", "질문 중");
      utterance.onend = () => {
        if (run !== state.speechRun) return;
        setTimeout(() => playSegment(index + 1), /[.!?]$/.test(segments[index]) ? 220 : 100);
      };
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    };
    setStage("idle", "한국어 면접관 음성을 준비하고 있어요…");
    if (voice) playSegment(0);
    else {
      let started = false;
      const begin = () => {
        if (started || run !== state.speechRun) return;
        started = true;
        playSegment(0);
      };
      window.speechSynthesis.addEventListener("voiceschanged", begin, { once: true });
      setTimeout(begin, 600);
    }
  }

  async function speakOpenAIQuestion() {
    if (!state.running || !state.questions[state.index]) return;
    if (!TTS_ENDPOINT) {
      speakBrowserQuestion();
      return;
    }
    stopListening(false);
    stopQuestionAudio();
    const run = ++state.speechRun;
    const controller = new AbortController();
    state.questionAudioRequest = controller;
    $("#remoteMic").disabled = true;
    $("#remoteReplay").disabled = true;
    setStage("idle", "면접관 음성을 준비하고 있어요…");
    try {
      const response = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: state.questions[state.index],
          interviewer: state.interviewer
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || `음성 서버 오류 (${response.status})`);
      }
      const audioBlob = await response.blob();
      if (!audioBlob.size || !/^audio\//i.test(audioBlob.type || "audio/mpeg")) {
        throw new Error("유효한 음성 파일을 받지 못했습니다.");
      }
      if (run !== state.speechRun) return;
      state.questionAudioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(state.questionAudioUrl);
      state.questionAudio = audio;
      const finishSpeech = () => {
        if (run !== state.speechRun) return;
        setStage("waiting", "답변 대기 중");
        $("#remoteMic").disabled = !state.recognition;
        $("#remoteMic").classList.toggle("ready", !!state.recognition);
        $("#remoteReplay").disabled = false;
      };
      audio.onplay = () => setStage("speaking", "질문 중");
      audio.onended = finishSpeech;
      audio.onerror = () => {
        if (run !== state.speechRun) return;
        speakBrowserQuestion();
      };
      await audio.play();
    } catch (error) {
      if (error.name === "AbortError" || run !== state.speechRun) return;
      $("#remoteSupport").innerHTML = "<b>기기 한국어 음성으로 재생 중이에요.</b><br>별도의 서버 설정 없이 면접 연습을 계속할 수 있어요.";
      speakBrowserQuestion();
    } finally {
      if (state.questionAudioRequest === controller) state.questionAudioRequest = null;
    }
  }

  function prepareRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !window.isSecureContext) {
      $("#remoteMic").disabled = true;
      $("#remoteMic").textContent = "음성 인식 미지원";
      setRecognitionIndicator("unsupported", "음성 인식 미지원");
      $("#remoteSupport").innerHTML = !window.isSecureContext
        ? "<b>마이크는 보안 연결에서만 사용할 수 있어요.</b><br>HTTPS 주소 또는 localhost에서 면접콕을 열어주세요."
        : "<b>현재 브라우저는 음성 인식을 지원하지 않아요.</b><br>Chrome에서 열거나 답변 칸에 직접 입력해주세요.";
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      state.recognitionStarting = false;
      state.listening = true;
      state.listeningRequested = true;
      state.baseText = $("#remoteTranscript").value.trim();
      state.finalSpeech = "";
      $("#remoteMic").textContent = "■ 답변 녹음 중지";
      $("#remoteMic").setAttribute("aria-pressed", "true");
      $("#remoteMic").classList.add("recording");
      $("#remoteMic").classList.remove("ready");
      setRecognitionIndicator("recording", "녹음 중 · 말씀해주세요");
      setStage("listening", "답변을 듣고 있어요. 편하게 말씀해주세요.");
      $("#remoteSupport").innerHTML = "<b>음성 인식 중</b><br>말한 내용이 실시간으로 답변 칸에 표시됩니다.";
    };
    recognition.onresult = event => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) state.finalSpeech += text + " ";
        else interim += text;
      }
      const parts = [state.baseText, state.finalSpeech.trim(), interim.trim()].filter(Boolean);
      $("#remoteTranscript").value = parts.join(" ").slice(0, 1500);
      updateAnswerMeta();
    };
    recognition.onerror = event => {
      state.recognitionStarting = false;
      state.listeningRequested = false;
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      const noSpeech = event.error === "no-speech";
      if (event.error !== "aborted") {
        $("#remoteSupport").innerHTML = denied
          ? "<b>마이크 권한이 필요해요.</b><br>Chrome 주소창 왼쪽의 사이트 설정에서 마이크를 허용한 뒤 다시 눌러주세요."
          : noSpeech
            ? "<b>음성이 들리지 않았어요.</b><br>마이크를 확인한 뒤 ‘답변 시작’을 다시 눌러주세요."
            : `<b>음성 인식을 이어갈 수 없어요.</b><br>${safe(event.error)} · 직접 입력으로 면접을 계속할 수 있어요.`;
      }
      stopListening(false);
    };
    recognition.onend = () => {
      const wasActive = state.listening || state.recognitionStarting;
      state.listening = false;
      state.listeningRequested = false;
      state.recognitionStarting = false;
      resetMicButton();
      if (wasActive && state.running) {
        setStage("idle", "음성 입력이 끝났어요. 답변을 확인하거나 다시 녹음할 수 있어요.");
      }
    };
    state.recognition = recognition;
  }

  function setRecognitionIndicator(mode, message) {
    const indicator = $("#remoteRecordingStatus");
    if (!indicator) return;
    indicator.className = `recording-status ${mode || "idle"}`;
    indicator.textContent = message || "음성 입력 대기";
  }

  function resetMicButton() {
    const button = $("#remoteMic");
    if (!button) return;
    button.textContent = "🎙 답변 시작";
    button.setAttribute("aria-pressed", "false");
    button.classList.remove("recording");
    button.classList.toggle("ready", state.running);
    button.disabled = !state.running || !state.recognition;
    setRecognitionIndicator(state.running ? "idle" : "disabled", state.running ? "음성 입력 대기" : "면접 시작 전");
  }

  function startListening() {
    if (!state.running || !state.recognition || state.listening || state.recognitionStarting) return;
    state.listeningRequested = true;
    state.recognitionStarting = true;
    state.speechRun += 1;
    stopQuestionAudio();
    $("#remoteMic").textContent = "■ 답변 녹음 중지";
    $("#remoteMic").setAttribute("aria-pressed", "true");
    $("#remoteMic").classList.add("recording");
    $("#remoteMic").classList.remove("ready");
    setRecognitionIndicator("starting", "마이크 연결 중…");
    try {
      state.recognition.start();
    } catch {
      state.listeningRequested = false;
      state.recognitionStarting = false;
      resetMicButton();
      $("#remoteSupport").textContent = "음성 인식을 다시 시작하려면 잠시 후 버튼을 눌러주세요.";
    }
  }

  function stopListening(updateStatus = true) {
    const wasStarting = state.recognitionStarting;
    state.listeningRequested = false;
    state.recognitionStarting = false;
    if (!state.recognition) return;
    const wasListening = state.listening;
    state.listening = false;
    if (wasListening) {
      try {
        state.recognition.stop();
      } catch {}
    } else if (wasStarting) {
      try {
        state.recognition.abort();
      } catch {}
    }
    resetMicButton();
    if (updateStatus) {
      setRecognitionIndicator("idle", "음성 입력 중지됨");
      setStage("idle", "답변 내용을 확인한 뒤 완료 버튼을 눌러주세요.");
      $("#remoteSupport").innerHTML = "<b>음성 입력이 중지됐어요.</b><br>작성된 답변을 수정하거나 ‘답변 시작’을 눌러 이어서 말할 수 있어요.";
    }
  }

  function updateAnswerMeta() {
    const text = $("#remoteTranscript").value;
    $("#remoteChars").textContent = `${text.length}/1500`;
    $("#remoteFiller").textContent = `습관어 ${fillerCount(text)}회`;
    const enabled = state.running && !!text.trim();
    $("#remoteNext").disabled = !enabled;
    $("#remoteNext").classList.toggle("active", enabled);
  }

  function startTimer() {
    clearInterval(state.timer);
    state.questionStartedAt = Date.now();
    state.timer = setInterval(() => {
      $("#remoteTimer").textContent = Math.floor((Date.now() - state.questionStartedAt) / 1000) + "초";
    }, 500);
  }

  function showQuestion() {
    const question = state.questions[state.index];
    $("#remoteQuestionNumber").textContent = `QUESTION ${state.index + 1} / ${state.questions.length}`;
    $("#remoteProgressBar").style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
    $("#remoteQuestion").textContent = question;
    $("#remoteTranscript").value = "";
    $("#remoteTimer").textContent = "0초";
    updateAnswerMeta();
    startTimer();
    $("#remoteReplay").disabled = false;
    $("#remoteFinish").disabled = false;
    speakOpenAIQuestion();
  }

  function startInterview() {
    state.project = getProject();
    if (!state.project) {
      $("#remoteNoProject").style.display = "block";
      $("#remoteWorkspace").style.display = "none";
      return;
    }
    state.questions = projectQuestions(state.project);
    state.answers = [];
    state.index = 0;
    state.running = true;
    state.interviewStartedAt = Date.now();
    $("#remoteStart").textContent = "처음부터 다시 시작";
    $("#remoteSupport").innerHTML = "<b>비대면 면접이 시작됐어요.</b><br>질문을 들은 뒤 마이크 버튼을 눌러 답변해주세요.";
    showQuestion();
  }

  function nextQuestion() {
    const answer = $("#remoteTranscript").value.trim();
    if (!answer) return;
    stopListening();
    state.answers.push(answer);
    if (state.index >= state.questions.length - 1) {
      finishInterview();
      return;
    }
    if (state.interviewer === "fact" || state.interviewer === "strict" || state.interviewer === "manager") {
      let critique = answer.length < 80
        ? "방금 답변은 설명이 짧고 근거가 부족합니다."
        : !/결과|성과|개선|달성|변화/.test(answer)
          ? "방금 답변에는 행동 이후의 결과가 보이지 않습니다."
          : !/\d/.test(answer)
            ? "방금 답변에는 객관적으로 확인할 수 있는 수치가 없습니다."
            : "말씀하신 내용은 이해했습니다. 다만 본인의 기여를 더 분명히 확인하겠습니다.";
      if (state.interviewer === "manager") critique = `잘 들었습니다. 다만 확인할 부분이 있군요. ${critique}`;
      if (state.interviewer === "strict") critique = `핵심이 빠졌네요. ${critique}`;
      state.questions[state.index + 1] = `${critique} ${state.questions[state.index + 1]}`;
    }
    state.index += 1;
    showQuestion();
  }

  function calculateResult() {
    const all = state.answers.join(" ");
    const averageLength = all.length / Math.max(1, state.answers.length);
    const fillers = fillerCount(all);
    const detailWords = (all.match(/결과|성과|해결|개선|달성|배웠|기여|역할|행동/g) || []).length;
    const specific = Math.round(Math.max(20, Math.min(100, 35 + averageLength * 0.35 + detailWords * 4)));
    const star = Math.round(Math.max(20, Math.min(100, 30 + detailWords * 7)));
    const speech = Math.round(Math.max(20, Math.min(100, 90 - fillers * 5 - (averageLength < 45 ? 18 : 0))));
    const total = Math.round((specific + star + speech) / 3);
    return { total, specific, star, speech, fillers };
  }

  function finishInterview() {
    if (!state.running) return;
    stopListening();
    state.speechRun += 1;
    stopQuestionAudio();
    clearInterval(state.timer);
    if ($("#remoteTranscript").value.trim() && state.answers.length <= state.index) {
      state.answers.push($("#remoteTranscript").value.trim());
    }
    const result = calculateResult();
    const duration = Math.round((Date.now() - state.interviewStartedAt) / 1000);
    const config = interviewerMap[state.interviewer];
    const record = {
      date: new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      mode: "비대면 음성 면접",
      interviewer: config.name,
      level: config.difficulty,
      duration,
      questions: [...state.questions],
      answers: [...state.answers],
      total: result.total,
      specific: result.specific,
      star: result.star,
      speech: result.speech,
      fillers: result.fillers
    };
    window.MyeonjeopkokProjects?.saveRemoteInterview?.(record);
    state.running = false;
    $("#remoteNext").disabled = true;
    $("#remoteNext").classList.remove("active");
    $("#remoteFinish").disabled = true;
    $("#remoteReplay").disabled = true;
    resetMicButton();
    setStage("idle", "면접이 종료되었습니다. 수고하셨습니다.");
    $("#remoteSupport").innerHTML = `<div class="remote-result"><h3>비대면 면접 완료 · ${result.total}점</h3><div>구체성 ${result.specific} · STAR 구조 ${result.star} · 말하기 ${result.speech} · 습관어 ${result.fillers}회</div><div class="muted" style="margin-top:7px">현재 프로젝트의 면접 기록에 저장했습니다.</div></div>`;
  }

  function refreshProject() {
    state.project = getProject();
    const exists = !!state.project;
    $("#remoteNoProject").style.display = exists ? "none" : "block";
    $("#remoteWorkspace").style.display = exists ? "block" : "none";
    if (exists) {
      $("#remoteProjectName").textContent = `${state.project.targetName} · ${state.project.role}`;
      $("#remoteQuestion").textContent = "면접 시작 버튼을 누르면 현재 프로젝트에 맞는 질문을 음성으로 읽어드려요.";
    }
  }

  function wire() {
    $$(".interviewer-option").forEach(button => button.onclick = () => selectInterviewer(button.dataset.interviewer));
    $("#remoteStart").onclick = () => {
      if (state.running && !confirm("진행 중인 답변을 지우고 처음부터 다시 시작할까요?")) return;
      startInterview();
    };
    $("#remoteReplay").onclick = speakOpenAIQuestion;
    $("#remoteMic").onclick = () => state.listeningRequested ? stopListening() : startListening();
    $("#remoteTranscript").oninput = updateAnswerMeta;
    $("#remoteNext").onclick = nextQuestion;
    $("#remoteFinish").onclick = () => {
      if (confirm("현재까지의 답변으로 면접을 종료하고 저장할까요?")) finishInterview();
    };
    $$("[data-go='remoteInterview']").forEach(button => button.addEventListener("click", refreshProject));
    window.addEventListener("beforeunload", () => {
      stopQuestionAudio();
      stopListening(false);
    });
  }

  function initialize() {
    Object.values(interviewerMap).forEach(config => {
      const image = new Image();
      image.src = config.talkImage;
    });
    const transcript = $("#remoteTranscript");
    const answerLabel = transcript?.previousElementSibling;
    if (transcript && answerLabel?.tagName === "LABEL") {
      answerLabel.htmlFor = "remoteTranscript";
      const heading = document.createElement("div");
      heading.className = "remote-answer-heading";
      const indicator = document.createElement("span");
      indicator.id = "remoteRecordingStatus";
      indicator.className = "recording-status disabled";
      indicator.setAttribute("role", "status");
      indicator.setAttribute("aria-live", "polite");
      indicator.textContent = "면접 시작 전";
      answerLabel.replaceWith(heading);
      heading.append(answerLabel, indicator);
    }
    const voiceNotice = document.createElement("div");
    voiceNotice.className = "ai-voice-notice";
    voiceNotice.textContent = "안내: 면접관 음성은 기기의 한국어 음성 또는 OpenAI AI 음성으로 재생됩니다.";
    $("#remoteSupport")?.insertAdjacentElement("beforebegin", voiceNotice);
    prepareRecognition();
    wire();
    selectInterviewer("fact");
    refreshProject();
    document.documentElement.dataset.remoteInterviewReady = "true";
  }

  initialize();
})();
