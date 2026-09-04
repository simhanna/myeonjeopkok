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
    questionAudioRequest: null,
    questionUtterance: null,
    ttsUnavailable: false
  };

  const TTS_ENDPOINT = window.MYEONJEOPKOK_TTS_API
    || localStorage.getItem("mk_tts_api")
    || "https://myeonjeopkok-simhanna-tts.onrender.com/tts";

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function getProject() {
    return window.MyeonjeopkokProjects?.getActiveProject?.() || null;
  }

  function projectQuestions(project) {
    const school = project.type === "school";
    const target = project.targetName;
    const role = project.role;
    const cover = (project.covers || [])[0]?.text || "";
    const saved = (project.expectedQuestions || []).slice(0, 5);
    const source = saved.length >= 5 ? saved : null;
    if (source) {
      const leads = {
        fact: ["네, 바로 확인해볼게요.", "좋습니다. 그럼 조금 더 구체적으로 보겠습니다.", "말씀하신 내용에서 한 가지 짚어볼게요.", "네, 이번에는 실제 행동을 확인하겠습니다.", "마지막으로 핵심만 여쭤볼게요."],
        manager: ["네, 먼저 편하게 말씀해주시겠어요?", "좋습니다. 그 부분을 조금 더 들어보고 싶군요.", "네, 당시 상황을 떠올리면서 말씀해보세요.", "좋습니다. 한 가지만 더 확인해보겠습니다.", "네, 마지막 질문입니다."],
        strict: ["바로 질문드리겠습니다.", "말씀하신 내용은 알겠습니다. 다만 확인할 게 있습니다.", "그 부분은 조금 더 분명해야겠네요.", "좋습니다. 핵심만 말씀해보세요.", "마지막으로 확인하겠습니다."]
      };
      return source.map((question, index) => `${leads[state.interviewer][index]} ${question}`);
    }
    if (state.interviewer === "fact") return [
      `네, 그러면 ${target}의 ${role}에 지원한 이유부터 확인할게요. 다른 지원자 대신 본인을 선택해야 하는 명확한 이유는 뭐라고 생각하세요?`,
      `좋습니다. 본인에게 ${role} 역량이 있다고 판단할 수 있는 행동과 결과를 수치나 실제 변화로 설명해주시겠어요?`,
      cover
        ? "자기소개서에 적은 경험을 보면요. 본인이 빠졌어도 비슷한 결과가 나왔을 것 같은데, 본인이 직접 만든 변화는 정확히 뭐였어요?"
        : "본인이 말한 강점이 단순한 자기평가는 아니라는 객관적인 근거가 있나요? 실제 사례로 말씀해주세요.",
      "협업 중 갈등을 해결했다고 하셨는데요. 상대방이 양보한 것을 본인의 해결 능력이라고 해석한 건 아닌지, 그 차이를 설명해주시겠어요?",
      school
        ? `마지막으로요. 말씀하신 학업 계획이 꼭 ${target} ${role}여야만 가능한 이유는 무엇인가요?`
        : `마지막으로요. 말씀하신 목표가 본인의 성장뿐 아니라 ${target}에 실제로 어떤 도움이 되는지 설명해주세요.`
    ];
    if (state.interviewer === "manager") return [
      `네, 먼저 ${target}의 ${role}에 지원하게 된 계기부터 편하게 말씀해주시겠어요?`,
      school
        ? `${role} 진학을 위해 준비한 활동이 있다면 말씀해보세요. 그 과정에서 무엇을 배웠는지도 함께 들려주시면 좋겠습니다.`
        : `${role} 업무에 필요한 역량을 보여준 경험이 있다면 말씀해보세요. 당시 본인이 맡았던 역할도 함께 설명해주시겠어요?`,
      cover
        ? "좋습니다. 자기소개서에 적은 그 경험에서 본인이 직접 맡았던 역할은 정확히 뭐였어요? 행동과 결과를 차근차근 말씀해보세요."
        : "네, 본인이 생각하는 가장 큰 강점은 뭐라고 생각하세요? 그 강점이 실제로 드러난 경험도 함께 말씀해주시겠어요?",
      "협업하는 과정에서 의견이 달라 어려웠던 적이 있었나요? 그때 상대방과 어떻게 조율했는지 편하게 말씀해보세요.",
      school
        ? `마지막으로 ${target}에 입학한 뒤 이루고 싶은 학업 목표와 계획을 말씀해주시겠어요?`
        : `마지막으로 ${target}에 입사한다면 어떤 목표를 이루고, 조직에 어떻게 기여하고 싶은지 말씀해주시겠어요?`
    ];
    if (state.interviewer === "strict") return [
      `${target}의 ${role} 지원 동기가 본인에게만 좋은 이야기로 들리는데요. 우리 입장에서 본인을 선택하면 얻는 것이 정확히 무엇입니까?`,
      `본인이 ${role} 역량을 갖췄다고 하셨죠. 그 주장을 확인할 수 있는 수치와 결과부터 짧고 분명하게 말씀해보세요.`,
      cover
        ? "자기소개서 내용이 다소 포장된 것 같네요. 본인이 실제로 한 행동과 다른 사람이 한 일을 정확히 구분해서 말씀해보세요."
        : "강점이라는 말은 누구나 할 수 있습니다. 실패하거나 부족했던 상황에서도 그 강점이 드러났다는 근거가 있습니까?",
      "갈등을 해결했다고 하셨는데요. 상대방 입장에서는 본인이 갈등의 원인이었을 가능성도 검토해봤습니까?",
      school
        ? `이 정도 계획이라면 다른 학교에서도 가능해 보입니다. 반드시 ${target} ${role}여야 하는 이유가 있습니까?`
        : `말씀하신 목표가 실제 업무 성과로 이어지지 않는다면, 회사가 본인을 계속 선택해야 할 이유는 무엇입니까?`
    ];
    return [];
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
    if (state.questionUtterance) {
      state.questionUtterance.onstart = null;
      state.questionUtterance.onend = null;
      state.questionUtterance.onerror = null;
      state.questionUtterance = null;
    }
    window.speechSynthesis?.cancel();
  }

  function browserVoices() {
    if (!window.speechSynthesis) return Promise.resolve([]);
    const available = window.speechSynthesis.getVoices();
    if (available.length) return Promise.resolve(available);
    return new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.speechSynthesis.removeEventListener?.("voiceschanged", finish);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener?.("voiceschanged", finish, { once: true });
      setTimeout(finish, 700);
    });
  }

  function preferredBrowserVoice(voices) {
    const korean = voices.filter(voice => /^ko([-_]|$)/i.test(voice.lang));
    if (!korean.length) return null;
    const preferredNames = state.interviewer === "manager"
      ? /injoon|in-joon|준호|남성|male/i
      : /sunhi|sun-hi|heami|하미|서현|여성|female|google.*한국/i;
    return korean.find(voice => preferredNames.test(voice.name))
      || korean.find(voice => voice.localService)
      || korean[0];
  }

  async function speakBrowserQuestion(run, serverError) {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
      setStage("idle", "이 브라우저에서는 질문 음성을 재생할 수 없어요.");
      $("#remoteReplay").disabled = false;
      $("#remoteMic").disabled = !state.recognition;
      $("#remoteSupport").innerHTML = `<b>음성 재생을 지원하는 브라우저가 필요해요.</b><br>Chrome 또는 Edge에서 다시 열어주세요.${serverError ? ` · ${safe(serverError.message)}` : ""}`;
      return;
    }

    const voices = await browserVoices();
    if (run !== state.speechRun || !state.running) return;
    const utterance = new SpeechSynthesisUtterance(state.questions[state.index]);
    const voice = preferredBrowserVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "ko-KR";
    utterance.rate = state.interviewer === "manager" ? 0.88 : state.interviewer === "strict" ? 1.02 : 1;
    utterance.pitch = state.interviewer === "manager" ? 0.85 : state.interviewer === "strict" ? 0.92 : 1.08;
    utterance.volume = 1;
    state.questionUtterance = utterance;

    const finishSpeech = () => {
      if (run !== state.speechRun) return;
      state.questionUtterance = null;
      setStage("waiting", "답변 대기 중");
      $("#remoteMic").disabled = !state.recognition;
      $("#remoteMic").classList.toggle("ready", !!state.recognition);
      $("#remoteReplay").disabled = false;
    };
    utterance.onstart = () => {
      if (run !== state.speechRun) return;
      setStage("speaking", "질문 중");
      $("#remoteSupport").innerHTML = "<b>면접관 질문을 재생하고 있어요.</b><br>기기의 한국어 음성으로 안전하게 재생 중입니다.";
    };
    utterance.onend = finishSpeech;
    utterance.onerror = event => {
      if (run !== state.speechRun || event.error === "canceled" || event.error === "interrupted") return;
      state.questionUtterance = null;
      setStage("idle", "음성을 재생하지 못했어요. 질문 다시 듣기를 눌러주세요.");
      $("#remoteReplay").disabled = false;
      $("#remoteMic").disabled = !state.recognition;
      $("#remoteSupport").innerHTML = `<b>기기 음성을 시작하지 못했어요.</b><br>${safe(event.error || "브라우저의 사이트 소리 권한을 확인해주세요.")}`;
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function speakOpenAIQuestion() {
    if (!state.running || !state.questions[state.index]) return;
    stopListening(false);
    const run = ++state.speechRun;
    stopQuestionAudio();
    if (state.ttsUnavailable) {
      await speakBrowserQuestion(run);
      return;
    }
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
        state.ttsUnavailable = true;
        speakBrowserQuestion(run, new Error("서버 음성 파일을 재생하지 못했습니다."));
      };
      await audio.play();
    } catch (error) {
      if (error.name === "AbortError" || run !== state.speechRun) return;
      state.ttsUnavailable = true;
      await speakBrowserQuestion(run, error);
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
    voiceNotice.textContent = "안내: 면접관 음성은 OpenAI AI로 생성되며 실제 사람의 녹음이 아닙니다.";
    $("#remoteSupport")?.insertAdjacentElement("beforebegin", voiceNotice);
    prepareRecognition();
    wire();
    selectInterviewer("fact");
    refreshProject();
    document.documentElement.dataset.remoteInterviewReady = "true";
  }

  initialize();
})();
