const state = {
  jobs: readStore("interview-jobs", []),
  stories: readStore("interview-stories", []),
  intro: localStorage.getItem("interview-intro") || "",
  cover: localStorage.getItem("interview-cover") || "",
  currentAnalysis: null,
  questionIndex: 0,
  recording: false,
  timerId: null,
  seconds: 0
  ,practiceAnswers: [],
  level: "기본"
};

const fallbackQuestions = [
  "간단한 자기소개와 함께 지원 동기를 말씀해 주세요.",
  "이 직무에서 본인의 가장 큰 강점은 무엇인가요?",
  "목표를 달성하는 과정에서 어려움을 해결한 경험을 말씀해 주세요.",
  "동료와 의견이 달랐을 때 어떻게 합의점을 찾았나요?",
  "입사 후 1년 안에 이루고 싶은 목표는 무엇인가요?"
];

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation(); bindJobAnalysis(); bindStoryForm(); bindIntro(); bindPractice(); bindTheme(); renderAll();
  const initialPage = location.hash.replace("#", "") || "home";
  showPage(document.getElementById(`page-${initialPage}`) ? initialPage : "home", false);
});

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function bindNavigation() {
  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    const actionButton = event.target.closest("[data-action]");
    if (pageButton) showPage(pageButton.dataset.page);
    if (actionButton?.dataset.action === "go-job") showPage("job");
  });
  document.getElementById("newProjectButton").addEventListener("click", () => {
    document.getElementById("jobForm").reset();
    document.getElementById("analysisResult").hidden = true;
    showPage("job");
  });
  window.addEventListener("popstate", () => showPage(location.hash.replace("#", "") || "home", false));
}

function showPage(name, push = true) {
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === name));
  if (push && location.hash !== `#${name}`) history.pushState(null, "", `#${name}`);
  if (name === "practice") loadPracticeQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindJobAnalysis() {
  document.querySelectorAll("[data-input-tab]").forEach(tab => tab.addEventListener("click", () => {
    const isUrl = tab.dataset.inputTab === "url";
    document.querySelectorAll("[data-input-tab]").forEach(button => button.classList.toggle("active", button === tab));
    document.getElementById("urlInputPanel").hidden = !isUrl;
    document.getElementById("textInputPanel").hidden = isUrl;
  }));

  document.getElementById("jobForm").addEventListener("submit", async event => {
    event.preventDefault();
    const isUrl = !document.getElementById("urlInputPanel").hidden;
    const url = document.getElementById("jobUrl").value.trim();
    const text = document.getElementById("jobText").value.trim();
    if ((isUrl && !url) || (!isUrl && text.length < 30)) {
      toast(isUrl ? "채용공고 링크를 입력해 주세요." : "분석할 공고 내용을 조금 더 입력해 주세요."); return;
    }
    const loading = document.getElementById("analysisLoading");
    document.getElementById("analysisResult").hidden = true; loading.hidden = false;
    await new Promise(resolve => setTimeout(resolve, 850));
    state.currentAnalysis = analyzeJob(text, url); loading.hidden = true; renderAnalysis(state.currentAnalysis);
  });

  document.getElementById("saveJobButton").addEventListener("click", () => {
    if (!state.currentAnalysis) return;
    state.jobs.unshift({ ...state.currentAnalysis, id: Date.now(), savedAt: new Date().toISOString() });
    localStorage.setItem("interview-jobs", JSON.stringify(state.jobs)); renderAll(); toast("지원 준비에 저장했어요.");
  });
}

function analyzeJob(text, url) {
  const source = text.replace(/\s+/g, " ").trim();
  let host = "등록한 채용공고";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  const companyMatch = source.match(/(?:회사명|기업명|근무회사)\s*[:：]?\s*([^|·\n]{2,25})/i);
  const roleMatch = source.match(/(?:포지션|직무|모집분야|채용직무)\s*[:：]?\s*([^|·\n]{2,35})/i);
  const dictionaries = [
    ["JavaScript", /javascript|typescript|react|vue|node/i], ["데이터 분석", /데이터|sql|python|분석/i],
    ["협업", /협업|커뮤니케이션|소통|팀워크/i], ["문제 해결", /문제.?해결|트러블.?슈팅|개선/i],
    ["사용자 중심", /사용자|고객|ux|사용성/i], ["프로젝트 관리", /일정|프로젝트|기획|애자일/i]
  ];
  const detected = dictionaries.filter(([, pattern]) => pattern.test(source || url)).map(([label]) => label);
  const skills = detected.length ? detected.slice(0, 5) : ["직무 전문성", "문제 해결", "협업", "성장 의지"];
  const sentences = source.split(/[.!?。\n]/).map(item => item.trim()).filter(item => item.length > 14);
  const tasks = sentences.filter(item => /담당|업무|개발|운영|기획|관리|분석|설계|지원/.test(item)).slice(0, 4);
  const role = roleMatch?.[1]?.trim() || inferRole(source) || "지원 포지션";
  return {
    url, company: companyMatch?.[1]?.trim() || host, role, skills,
    tasks: tasks.length ? tasks : ["채용공고에서 요구하는 핵심 업무 수행", "유관 부서와 협업하여 목표 달성", "업무 과정의 문제를 발견하고 지속적으로 개선"],
    questions: [`${role} 직무에 지원한 이유와 본인의 강점을 말씀해 주세요.`, `${skills[0]} 역량을 발휘해 성과를 만든 경험이 있나요?`, "협업 과정에서 생긴 문제를 해결한 경험을 구체적으로 말씀해 주세요.", "입사 후 가장 먼저 기여하고 싶은 부분은 무엇인가요?"]
  };
}

function inferRole(text) {
  return ["백엔드 개발자", "프론트엔드 개발자", "데이터 분석가", "프로덕트 매니저", "서비스 기획자", "마케터", "디자이너"].find(role => text.includes(role)) || "";
}

function renderAnalysis(data) {
  document.getElementById("resultRole").textContent = data.role;
  document.getElementById("resultCompany").textContent = data.company;
  document.getElementById("taskList").innerHTML = data.tasks.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  document.getElementById("skillChips").innerHTML = data.skills.map(item => `<span>${escapeHtml(item)}</span>`).join("");
  document.getElementById("questionList").innerHTML = data.questions.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const result = document.getElementById("analysisResult"); result.hidden = false; result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindStoryForm() {
  document.getElementById("storyForm").addEventListener("submit", event => {
    event.preventDefault();
    state.stories.unshift({
      id: Date.now(), title: document.getElementById("storyTitle").value.trim(), situation: document.getElementById("storySituation").value.trim(),
      task: document.getElementById("storyTask").value.trim(), action: document.getElementById("storyAction").value.trim(), result: document.getElementById("storyResult").value.trim()
    });
    localStorage.setItem("interview-stories", JSON.stringify(state.stories)); event.target.reset(); renderAll(); toast("경험을 저장했어요.");
  });
}

function bindIntro() {
  const editor = document.getElementById("introText"); editor.value = state.intro;
  const updateCount = () => { const length = editor.value.trim().length; document.getElementById("introCount").textContent = `${length}자 · 약 ${Math.ceil(length / 5)}초`; };
  editor.addEventListener("input", updateCount); updateCount();
  document.getElementById("saveIntroButton").addEventListener("click", () => {
    state.intro = editor.value.trim(); localStorage.setItem("interview-intro", state.intro); renderAll(); toast("자기소개를 저장했어요.");
  });

  document.querySelectorAll("[data-content-tab]").forEach(tab => tab.addEventListener("click", () => {
    const cover = tab.dataset.contentTab === "cover";
    document.querySelectorAll("[data-content-tab]").forEach(button => button.classList.toggle("active", button === tab));
    document.getElementById("coverPanel").hidden = !cover; document.getElementById("minutePanel").hidden = cover;
  }));
  const coverText = document.getElementById("coverText"); coverText.value = state.cover;
  const updateCoverCount = () => { document.getElementById("coverCount").textContent = `${coverText.value.length}/500자`; };
  coverText.addEventListener("input", updateCoverCount); updateCoverCount();
  document.getElementById("makeDraftButton").addEventListener("click", makeCoverDraft);
  document.getElementById("useDraftButton").addEventListener("click", () => {
    coverText.value = document.getElementById("draftPreviewText").textContent.slice(0, 500); coverText.dispatchEvent(new Event("input")); toast("예시를 작성칸에 옮겼어요.");
  });
  document.getElementById("reviewCoverButton").addEventListener("click", reviewCover);
  document.getElementById("saveCoverButton").addEventListener("click", () => {
    state.cover = coverText.value.trim(); localStorage.setItem("interview-cover", state.cover); renderAll(); toast("자기소개서를 저장했어요.");
  });
}

function makeCoverDraft() {
  const storyId = Number(document.getElementById("coverStory").value);
  const story = state.stories.find(item => item.id === storyId);
  if (!story) { toast("먼저 활용할 경험을 선택해 주세요."); return; }
  const question = document.getElementById("coverQuestion").value;
  const role = state.jobs[0]?.role || "지원 직무";
  const result = story.result || "의미 있는 결과를 만들었습니다";
  const opening = question === "지원 동기" ? `저는 ${role}에서 문제를 끝까지 해결하는 과정에 매력을 느껴 지원했습니다.` : `${question}에 관한 저의 강점은 실행력과 책임감입니다.`;
  const draft = `${opening}\n\n${story.situation || story.title} 상황에서 ${story.task || "해결해야 할 과제를 정의했습니다"}. 저는 ${story.action || "필요한 행동을 구체적으로 계획하고 실행했습니다"}. 그 결과 ${result}.\n\n이 경험을 바탕으로 ${role}에서도 빠르게 문제를 파악하고 팀의 목표 달성에 기여하겠습니다.`;
  document.getElementById("draftPreviewText").textContent = draft.slice(0, 500);
  document.getElementById("draftPreview").hidden = false; toast("경험을 바탕으로 예시를 만들었어요.");
}

function reviewCover() {
  const text = document.getElementById("coverText").value.trim();
  if (text.length < 80) { toast("분석하려면 자기소개서를 80자 이상 작성해 주세요."); return; }
  const concrete = (text.match(/\d+|결과|성과|개선|달성|완료/g) || []).length;
  const action = (text.match(/직접|분석|제안|실행|조율|설계|개발|해결/g) || []).length;
  const score = Math.min(95, 55 + Math.min(20, concrete * 5) + Math.min(20, action * 4));
  const feedback = [];
  if (concrete < 2) feedback.push("결과를 수치나 전후 변화로 한 번 더 구체화해 보세요.");
  if (action < 2) feedback.push("팀이 아닌 ‘내가 직접 한 행동’을 동사로 보여주세요.");
  if (text.length > 700) feedback.push("핵심 메시지가 흐려지지 않도록 반복 문장을 줄여보세요.");
  if (!feedback.length) feedback.push("경험, 행동, 결과의 연결이 선명해요. 첫 문장만 더 간결하게 다듬어 보세요.");
  document.getElementById("coverFeedback").innerHTML = `<h3>내용 분석 <strong>${score}점</strong></h3><div class="review-score"><span style="width:${score}%"></span></div><ul class="feedback-list">${feedback.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function bindPractice() {
  document.getElementById("nextQuestion").addEventListener("click", submitPracticeAnswer);
  document.getElementById("prevQuestion").addEventListener("click", () => changeQuestion(-1));
  document.getElementById("recordButton").addEventListener("click", toggleTimer);
  document.getElementById("practiceAnswer").addEventListener("input", updateAnswerStats);
  document.querySelectorAll("[data-level]").forEach(button => button.addEventListener("click", () => {
    state.level = button.dataset.level; document.querySelectorAll("[data-level]").forEach(item => item.classList.toggle("active", item === button));
  }));
  document.getElementById("retryButton").addEventListener("click", resetPractice);
}

function practiceQuestions() { return state.jobs[0]?.questions?.length ? [...state.jobs[0].questions, fallbackQuestions[4]] : fallbackQuestions; }
function changeQuestion(amount) {
  const questions = practiceQuestions(); state.questionIndex = (state.questionIndex + amount + questions.length) % questions.length;
  document.getElementById("practiceAnswer").value = state.practiceAnswers[state.questionIndex] || ""; updateAnswerStats(); stopTimer(); state.seconds = 0; updateTimer(); loadPracticeQuestion();
}
function loadPracticeQuestion() {
  const questions = practiceQuestions();
  let question = questions[state.questionIndex % questions.length];
  if (state.questionIndex > 0 && state.practiceAnswers[state.questionIndex - 1]) question = makeFollowup(state.practiceAnswers[state.questionIndex - 1], question);
  document.getElementById("practiceQuestion").textContent = question;
  document.getElementById("questionNumber").textContent = `질문 ${state.questionIndex + 1} / ${questions.length}`;
}

function submitPracticeAnswer() {
  const answer = document.getElementById("practiceAnswer").value.trim();
  if (answer.length < 10) { toast("답변을 10자 이상 작성해 주세요."); return; }
  state.practiceAnswers[state.questionIndex] = answer; stopTimer();
  if (state.questionIndex >= practiceQuestions().length - 1) { showReport(); return; }
  state.questionIndex += 1; document.getElementById("practiceAnswer").value = state.practiceAnswers[state.questionIndex] || "";
  state.seconds = 0; updateTimer(); updateAnswerStats(); loadPracticeQuestion();
}

function makeFollowup(answer, fallback) {
  const excerpt = answer.replace(/\s+/g, " ").slice(0, 32);
  if (state.level === "압박") return `“${excerpt}”라고 했는데, 본인이 직접 만든 결과라는 근거가 무엇인가요?`;
  if (state.level === "심화") return `“${excerpt}” 경험에서 다른 방법 대신 그 행동을 선택한 이유는 무엇인가요?`;
  return fallback;
}

function updateAnswerStats() {
  const value = document.getElementById("practiceAnswer").value;
  document.getElementById("answerChars").textContent = `${value.length}자`;
  document.getElementById("fillerCount").textContent = `${(value.match(/어+|음+|약간|뭔가|그냥/g) || []).length}회`;
}

function showReport() {
  const text = state.practiceAnswers.join(" ");
  const average = text.length / Math.max(1, state.practiceAnswers.length);
  const keywords = (text.match(/경험|역할|행동|결과|성과|해결|개선|배웠/g) || []).length;
  const fillers = (text.match(/어+|음+|약간|뭔가|그냥/g) || []).length;
  const specific = Math.round(Math.max(30, Math.min(96, 45 + average * .25 + keywords * 3)));
  const structure = Math.round(Math.max(30, Math.min(95, 42 + keywords * 4)));
  const clarity = Math.round(Math.max(30, Math.min(98, 88 - fillers * 5 + (average > 45 ? 5 : 0))));
  const total = Math.round((specific + structure + clarity) / 3);
  document.querySelector(".interview-room").hidden = true; document.getElementById("reportPanel").hidden = false;
  document.getElementById("totalScore").textContent = total;
  document.getElementById("scoreMessage").textContent = total >= 80 ? "핵심 경험이 잘 드러나는 안정적인 답변이에요." : total >= 65 ? "조금만 더 구체화하면 훨씬 설득력 있어져요." : "답변을 상황 → 행동 → 결과 순으로 다시 정리해 보세요.";
  document.getElementById("metricList").innerHTML = [["구체성", specific], ["답변 구조", structure], ["표현 명확성", clarity]].map(([name, value]) => `<div><span>${name}<b>${value}</b></span><i><em style="width:${value}%"></em></i></div>`).join("");
  document.getElementById("reportGood").innerHTML = `<li>총 ${state.practiceAnswers.length}개 질문에 끝까지 답변했어요.</li><li>${keywords ? "경험과 결과를 나타내는 표현을 사용했어요." : "핵심 질문을 빠짐없이 확인했어요."}</li>`;
  document.getElementById("reportNext").innerHTML = `<li>${average < 50 ? "답변마다 구체적인 행동을 한 문장 더 추가하세요." : "각 답변의 핵심 결론을 첫 문장에 배치하세요."}</li><li>${fillers ? `습관어 ${fillers}회를 줄이고 잠깐 멈추는 연습을 해보세요.` : "성과를 숫자나 전후 변화로 표현해 보세요."}</li>`;
  document.getElementById("reportPanel").scrollIntoView({ behavior: "smooth" });
}

function resetPractice() {
  state.questionIndex = 0; state.practiceAnswers = []; state.seconds = 0; updateTimer();
  document.getElementById("practiceAnswer").value = ""; updateAnswerStats();
  document.querySelector(".interview-room").hidden = false; document.getElementById("reportPanel").hidden = true; loadPracticeQuestion();
}
function toggleTimer() { state.recording ? stopTimer() : startTimer(); }
function startTimer() {
  state.recording = true; state.seconds = 0; updateTimer(); document.getElementById("recordButton").classList.add("recording");
  document.querySelector("#recordButton span").textContent = "답변 종료"; state.timerId = setInterval(() => { state.seconds += 1; updateTimer(); }, 1000);
}
function stopTimer() {
  state.recording = false; clearInterval(state.timerId); state.timerId = null; document.getElementById("recordButton").classList.remove("recording");
  document.querySelector("#recordButton span").textContent = "답변 시작";
}
function updateTimer() {
  const min = String(Math.floor(state.seconds / 60)).padStart(2, "0"); const sec = String(state.seconds % 60).padStart(2, "0");
  document.getElementById("timer").textContent = `${min}:${sec}`;
}

function bindTheme() {
  if (localStorage.getItem("interview-theme") === "dark") document.body.classList.add("dark"); updateThemeIcon();
  document.getElementById("themeButton").addEventListener("click", () => {
    document.body.classList.toggle("dark"); localStorage.setItem("interview-theme", document.body.classList.contains("dark") ? "dark" : "light"); updateThemeIcon();
  });
}
function updateThemeIcon() { document.getElementById("themeButton").textContent = document.body.classList.contains("dark") ? "☾" : "☀"; }

function renderAll() { renderProgress(); renderRecentJobs(); renderStories(); renderCoverStories(); }
function renderProgress() {
  const complete = [state.jobs.length > 0, state.stories.length > 0, state.intro.length > 30 || state.cover.length > 80, state.practiceAnswers.length >= 5];
  const percent = Math.round(complete.filter(Boolean).length / complete.length * 100);
  document.getElementById("progressText").textContent = `${percent}% 완료`; document.getElementById("progressBar").style.width = `${percent}%`;
  document.querySelectorAll("#progressSteps .step").forEach((step, index) => step.classList.toggle("done", complete[index]));
}
function renderRecentJobs() {
  const box = document.getElementById("recentJobs");
  if (!state.jobs.length) { box.className = "empty-state"; box.innerHTML = "<span>▤</span><b>아직 등록한 공고가 없어요</b><p>관심 있는 채용공고 링크부터 등록해 보세요.</p>"; return; }
  box.className = "job-list";
  box.innerHTML = state.jobs.slice(0, 3).map(job => `<button data-page="practice" type="button"><span class="company-avatar">${escapeHtml(job.company.slice(0, 1).toUpperCase())}</span><span><b>${escapeHtml(job.role)}</b><small>${escapeHtml(job.company)} · 예상 질문 ${job.questions.length}개</small></span><i>›</i></button>`).join("");
}
function renderStories() {
  document.getElementById("storyList").innerHTML = state.stories.map(story => `<article class="card saved-story"><span>저장된 경험</span><h3>${escapeHtml(story.title)}</h3><p>${escapeHtml(story.result || story.action || "상세 내용을 더 작성해 보세요.")}</p></article>`).join("");
}
function renderCoverStories() {
  const select = document.getElementById("coverStory"); if (!select) return;
  const selected = select.value;
  select.innerHTML = `<option value="">저장된 경험을 선택하세요</option>${state.stories.map(story => `<option value="${story.id}">${escapeHtml(story.title)}</option>`).join("")}`;
  select.value = selected;
}
function toast(message) {
  const el = document.getElementById("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}
function escapeHtml(value = "") { return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
