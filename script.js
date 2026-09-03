const appState = {
  companies: readData("mk-companies", []),
  covers: readData("mk-covers", []),
  records: readData("mk-records", []),
  interviewIndex: 0,
  interviewAnswers: [],
  startedAt: 0
};

const interviewQuestions = [
  "간단한 자기소개와 함께 지원 동기를 말씀해 주세요.",
  "본인의 강점을 실제 경험과 함께 설명해 주세요.",
  "협업 중 의견 충돌이 생겼을 때 어떻게 해결했나요?",
  "실패하거나 목표를 달성하지 못한 경험에서 무엇을 배웠나요?",
  "입사 후 가장 먼저 기여하고 싶은 부분은 무엇인가요?"
];

document.addEventListener("DOMContentLoaded", () => {
  bindButtons();
  renderSavedCards();
  const requestedAction = new URLSearchParams(location.search).get("open");
  if (["company", "cover", "interview", "report", "history"].includes(requestedAction)) handleAction(requestedAction);
});

function readData(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bindButtons() {
  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button));
  });

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => changeTab(button.dataset.tab, button));
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", event => {
    if (event.target === event.currentTarget) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });
  document.getElementById("logoutButton").addEventListener("click", () => toast("현재 기기에서 안전하게 로그아웃했어요."));
}

function handleAction(action, source) {
  document.querySelectorAll(".menu-item").forEach(item => item.classList.toggle("active", item.dataset.action === action));
  if (action === "dashboard") {
    closeModal();
    document.querySelector(".hero").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (action === "company") showCompanyModal();
  if (action === "cover") showCoverModal();
  if (action === "interview") startInterview();
  if (action === "report") showReportModal();
  if (action === "history") showHistoryModal();
  source?.blur();
}

function openModal(step, title, description, content) {
  document.getElementById("modalStep").textContent = step;
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalDescription").textContent = description;
  document.getElementById("modalContent").innerHTML = content;
  document.getElementById("modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("modalClose").focus();
}

function closeModal() {
  document.getElementById("modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

function showCompanyModal() {
  openModal("STEP 1", "지원 정보 관리", "지원할 기업과 직무를 저장해 면접 준비에 활용하세요.", `
    <form class="modal-form" id="companyForm">
      <label>기업명<input id="companyName" required placeholder="예: 면접콕"></label>
      <label>지원 직무<input id="companyRole" required placeholder="예: 프론트엔드 개발자"></label>
      <label>채용공고 링크<input id="companyUrl" type="url" placeholder="https://..."></label>
      <div class="modal-actions"><button class="modal-secondary" data-close type="button">취소</button><button class="modal-primary" type="submit">기업 저장</button></div>
    </form>`);
  document.querySelector("[data-close]").addEventListener("click", closeModal);
  document.getElementById("companyForm").addEventListener("submit", event => {
    event.preventDefault();
    appState.companies.unshift({ id: Date.now(), name: valueOf("companyName"), role: valueOf("companyRole"), url: valueOf("companyUrl") });
    saveData("mk-companies", appState.companies); renderSavedCards(); updateProgress(1); closeModal(); toast("지원 기업을 저장했어요.");
  });
}

function showCoverModal() {
  const companyOptions = appState.companies.map(item => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.role)}</option>`).join("");
  openModal("STEP 3", "자기소개서 준비", "문항을 선택하고 경험을 연결해 500자 이내로 작성하세요.", `
    <div class="modal-form">
      <label>지원 기업<select id="coverCompany"><option value="">기업을 선택하세요</option>${companyOptions}</select></label>
      <label>자기소개서 문항<select id="coverQuestion"><option>지원 동기</option><option>직무 역량</option><option>협업 경험</option><option>성격의 장단점</option><option>입사 후 포부</option></select></label>
      <label>경험 또는 강점<textarea id="coverExperience" rows="3" placeholder="활용할 경험과 본인의 행동을 적어주세요."></textarea></label>
      <button class="modal-secondary" id="draftButton" type="button">초안 만들기</button>
      <label>자기소개서<textarea id="coverText" maxlength="500" rows="8" placeholder="직접 작성하거나 초안을 만들어 보세요."></textarea><small id="coverCount">0/500자</small></label>
      <div class="modal-actions"><button class="modal-secondary" id="analyzeCover" type="button">내용 분석</button><button class="modal-primary" id="saveCover" type="button">저장하기</button></div>
    </div>`);

  const coverText = document.getElementById("coverText");
  coverText.addEventListener("input", () => document.getElementById("coverCount").textContent = `${coverText.value.length}/500자`);
  document.getElementById("draftButton").addEventListener("click", () => {
    const experience = valueOf("coverExperience");
    if (!experience) return toast("초안에 활용할 경험을 먼저 적어주세요.");
    const selectedId = Number(valueOf("coverCompany"));
    const company = appState.companies.find(item => item.id === selectedId);
    const role = company?.role || "지원 직무";
    coverText.value = `저는 ${experience} 경험을 통해 문제를 구체적으로 정의하고 끝까지 실행하는 힘을 길렀습니다. 이 과정에서 맡은 역할의 우선순위를 정하고 구성원과 적극적으로 소통해 의미 있는 결과를 만들었습니다. 이러한 경험을 ${role}에서도 활용하여 팀의 목표 달성에 기여하겠습니다.`.slice(0, 500);
    coverText.dispatchEvent(new Event("input"));
  });
  document.getElementById("analyzeCover").addEventListener("click", analyzeCover);
  document.getElementById("saveCover").addEventListener("click", () => {
    const text = coverText.value.trim();
    if (text.length < 30) return toast("자기소개서를 30자 이상 작성해 주세요.");
    appState.covers.unshift({ id: Date.now(), question: valueOf("coverQuestion"), text });
    saveData("mk-covers", appState.covers); updateProgress(3); closeModal(); toast("자기소개서를 저장했어요.");
  });
}

function analyzeCover() {
  const text = valueOf("coverText");
  if (text.length < 50) return toast("분석하려면 50자 이상 작성해 주세요.");
  const concrete = (text.match(/\d+|결과|성과|개선|달성/g) || []).length;
  const action = (text.match(/직접|실행|제안|조율|분석|해결/g) || []).length;
  const score = Math.min(95, 55 + concrete * 5 + action * 4);
  document.getElementById("modalContent").insertAdjacentHTML("beforeend", `<div class="analysis-box"><span class="analysis-score">${score}</span>점<br>${concrete < 2 ? "결과를 수치나 전후 변화로 더 구체화해 보세요." : "성과가 잘 드러나요."}<br>${action < 2 ? "본인이 직접 한 행동을 동사로 표현하면 더 좋아요." : "행동 중심으로 잘 작성했어요."}</div>`);
  updateProgress(4);
}

function startInterview() {
  appState.interviewIndex = 0; appState.interviewAnswers = []; appState.startedAt = Date.now(); renderInterviewQuestion();
}

function renderInterviewQuestion() {
  const index = appState.interviewIndex;
  openModal("STEP 5", "모의면접", "실제 면접처럼 질문을 읽고 구체적으로 답변해 보세요.", `
    <div class="modal-meta"><b>질문 ${index + 1} / ${interviewQuestions.length}</b><span>답변 내용 기반 분석</span></div>
    <div class="modal-question">${escapeHtml(interviewQuestions[index])}</div>
    <div class="modal-form"><label>답변<textarea id="interviewAnswer" rows="7" placeholder="상황 → 행동 → 결과 순서로 답변해 보세요."></textarea></label>
    <div class="modal-actions"><button class="modal-secondary" id="endInterview" type="button">연습 종료</button><button class="modal-primary" id="nextInterview" type="button">${index === interviewQuestions.length - 1 ? "결과 보기" : "다음 질문"}</button></div></div>`);
  document.getElementById("endInterview").addEventListener("click", closeModal);
  document.getElementById("nextInterview").addEventListener("click", () => {
    const answer = valueOf("interviewAnswer");
    if (answer.length < 10) return toast("답변을 10자 이상 작성해 주세요.");
    appState.interviewAnswers.push(answer);
    if (index < interviewQuestions.length - 1) { appState.interviewIndex += 1; renderInterviewQuestion(); } else { finishInterview(); }
  });
}

function finishInterview() {
  const joined = appState.interviewAnswers.join(" ");
  const keywords = (joined.match(/경험|역할|행동|결과|성과|해결|개선/g) || []).length;
  const average = joined.length / appState.interviewAnswers.length;
  const score = Math.round(Math.max(45, Math.min(96, 50 + keywords * 3 + average * .18)));
  const record = { id: Date.now(), score, date: new Date().toLocaleDateString("ko-KR"), answers: appState.interviewAnswers.length };
  appState.records.unshift(record); saveData("mk-records", appState.records); renderSavedCards(); updateProgress(5); showReportModal();
}

function showReportModal() {
  const latest = appState.records[0];
  if (!latest) {
    openModal("REPORT", "분석 리포트", "모의면접을 완료하면 분석 결과를 확인할 수 있어요.", `<div class="analysis-box">아직 분석할 면접 기록이 없어요.<div class="modal-actions"><button class="modal-primary" id="goInterview" type="button">면접 시작</button></div></div>`);
    document.getElementById("goInterview").addEventListener("click", startInterview); return;
  }
  openModal("REPORT", "분석 리포트", `${latest.date} 모의면접 결과입니다.`, `<div class="analysis-box"><span class="analysis-score">${latest.score}</span>점<br>${latest.score >= 80 ? "핵심 경험이 잘 드러나는 안정적인 답변이에요." : "행동과 결과를 조금 더 구체적으로 말해보세요."}<br>다음 연습에서는 답변 첫 문장에 결론을 먼저 배치해 보세요.</div><div class="modal-actions"><button class="modal-primary" id="retryInterview" type="button">다시 연습</button></div>`);
  document.getElementById("retryInterview").addEventListener("click", startInterview);
}

function showHistoryModal() {
  const items = appState.records.length ? appState.records.map((record, index) => `<div class="history-item"><span>${escapeHtml(record.date)} · 모의면접 ${appState.records.length - index}회차</span><b>${record.score}</b></div>`).join("") : `<div class="analysis-box">저장된 성장 기록이 없어요. 첫 모의면접을 시작해 보세요.</div>`;
  openModal("HISTORY", "성장 기록", "연습 결과를 비교하며 발전한 모습을 확인하세요.", `<div class="history-list">${items}</div>`);
}

function changeTab(tabId, clickedButton) {
  document.querySelectorAll(".tab-button").forEach(button => button.classList.toggle("active", button === clickedButton));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === tabId));
}

function renderSavedCards() {
  const companyBox = document.getElementById("companyCards");
  document.getElementById("companyEmpty").style.display = appState.companies.length ? "none" : "block";
  companyBox.innerHTML = appState.companies.slice(0, 4).map(item => `<div class="record-card"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.role)}</span></div>`).join("");
  const recordBox = document.getElementById("recordCards");
  document.getElementById("recordEmpty").style.display = appState.records.length ? "none" : "block";
  recordBox.innerHTML = appState.records.slice(0, 4).map(item => `<div class="record-card"><strong>모의면접 · ${item.score}점</strong><span>${escapeHtml(item.date)}</span></div>`).join("");
}

function updateProgress(stepNumber) {
  document.querySelectorAll(".step").forEach((step, index) => step.classList.toggle("active", index + 1 === stepNumber));
}

function valueOf(id) { return document.getElementById(id)?.value.trim() || ""; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function toast(message) {
  const element = document.getElementById("toast"); element.textContent = message; element.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove("show"), 2300);
}
