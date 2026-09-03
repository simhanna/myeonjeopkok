(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const interviewerMap = {
    friendly: {
      name: "김하늘 면접관",
      image: "s/g2.png",
      difficulty: "착한맛",
      prompt: "편안하게 답변의 배경과 배운 점을 확인합니다."
    },
    standard: {
      name: "박준호 면접관",
      image: "s/bv.png",
      difficulty: "오리지널",
      prompt: "역할, 행동, 결과를 중심으로 실무 적합성을 확인합니다."
    },
    strict: {
      name: "최서윤 면접관",
      image: "s/g1.png",
      difficulty: "매운맛",
      prompt: "답변의 근거와 구체적인 성과를 꼼꼼하게 확인합니다."
    }
  };
  const state = {
    interviewer: "friendly",
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
    timer: null
  };

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
    return [
      `${target}의 ${role}에 지원한 이유를 말씀해주세요.`,
      strengthQuestion,
      tailored,
      "협업 과정에서 의견 충돌이나 문제가 발생했을 때 어떻게 해결했나요?",
      school
        ? `${target} 입학 후 이루고 싶은 학업 목표와 계획을 말씀해주세요.`
        : `${target} 입사 후 이루고 싶은 목표와 기여 방안을 말씀해주세요.`
    ];
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
    if (badge) badge.textContent = mode === "speaking" ? "질문 중" : mode === "listening" ? "답변 듣는 중" : "대기 중";
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
    $("#remoteMouthLayer").src = config.image;
    $(".interviewer-stage").dataset.interviewer = key;
    $("#remoteInterviewerName").textContent = config.name;
    setStage("idle", config.prompt);
  }

  function koreanVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find(voice => /^ko/i.test(voice.lang)) || voices.find(voice => voice.lang.includes("KR")) || null;
  }

  function speakQuestion() {
    if (!state.running || !state.questions[state.index]) return;
    stopListening();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.questions[state.index]);
    utterance.lang = "ko-KR";
    utterance.rate = state.interviewer === "strict" ? 1.04 : state.interviewer === "friendly" ? 0.94 : 1;
    utterance.pitch = state.interviewer === "standard" ? 0.86 : 1;
    const voice = koreanVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStage("speaking", "질문을 읽고 있어요.");
    utterance.onend = () => {
      setStage("idle", "답변을 시작하면 집중해서 듣겠습니다.");
      $("#remoteMic").disabled = false;
      $("#remoteMic").classList.add("ready");
    };
    utterance.onerror = () => {
      setStage("idle", "질문을 화면에서 확인하고 답변해주세요.");
      $("#remoteMic").disabled = false;
      $("#remoteMic").classList.add("ready");
    };
    speechSynthesis.speak(utterance);
  }

  function prepareRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      $("#remoteMic").disabled = true;
      $("#remoteMic").textContent = "음성 인식 미지원";
      $("#remoteSupport").innerHTML = "<b>현재 브라우저는 음성 인식을 지원하지 않아요.</b><br>답변 칸에 직접 입력하면 비대면 면접을 계속 진행할 수 있어요.";
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      state.listening = true;
      state.baseText = $("#remoteTranscript").value.trim();
      state.finalSpeech = "";
      $("#remoteMic").textContent = "■ 답변 녹음 중지";
      $("#remoteMic").classList.add("recording");
      $("#remoteMic").classList.remove("ready");
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
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      $("#remoteSupport").innerHTML = denied
        ? "<b>마이크 권한이 필요해요.</b><br>주소창의 마이크 권한을 허용하거나 답변을 직접 입력해주세요."
        : `<b>음성 인식을 이어갈 수 없어요.</b><br>${safe(event.error)} · 직접 입력으로 면접을 계속할 수 있어요.`;
      stopListening(false);
    };
    recognition.onend = () => {
      if (state.listening) {
        state.listening = false;
        resetMicButton();
        setStage("idle", "답변 내용을 확인한 뒤 완료 버튼을 눌러주세요.");
      }
    };
    state.recognition = recognition;
  }

  function resetMicButton() {
    const button = $("#remoteMic");
    if (!button) return;
    button.textContent = "🎙 답변 시작";
    button.classList.remove("recording");
    button.classList.toggle("ready", state.running);
    button.disabled = !state.running || !state.recognition;
  }

  function startListening() {
    if (!state.running || !state.recognition) return;
    speechSynthesis.cancel();
    try {
      state.recognition.start();
    } catch {
      $("#remoteSupport").textContent = "음성 인식을 다시 시작하려면 잠시 후 버튼을 눌러주세요.";
    }
  }

  function stopListening(updateStatus = true) {
    if (!state.recognition || !state.listening) return;
    state.listening = false;
    try {
      state.recognition.stop();
    } catch {}
    resetMicButton();
    if (updateStatus) setStage("idle", "답변 내용을 확인한 뒤 완료 버튼을 눌러주세요.");
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
    speakQuestion();
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
    speechSynthesis.cancel();
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
    $("#remoteReplay").onclick = speakQuestion;
    $("#remoteMic").onclick = () => state.listening ? stopListening() : startListening();
    $("#remoteTranscript").oninput = updateAnswerMeta;
    $("#remoteNext").onclick = nextQuestion;
    $("#remoteFinish").onclick = () => {
      if (confirm("현재까지의 답변으로 면접을 종료하고 저장할까요?")) finishInterview();
    };
    $$("[data-go='remoteInterview']").forEach(button => button.addEventListener("click", refreshProject));
    window.addEventListener("beforeunload", () => {
      speechSynthesis.cancel();
      stopListening(false);
    });
  }

  function initialize() {
    prepareRecognition();
    wire();
    selectInterviewer("friendly");
    refreshProject();
    document.documentElement.dataset.remoteInterviewReady = "true";
  }

  initialize();
})();
