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
    speechRun: 0
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
    $("#remoteMouthLayer").src = config.talkImage;
    $(".interviewer-stage").dataset.interviewer = key;
    $("#remoteInterviewerName").textContent = config.name;
    setStage("idle", config.prompt);
  }

  function koreanVoice() {
    const voices = speechSynthesis.getVoices();
    const korean = voices.filter(voice => /^ko/i.test(voice.lang) || voice.lang.includes("KR"));
    const wantsMale = interviewerMap[state.interviewer].gender === "male";
    const genderPattern = wantsMale
      ? /InJoon|BongJin|GookMin|Hyunsu|YoungMin|Male|남성/i
      : /SunHi|Yuna|Heami|Female|여성/i;
    const rank = list => [...list].sort((a, b) => {
      const score = voice =>
        (/Natural|Neural/i.test(voice.name) ? 100 : 0) +
        (/Online/i.test(voice.name) ? 40 : 0) +
        (!voice.localService ? 10 : 0);
      return score(b) - score(a);
    });
    const genderMatched = rank(korean.filter(voice => genderPattern.test(voice.name)));
    return genderMatched[0] || rank(korean)[0] || null;
  }

  function voiceMatchesCharacter(voice) {
    if (!voice) return false;
    const wantsMale = interviewerMap[state.interviewer].gender === "male";
    const pattern = wantsMale
      ? /InJoon|BongJin|GookMin|Hyunsu|YoungMin|Male|남성/i
      : /SunHi|Yuna|Heami|Female|여성/i;
    return pattern.test(voice.name);
  }

  function speechSegments(text) {
    const parts = String(text).match(/[^,.!?]+[,.!?]?/g) || [text];
    return parts.map(part => part.trim()).filter(Boolean);
  }

  function speakQuestion() {
    if (!state.running || !state.questions[state.index]) return;
    stopListening();
    speechSynthesis.cancel();
    const run = ++state.speechRun;
    let voice = koreanVoice();
    const segments = speechSegments(state.questions[state.index]);
    const status = $("#remoteInterviewerStatus");
    const finishSpeech = () => {
      if (run !== state.speechRun) return;
      setStage("idle", "답변을 기다리고 있어요");
      $("#remoteMic").disabled = false;
      $("#remoteMic").classList.add("ready");
    };
    const speakSegment = index => {
      if (run !== state.speechRun) return;
      if (index >= segments.length) {
        finishSpeech();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(segments[index]);
      utterance.lang = "ko-KR";
      utterance.rate = state.interviewer === "strict" ? 0.97 : state.interviewer === "manager" ? 0.91 : 0.94;
      utterance.pitch = state.interviewer === "manager"
        ? (voiceMatchesCharacter(voice) ? 0.9 : 0.72)
        : state.interviewer === "strict" ? 0.96 : 1.03;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (index === 0) setStage("speaking", "질문을 자연스럽게 읽고 있어요.");
      };
      utterance.onend = () => {
        if (run !== state.speechRun) return;
        const punctuation = segments[index].slice(-1);
        const pause = /[.!?]/.test(punctuation) ? 180 : 85;
        setTimeout(() => speakSegment(index + 1), pause);
      };
      utterance.onerror = () => finishSpeech();
      speechSynthesis.speak(utterance);
    };
    const beginNaturalSpeech = () => {
      if (run !== state.speechRun) return;
      voice = koreanVoice();
      if (status) {
        status.dataset.voice = voice?.name || "browser-default";
        status.dataset.voiceGender = voiceMatchesCharacter(voice) ? "matched" : "pitch-adjusted";
      }
      speakSegment(0);
    };
    if (voice) beginNaturalSpeech();
    else {
      setStage("idle", "자연스러운 목소리를 준비하고 있어요.");
      let started = false;
      const beginOnce = () => {
        if (started) return;
        started = true;
        beginNaturalSpeech();
      };
      speechSynthesis.addEventListener("voiceschanged", beginOnce, { once: true });
      setTimeout(beginOnce, 700);
    }
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
    Object.values(interviewerMap).forEach(config => {
      const image = new Image();
      image.src = config.talkImage;
    });
    prepareRecognition();
    wire();
    selectInterviewer("fact");
    refreshProject();
    document.documentElement.dataset.remoteInterviewReady = "true";
  }

  initialize();
})();
