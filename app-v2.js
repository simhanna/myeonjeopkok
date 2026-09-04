(() => {
  "use strict";

  const PROJECTS_KEY = "mk_projects_v2";
  const ACTIVE_KEY = "mk_active_project_v2";
  const VAULT_KEY = "mk_experience_vault_v2";
  const MIGRATION_KEY = "mk_v2_migrated";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const todayText = () => new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const nowIso = () => new Date().toISOString();
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  let projects = [];
  let vault = [];
  let activeProjectId = null;
  let creatingProject = false;

  function projectById(id = activeProjectId) {
    return projects.find(project => String(project.id) === String(id)) || null;
  }

  function dday(date) {
    if (!date) return "일정 미등록";
    const target = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((target - today) / 86400000);
    if (days === 0) return "D-day";
    return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
  }

  function questionText() {
    const type = $("#questionType")?.value || "";
    return type === "custom" ? ($("#customQuestion")?.value.trim() || "직접 입력 문항") : type;
  }

  function migrateLegacyData() {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const legacyCompanies = read("mk_companies", []);
    const legacyCovers = read("mk_company_covers", []);
    const legacyHistory = read("mk_hist", []);
    const existingProjects = read(PROJECTS_KEY, []);
    if (!existingProjects.length && legacyCompanies.length) {
      const migrated = legacyCompanies.map((company, index) => ({
        id: company.id || Date.now() + index,
        type: /대학|학교/.test(company.name || "") || company.field === "대학 입학" ? "school" : "company",
        targetName: company.name || "이전 지원처",
        role: company.role || "",
        field: company.field || "",
        organizationInfo: company.summary || "",
        idealTalent: "",
        coreCompetencies: "",
        interviewDate: company.interviewDate || "",
        scheduleNotes: "",
        covers: legacyCovers.filter(cover => String(cover.companyId) === String(company.id)).map(cover => ({
          id: cover.id || Date.now() + Math.random(),
          question: cover.question || "작성 문항",
          text: cover.text || "",
          analysis: "",
          experienceIds: [],
          createdAt: cover.updated || todayText(),
          updatedAt: cover.updated || todayText()
        })),
        analysisResults: [],
        interviews: index === 0 ? legacyHistory : [],
        expectedQuestions: [],
        experienceIds: [],
        favorite: !!company.fav,
        aiAnalysis: company.summary || "",
        createdAt: company.date || todayText(),
        updatedAt: company.date || todayText()
      }));
      write(PROJECTS_KEY, migrated);
    }

    const oldExperiences = read("mk_experiences", []);
    const existingVault = read(VAULT_KEY, []);
    if (!existingVault.length && oldExperiences.length) {
      write(VAULT_KEY, oldExperiences.map((item, index) => ({
        id: item.id || Date.now() + index,
        title: (item.experience || "저장한 경험").slice(0, 40),
        period: "",
        organizationRole: "",
        activity: item.experience || "",
        problem: "",
        action: "",
        result: "",
        learning: "",
        strengths: item.strength || "",
        keywords: [],
        favorite: false,
        createdAt: item.date || todayText(),
        updatedAt: item.date || todayText()
      })));
    }
    localStorage.setItem(MIGRATION_KEY, "1");
  }

  function persistProjects() {
    write(PROJECTS_KEY, projects);
  }

  function persistVault() {
    write(VAULT_KEY, vault);
  }

  function syncLegacy(project) {
    if (!project) {
      write("mk_companies", []);
      write("mk_company_covers", []);
      write("mk_hist", []);
      return;
    }
    write("mk_companies", [{
      id: project.id,
      name: project.targetName,
      role: project.role,
      field: project.field,
      interviewDate: project.interviewDate,
      fav: !!project.favorite,
      date: project.updatedAt || project.createdAt,
      summary: project.organizationInfo || autoSummary(project)
    }]);
    write("mk_company_covers", (project.covers || []).map(cover => ({
      id: cover.id,
      companyId: project.id,
      question: cover.question,
      text: cover.text,
      updated: cover.updatedAt
    })));
    write("mk_hist", project.interviews || []);
  }

  function autoSummary(project) {
    const school = project.type === "school";
    const target = project.targetName || (school ? "학교" : "기업");
    const role = project.role || (school ? "학과" : "직무");
    return school
      ? `${target} ${role} 지원에서는 전공 관심을 보여주는 활동과 입학 후 학업 계획의 연결이 중요해요.`
      : `${target} ${role} 지원에서는 직무에 필요한 역량을 실제 행동과 결과로 증명하는 것이 중요해요.`;
  }

  function setActiveProject(id, reloadForIsolation = false, openDetail = false) {
    activeProjectId = id == null ? null : String(id);
    if (activeProjectId) localStorage.setItem(ACTIVE_KEY, activeProjectId);
    else localStorage.removeItem(ACTIVE_KEY);
    const project = projectById();
    syncLegacy(project);
    if (reloadForIsolation) {
      if (openDetail && project) sessionStorage.setItem("mk_v2_open_detail", String(project.id));
      location.reload();
    }
  }

  function go(screen) {
    $$(".screen").forEach(item => item.classList.remove("on"));
    $("#" + screen)?.classList.add("on");
    const navTarget = screen === "companyDetail" ? "home" : screen;
    $$(".nav,.bottom button").forEach(item => item.classList.toggle("on", item.dataset.go === navTarget));
    const stepMap = { profile: 1, experience: 2, cover: 3, analysis: 4, setup: 5, interview: 5, remoteInterview: 5 };
    const step = stepMap[screen] || 0;
    $$(".step").forEach(item => {
      const number = Number(item.dataset.step);
      item.classList.toggle("active", number === step);
      item.classList.toggle("done", step > 0 && number < step);
    });
    if (screen === "home") renderProjects();
    if (screen === "experience") renderVault();
    if (screen === "cover") renderExperienceChoices();
    if (screen === "history") renderProjectHistory();
    scrollTo(0, 0);
  }

  function updateProjectLabels() {
    const school = $("#projectType")?.value === "school";
    if ($("#companyLabel")) $("#companyLabel").textContent = school ? "지원 학교 *" : "지원 기업 *";
    if ($("#roleLabel")) $("#roleLabel").textContent = school ? "지원 학과 *" : "지원 직무 *";
    if ($("#company")) $("#company").placeholder = school ? "예: 공주대학교" : "예: 삼성전자";
    if ($("#role")) $("#role").placeholder = school ? "예: 경영학과" : "예: 마케팅";
    if (school && $("#field") && !$("#field").value) $("#field").value = "대학 입학";
  }

  function fillProjectForm(project) {
    $("#projectType").value = project?.type || "company";
    $("#company").value = project?.targetName || "";
    $("#role").value = project?.role || "";
    $("#field").value = project?.field || "";
    $("#organizationInfo").value = project?.organizationInfo || "";
    $("#idealTalent").value = project?.idealTalent || "";
    $("#coreCompetencies").value = project?.coreCompetencies || "";
    $("#interviewDate").value = project?.interviewDate || "";
    $("#scheduleNotes").value = project?.scheduleNotes || "";
    updateProjectLabels();
    validateProjectForm();
  }

  function validateProjectForm() {
    const valid = $("#company").value.trim() && $("#role").value.trim() && $("#field").value;
    const button = $("#profileNext");
    if (button) {
      button.disabled = !valid;
      button.classList.toggle("active", !!valid);
    }
    return !!valid;
  }

  function startNewProject() {
    creatingProject = true;
    fillProjectForm(null);
    $("#saveCompany").textContent = "새 프로젝트 저장";
    go("profile");
  }

  function normalizedProjectValue(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function hasIdenticalProject(candidate, ignoredId) {
    const fields = [
      "type", "targetName", "role", "field", "organizationInfo",
      "idealTalent", "coreCompetencies", "interviewDate", "scheduleNotes"
    ];
    return projects.some(project => {
      if (String(project.id) === String(ignoredId)) return false;
      return fields.every(field => normalizedProjectValue(project[field]) === normalizedProjectValue(candidate[field]));
    });
  }

  function saveProject(options = {}) {
    if (!validateProjectForm()) {
      alert("기업·학교, 직무·학과, 지원 분야를 모두 입력해주세요.");
      return null;
    }
    const existing = creatingProject ? null : projectById();
    const stamp = todayText();
    const values = {
      type: $("#projectType").value,
      targetName: $("#company").value.trim(),
      role: $("#role").value.trim(),
      field: $("#field").value,
      organizationInfo: $("#organizationInfo").value.trim(),
      idealTalent: $("#idealTalent").value.trim(),
      coreCompetencies: $("#coreCompetencies").value.trim(),
      interviewDate: $("#interviewDate").value,
      scheduleNotes: $("#scheduleNotes").value.trim(),
      updatedAt: stamp
    };
    if (hasIdenticalProject(values, existing?.id)) {
      alert("이미 동일한 정보가 저장되어 있습니다.");
      return null;
    }
    values.aiAnalysis = autoSummary(values);
    let project;
    if (existing) {
      Object.assign(existing, values);
      project = existing;
    } else {
      project = {
        id: Date.now(),
        ...values,
        covers: [],
        analysisResults: [],
        interviews: [],
        expectedQuestions: [],
        experienceIds: [],
        favorite: false,
        createdAt: stamp
      };
      projects.unshift(project);
    }
    creatingProject = false;
    activeProjectId = String(project.id);
    localStorage.setItem(ACTIVE_KEY, activeProjectId);
    persistProjects();
    syncLegacy(project);
    renderProjects();
    if (!options.silent) alert("프로젝트를 저장했어요.");
    return project;
  }

  function projectCard(project, dashboard = false) {
    const linkedExperiences = (project.experienceIds || []).length;
    const covers = (project.covers || []).length;
    const interviews = (project.interviews || []).length;
    if (dashboard) {
      return `<article class="project-card ${String(project.id) === String(activeProjectId) ? "active" : ""}" tabindex="0" data-project-open="${project.id}">
        <div class="project-dday">${safe(dday(project.interviewDate))}</div>
        <div class="muted">${project.type === "school" ? "대학 입학" : "기업 취업"} 프로젝트</div>
        <h4>${safe(project.targetName)}</h4>
        <div>${safe(project.role)}</div>
        <div class="project-meta"><span class="project-tag">${safe(project.field)}</span><span class="project-tag">경험 ${linkedExperiences}</span><span class="project-tag">자소서 ${covers}</span><span class="project-tag">면접 ${interviews}</span></div>
        <div class="muted">최근 수정 ${safe(project.updatedAt || project.createdAt)}</div>
        <div class="project-card-actions"><button data-project-edit="${project.id}">수정</button><button class="danger" data-project-delete="${project.id}">삭제</button></div>
      </article>`;
    }

    const targetLines = String(project.targetName || "").split(/\s*(?:\/|\n)\s*/).filter(Boolean);
    const roleLines = String(project.role || "").split(/\s*(?:\/|\n)\s*/).filter(Boolean);
    const roleMeta = [...roleLines, project.field].filter((value, index, values) => value && values.findIndex(item => normalizedProjectValue(item) === normalizedProjectValue(value)) === index);
    const analysis = project.aiAnalysis || autoSummary(project);
    const showMore = analysis.length > 85;
    return `<article class="project-card saved-project-card ${String(project.id) === String(activeProjectId) ? "active" : ""}" tabindex="0" data-project-load="${project.id}">
      <button class="star project-favorite ${project.favorite ? "on" : ""}" type="button" data-project-favorite="${project.id}" aria-label="${project.favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}" aria-pressed="${project.favorite ? "true" : "false"}">★</button>
      <div class="saved-project-type">${project.type === "school" ? "대학 입학" : "기업 취업"}</div>
      <div class="saved-project-names">
        <h4>${safe(targetLines[0] || project.targetName)}</h4>
        ${targetLines.slice(1).map(name => `<div class="saved-project-secondary">${safe(name)}</div>`).join("")}
      </div>
      <div class="saved-project-role">${safe(roleMeta.join(" · "))}</div>
      <div class="project-ai-summary">${safe(analysis)}</div>
      ${showMore ? `<button class="project-summary-toggle" type="button" data-project-summary-toggle="${project.id}" aria-expanded="false">더보기</button>` : ""}
      <div class="saved-project-date">저장 ${safe(project.updatedAt || project.createdAt)}</div>
    </article>`;
  }

  function loadProjectIntoForm(id) {
    const project = projectById(id);
    if (!project) return;
    activeProjectId = String(project.id);
    localStorage.setItem(ACTIVE_KEY, activeProjectId);
    syncLegacy(project);
    creatingProject = false;
    fillProjectForm(project);
    $("#saveCompany").textContent = "프로젝트 수정 저장";
    renderProjects();
    go("profile");
  }

  function bindProjectCards() {
    $$("[data-project-open]").forEach(card => {
      const open = event => {
        if (event.target.closest("[data-project-edit],[data-project-delete]")) return;
        const id = card.dataset.projectOpen;
        if (String(activeProjectId) !== String(id)) setActiveProject(id, true, true);
        else showProjectDetail(projectById(id));
      };
      card.onclick = open;
      card.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(event);
        }
      };
    });
    $$("[data-project-load]").forEach(card => {
      const load = event => {
        if (event.target.closest("[data-project-favorite],[data-project-summary-toggle]")) return;
        loadProjectIntoForm(card.dataset.projectLoad);
      };
      card.onclick = load;
      card.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          load(event);
        }
      };
    });
    $$("[data-project-favorite]").forEach(button => button.onclick = event => {
      event.stopPropagation();
      const project = projectById(button.dataset.projectFavorite);
      if (!project) return;
      project.favorite = !project.favorite;
      persistProjects();
      if (String(project.id) === String(activeProjectId)) syncLegacy(project);
      renderProjects();
    });
    $$("[data-project-summary-toggle]").forEach(button => button.onclick = event => {
      event.stopPropagation();
      const summary = button.closest(".saved-project-card")?.querySelector(".project-ai-summary");
      if (!summary) return;
      const expanded = summary.classList.toggle("expanded");
      button.textContent = expanded ? "접기" : "더보기";
      button.setAttribute("aria-expanded", String(expanded));
    });
    $$("[data-project-edit]").forEach(button => button.onclick = event => {
      event.stopPropagation();
      const project = projectById(button.dataset.projectEdit);
      if (!project) return;
      if (String(activeProjectId) !== String(project.id)) {
        localStorage.setItem(ACTIVE_KEY, String(project.id));
        syncLegacy(project);
        sessionStorage.setItem("mk_v2_edit_project", String(project.id));
        location.reload();
        return;
      }
      creatingProject = false;
      fillProjectForm(project);
      $("#saveCompany").textContent = "프로젝트 수정 저장";
      go("profile");
    });
    $$("[data-project-delete]").forEach(button => button.onclick = event => {
      event.stopPropagation();
      deleteProject(button.dataset.projectDelete);
    });
  }

  function renderProjects() {
    const dashboard = $("#projectDashboard");
    const side = $("#companyList");
    const empty = '<div class="empty-state">아직 프로젝트가 없어요.<br>새 프로젝트를 만들어 지원 준비를 시작해보세요.</div>';
    if (dashboard) dashboard.innerHTML = projects.length ? projects.map(project => projectCard(project, true)).join("") : empty;
    const savedProjects = [...projects].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite));
    if (side) side.innerHTML = savedProjects.length ? savedProjects.map(project => projectCard(project, false)).join("") : '<div class="muted">저장된 프로젝트가 없어요.</div>';
    bindProjectCards();
    renderRightRecords();
  }

  function ensureRightCardTabs() {
    const tabs = $(".company-tabs");
    const companyList = $("#companyList");
    const records = $("#rightRecords");
    if (!tabs || !companyList || !records) return;

    if (!tabs.querySelector('[data-tab="experiences"]')) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tab = "experiences";
      button.textContent = "경험·강점";
      tabs.insertBefore(button, tabs.querySelector('[data-tab="records"]'));
    }
    if (!$("#rightExperiences")) {
      const panel = document.createElement("div");
      panel.id = "rightExperiences";
      panel.style.display = "none";
      companyList.insertAdjacentElement("afterend", panel);
    }

    $$(".company-tabs button").forEach(button => button.onclick = () => {
      const tab = button.dataset.tab;
      $$(".company-tabs button").forEach(item => item.classList.toggle("on", item === button));
      $("#companyList").style.display = tab === "companies" ? "block" : "none";
      $("#rightExperiences").style.display = tab === "experiences" ? "block" : "none";
      $("#rightRecords").style.display = tab === "records" ? "block" : "none";
      if (tab === "experiences") renderRightExperiences();
      if (tab === "records") renderRightRecords();
    });
  }

  function renderRightExperiences() {
    const panel = $("#rightExperiences");
    if (!panel) return;
    const items = [...vault].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite));
    panel.innerHTML = items.length ? items.map(item => `
      <article class="right-experience-card" tabindex="0" data-right-experience="${item.id}">
        <button class="star ${item.favorite ? "on" : ""}" type="button" data-right-exp-favorite="${item.id}" aria-label="${item.favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}">★</button>
        <b>${safe(item.title)}</b>
        <div class="right-experience-strength">${safe(item.strengths || "강점 미입력")}</div>
        <div class="muted">${safe((item.activity || "").slice(0, 90))}${(item.activity || "").length > 90 ? "…" : ""}</div>
      </article>`).join("") : '<div class="muted">저장된 경험·강점이 없어요.</div>';

    $$("[data-right-experience]").forEach(card => {
      const open = event => {
        if (event.target.closest("[data-right-exp-favorite]")) return;
        go("experience");
        loadExperienceEditor(card.dataset.rightExperience);
      };
      card.onclick = open;
      card.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(event);
        }
      };
    });
    $$("[data-right-exp-favorite]").forEach(button => button.onclick = event => {
      event.stopPropagation();
      const item = vault.find(entry => String(entry.id) === String(button.dataset.rightExpFavorite));
      if (!item) return;
      item.favorite = !item.favorite;
      persistVault();
      renderVault();
    });
  }

  function deleteProject(id) {
    const project = projectById(id);
    if (!project || !confirm(`"${project.targetName} ${project.role}" 프로젝트를 삭제할까요?\n공용 경험 보관함의 경험은 삭제되지 않습니다.`)) return;
    projects = projects.filter(item => String(item.id) !== String(id));
    persistProjects();
    if (String(activeProjectId) === String(id)) {
      const next = projects[0] || null;
      if (next) setActiveProject(next.id, true, false);
      else {
        setActiveProject(null, false, false);
        fillProjectForm(null);
        renderProjects();
        go("home");
      }
    } else {
      renderProjects();
    }
  }

  function detailModel(project) {
    const school = project.type === "school";
    const defaults = school
      ? {
        keywords: "전공 적합성 · 학업 의지 · 성장 가능성",
        cover: "지원 계기와 관련 활동을 입학 후 학업 계획으로 연결하세요.",
        interview: "학교·학과 선택 이유와 구체적인 학업 계획을 준비하세요."
      }
      : {
        keywords: "직무 역량 · 문제 해결 · 협업과 실행",
        cover: "직무에 필요한 역량을 실제 행동과 결과로 증명하세요.",
        interview: "지원 동기, 본인의 역할, 행동의 근거와 성과를 준비하세요."
      };
    return {
      keywords: project.coreCompetencies || defaults.keywords,
      cover: defaults.cover,
      interview: defaults.interview,
      talent: project.idealTalent || "등록된 인재상이 없어요. 지원처 정보에서 추가할 수 있어요.",
      info: project.organizationInfo || autoSummary(project)
    };
  }

  async function loadPublicInfo(project) {
    const box = $("#detailOrgInfo");
    if (!box) return;
    box.innerHTML = "<b>공개 정보를 찾고 있어요.</b><br>면접콕 화면 안에서 잠시 후 바로 보여드릴게요.";
    const normalize = value => String(value).replace(/주식회사|㈜|학교법인|\s|[^가-힣a-zA-Z0-9]/g, "").toLowerCase();
    try {
      const name = encodeURIComponent(project.targetName);
      const response = await fetch(`https://ko.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${name}&gsrlimit=1&prop=extracts&exintro=1&explaintext=1&format=json&origin=*`);
      const data = await response.json();
      const page = Object.values(data.query?.pages || {})[0];
      if (page?.extract && (normalize(page.title).includes(normalize(project.targetName)) || normalize(project.targetName).includes(normalize(page.title)))) {
        box.innerHTML = `<b>${safe(page.title)} 공개 정보</b><br>${safe(page.extract.slice(0, 900))}<div class="muted" style="margin-top:9px">공개 자료 출처: 한국어 위키백과 · 면접콕 화면 내 요약</div>`;
      } else {
        box.innerHTML = `<b>${safe(project.targetName)} 프로젝트 정보</b><br>${safe(project.organizationInfo || autoSummary(project))}<div class="muted" style="margin-top:9px">정확한 공개 요약을 찾지 못해 프로젝트에 저장한 정보를 표시했어요.</div>`;
      }
    } catch {
      box.innerHTML = `<b>${safe(project.targetName)} 프로젝트 정보</b><br>${safe(project.organizationInfo || autoSummary(project))}`;
    }
  }

  function showProjectDetail(project) {
    if (!project) return;
    const model = detailModel(project);
    $("#detailName").textContent = project.targetName;
    $("#detailRole").textContent = `${project.role} · ${project.type === "school" ? "대학 입학 프로젝트" : "기업 취업 프로젝트"}`;
    $("#detailField").textContent = project.field;
    $("#detailInterviewDate").textContent = project.interviewDate || "미등록";
    $("#detailDday").textContent = dday(project.interviewDate);
    $("#detailDate").textContent = project.updatedAt || project.createdAt;
    $("#detailAnalysis").innerHTML = `<b>AI 지원 분석 요약</b><br>${safe(autoSummary(project))}<br><br><b>지원처에 맞춘 준비 방향</b><br>${safe(model.cover)}`;
    $("#detailInsights").innerHTML = `
      <div class="insight-card"><b>기업 · 학교 정보</b><p>${safe(model.info)}</p></div>
      <div class="insight-card"><b>원하는 인재상</b><p>${safe(model.talent)}</p></div>
      <div class="insight-card"><b>필요한 핵심 역량</b><p>${safe(model.keywords)}</p></div>
      <div class="insight-card"><b>면접 예상 포인트</b><p>${safe(model.interview)}</p></div>
      <div class="insight-card"><b>채용 · 면접 일정</b><p>${safe(project.scheduleNotes || "등록된 일정 메모가 없어요.")}</p></div>
      <div class="insight-card"><b>최근 준비 현황</b><p>연결 경험 ${(project.experienceIds || []).length}개 · 자기소개서 ${(project.covers || []).length}개 · 면접 기록 ${(project.interviews || []).length}개</p></div>`;
    $("#detailCovers").innerHTML = (project.covers || []).length
      ? project.covers.map(cover => `<div class="detail-cover"><b>${safe(cover.question)}</b><p>${safe(cover.text)}</p>${cover.analysis ? `<div class="muted" style="margin-top:8px">AI 분석: ${safe(cover.analysis.slice(0, 180))}</div>` : ""}<div class="muted" style="margin-top:7px">최근 수정 ${safe(cover.updatedAt)}</div></div>`).join("")
      : '<div class="info">이 프로젝트에 작성한 자기소개서가 아직 없어요. 작성하면 이곳에 자동으로 연결됩니다.</div>';
    $("#detailLoad").onclick = () => {
      creatingProject = false;
      fillProjectForm(project);
      $("#saveCompany").textContent = "프로젝트 수정 저장";
      go("profile");
    };
    $("#detailCoverOpen").onclick = () => {
      fillProjectForm(project);
      const cover = (project.covers || [])[0];
      if (cover) {
        $("#coverText").value = cover.text;
        const option = [...$("#questionType").options].find(item => item.value === cover.question);
        if (option) $("#questionType").value = cover.question;
      }
      renderExperienceChoices();
      updateCoverState();
      go("cover");
    };
    loadPublicInfo(project);
    go("companyDetail");
  }

  function experienceText(item) {
    return [item.title, item.activity, item.problem, item.action, item.result, item.learning, item.strengths, ...(item.keywords || [])].join(" ");
  }

  function tokens(text) {
    return [...new Set(String(text).toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || [])];
  }

  function duplicateExperience(candidate, ignoredId) {
    const targetTokens = tokens(experienceText(candidate));
    return vault.find(item => {
      if (String(item.id) === String(ignoredId)) return false;
      if (item.title.trim().toLowerCase() === candidate.title.trim().toLowerCase()) return true;
      const existingTokens = tokens(experienceText(item));
      const common = targetTokens.filter(token => existingTokens.includes(token)).length;
      return common >= 3 && common / Math.max(1, Math.min(targetTokens.length, existingTokens.length)) >= 0.55;
    });
  }

  function experienceFormData() {
    return {
      title: $("#experienceTitle").value.trim(),
      period: $("#experiencePeriod").value.trim(),
      organizationRole: $("#experienceOrgRole").value.trim(),
      activity: $("#exp").value.trim(),
      problem: $("#experienceProblem").value.trim(),
      action: $("#experienceAction").value.trim(),
      result: $("#experienceResult").value.trim(),
      learning: $("#experienceLearning").value.trim(),
      strengths: $("#strength").value.trim(),
      keywords: $("#experienceKeywords").value.split(",").map(item => item.trim()).filter(Boolean)
    };
  }

  function clearExperienceForm() {
    ["editingExperienceId", "experienceTitle", "experiencePeriod", "experienceOrgRole", "exp", "experienceProblem", "experienceAction", "experienceResult", "experienceLearning", "strength", "experienceKeywords"].forEach(id => {
      if ($("#" + id)) $("#" + id).value = "";
    });
    $("#expCount").textContent = "0";
    $("#strengthCount").textContent = "0";
    $("#saveExperience").textContent = "경험 보관함에 저장";
  }

  function saveExperience() {
    if (!$("#saveToVault").checked) {
      alert("‘나의 경험 보관함에 저장하기’를 선택해주세요.");
      return;
    }
    const data = experienceFormData();
    if (!data.title || !data.activity || !data.strengths) {
      alert("경험 제목, 활동 내용, 관련 강점과 역량을 입력해주세요.");
      return;
    }
    const editingId = $("#editingExperienceId").value;
    const duplicate = duplicateExperience(data, editingId);
    if (duplicate && !confirm(`"${duplicate.title}" 경험과 비슷한 내용이 이미 있어요. 그래도 저장할까요?`)) return;
    const existing = vault.find(item => String(item.id) === String(editingId));
    const stamp = todayText();
    if (existing) Object.assign(existing, data, { updatedAt: stamp });
    else vault.unshift({ id: Date.now(), ...data, favorite: false, createdAt: stamp, updatedAt: stamp });
    persistVault();
    clearExperienceForm();
    renderVault();
    renderExperienceChoices();
    alert("나의 경험 보관함에 저장했어요.");
  }

  function loadExperienceEditor(id) {
    const item = vault.find(entry => String(entry.id) === String(id));
    if (!item) return;
    $("#editingExperienceId").value = item.id;
    $("#experienceTitle").value = item.title;
    $("#experiencePeriod").value = item.period || "";
    $("#experienceOrgRole").value = item.organizationRole || "";
    $("#exp").value = item.activity || "";
    $("#experienceProblem").value = item.problem || "";
    $("#experienceAction").value = item.action || "";
    $("#experienceResult").value = item.result || "";
    $("#experienceLearning").value = item.learning || "";
    $("#strength").value = item.strengths || "";
    $("#experienceKeywords").value = (item.keywords || []).join(", ");
    $("#expCount").textContent = $("#exp").value.length;
    $("#strengthCount").textContent = $("#strength").value.length;
    $("#saveExperience").textContent = "경험 수정 저장";
    $("#experienceEditor").scrollIntoView({ behavior: "smooth" });
  }

  function usedProjectNames(experienceId) {
    return projects.filter(project => (project.experienceIds || []).some(id => String(id) === String(experienceId))).map(project => project.targetName);
  }

  function allCompetencies() {
    const values = new Set();
    vault.forEach(item => {
      String(item.strengths || "").split(/[,·/]/).map(value => value.trim()).filter(Boolean).forEach(value => values.add(value));
      (item.keywords || []).forEach(value => values.add(value));
    });
    return [...values].sort((a, b) => a.localeCompare(b, "ko"));
  }

  function renderVault() {
    const query = ($("#experienceSearch")?.value || "").trim().toLowerCase();
    const filter = $("#experienceFilter")?.value || "";
    const project = projectById();
    const sorted = [...vault].sort((a, b) => Number(b.favorite) - Number(a.favorite));
    const filtered = sorted.filter(item => {
      const text = experienceText(item).toLowerCase();
      return (!query || text.includes(query)) && (!filter || text.includes(filter.toLowerCase()));
    });
    const list = $("#experienceList");
    if (!list) return;
    list.innerHTML = filtered.length ? filtered.map(item => {
      const used = usedProjectNames(item.id);
      const linked = project && (project.experienceIds || []).some(id => String(id) === String(item.id));
      return `<article class="vault-card ${item.favorite ? "favorite" : ""}">
        <div class="vault-card-head"><div><h4>${safe(item.title)}</h4><div class="muted">${safe(item.period || "기간 미입력")} · ${safe(item.organizationRole || "소속·역할 미입력")}</div></div><button class="star ${item.favorite ? "on" : ""}" data-exp-favorite="${item.id}">★</button></div>
        <div class="vault-summary"><div><b>핵심 활동</b><br>${safe((item.activity || "").slice(0, 120))}</div><div><b>결과 · 성과</b><br>${safe(item.result || "추가 작성 필요")}</div><div><b>강점 · 키워드</b><br>${safe([item.strengths, ...(item.keywords || [])].filter(Boolean).join(" · "))}</div></div>
        <div class="used-projects">사용된 프로젝트: ${used.length ? safe(used.join(", ")) : "아직 없음"}</div>
        <div class="vault-card-actions"><button data-exp-edit="${item.id}">수정</button><button data-exp-delete="${item.id}">삭제</button>${project ? `<button class="${linked ? "linked" : ""}" data-exp-link="${item.id}">${linked ? "프로젝트 연결됨 ✓" : "현재 프로젝트에 연결"}</button>` : ""}</div>
      </article>`;
    }).join("") : '<div class="empty-state">조건에 맞는 경험이 없어요.</div>';

    const currentFilter = $("#experienceFilter")?.value || "";
    if ($("#experienceFilter")) {
      $("#experienceFilter").innerHTML = '<option value="">전체 역량</option>' + allCompetencies().map(value => `<option ${value === currentFilter ? "selected" : ""}>${safe(value)}</option>`).join("");
    }
    $$("[data-exp-favorite]").forEach(button => button.onclick = () => {
      const item = vault.find(entry => String(entry.id) === String(button.dataset.expFavorite));
      if (item) item.favorite = !item.favorite;
      persistVault();
      renderVault();
    });
    $$("[data-exp-edit]").forEach(button => button.onclick = () => loadExperienceEditor(button.dataset.expEdit));
    $$("[data-exp-delete]").forEach(button => button.onclick = () => {
      const item = vault.find(entry => String(entry.id) === String(button.dataset.expDelete));
      if (!item || !confirm(`"${item.title}" 경험을 보관함에서 삭제할까요?`)) return;
      vault = vault.filter(entry => String(entry.id) !== String(item.id));
      projects.forEach(project => project.experienceIds = (project.experienceIds || []).filter(id => String(id) !== String(item.id)));
      persistVault();
      persistProjects();
      renderVault();
    });
    $$("[data-exp-link]").forEach(button => button.onclick = () => toggleExperienceLink(button.dataset.expLink));
    renderRightExperiences();
  }

  function toggleExperienceLink(id) {
    const project = projectById();
    if (!project) {
      alert("먼저 프로젝트를 선택해주세요.");
      return;
    }
    project.experienceIds ||= [];
    const exists = project.experienceIds.some(item => String(item) === String(id));
    project.experienceIds = exists ? project.experienceIds.filter(item => String(item) !== String(id)) : [...project.experienceIds, id];
    project.updatedAt = todayText();
    persistProjects();
    renderVault();
    renderExperienceChoices();
  }

  function renderExperienceChoices() {
    const container = $("#experienceChoices");
    if (!container) return;
    const project = projectById();
    container.innerHTML = vault.length ? [...vault].sort((a, b) => Number(b.favorite) - Number(a.favorite)).map(item => {
      const checked = project && (project.experienceIds || []).some(id => String(id) === String(item.id));
      return `<label class="select-card"><input class="use-exp vault-choice" type="checkbox" value="${safe(item.activity)}" data-exp-id="${item.id}" ${checked ? "checked" : ""}><span><b>${safe(item.title)}</b><br><span class="muted">${safe((item.activity || "").slice(0, 100))}<br>성과: ${safe(item.result || "추가 작성 필요")} · 강점: ${safe(item.strengths)}</span></span></label>`;
    }).join("") : '<div class="info">경험 보관함이 비어 있어요. ‘경험 보관함에서 선택’을 눌러 먼저 경험을 추가해주세요.</div>';
    $$(".vault-choice").forEach(input => input.onchange = () => {
      const project = projectById();
      if (!project) return;
      project.experienceIds ||= [];
      const id = input.dataset.expId;
      project.experienceIds = input.checked
        ? [...new Set([...project.experienceIds.map(String), String(id)])]
        : project.experienceIds.filter(item => String(item) !== String(id));
      project.updatedAt = todayText();
      persistProjects();
      updateDraftState();
    });
    updateDraftState();
  }

  function updateDraftState() {
    const enabled = !!questionText() && $$(".vault-choice:checked").length > 0;
    if ($("#draft")) {
      $("#draft").disabled = !enabled;
      $("#draft").classList.toggle("active", enabled);
    }
  }

  function recommendationScore(item, project, question) {
    const intent = /협업|갈등|팀/.test(question) ? ["협업", "갈등", "소통", "팀", "리더"]
      : /성과|목표|도전/.test(question) ? ["성과", "목표", "달성", "도전", "개선"]
      : /문제|해결/.test(question) ? ["문제", "해결", "개선", "분석"]
      : /지원|동기/.test(question) ? ["관심", "지원", "동기", "관련", "성장"]
      : /장점|강점|역량/.test(question) ? ["강점", "역량", "책임", "소통", "실행"]
      : ["경험", "역할", "행동", "결과"];
    const target = tokens([question, project.targetName, project.role, project.field, project.idealTalent, project.coreCompetencies, ...intent].join(" "));
    const source = tokens(experienceText(item));
    const overlap = target.filter(token => source.some(value => value.includes(token) || token.includes(value))).length;
    const completeness = [item.problem, item.action, item.result, item.learning].filter(Boolean).length;
    return Math.min(96, 55 + overlap * 6 + completeness * 4 + (item.favorite ? 4 : 0));
  }

  function recommendExperience() {
    const project = projectById();
    const question = questionText();
    const box = $("#experienceRecommendation");
    if (!project) {
      alert("먼저 프로젝트를 선택해주세요.");
      return;
    }
    if (!question) {
      alert("자기소개서 문항을 먼저 선택해주세요.");
      return;
    }
    if (!vault.length) {
      box.innerHTML = '<div class="recommendation">추천할 경험이 없어요. 경험 보관함에 경험을 먼저 추가해주세요.</div>';
      return;
    }
    const ranked = vault.map(item => ({ item, score: recommendationScore(item, project, question) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const missing = !best.item.result ? "결과와 성과를 수치나 변화로 보완하면 좋아요." : !best.item.action ? "본인이 직접 수행한 행동을 더 구체화하세요." : "지원처의 인재상과 연결되는 문장을 한 줄 추가하세요.";
    box.innerHTML = `<div class="recommendation"><b>추천 경험: ${safe(best.item.title)}</b><span class="fit-score">적합도 ${best.score}%</span><div class="muted" style="margin-top:8px"><b>추천 이유</b><br>${safe(question)} 문항과 ${safe(project.targetName)} ${safe(project.role)}의 핵심 역량에 가장 잘 연결되는 경험이에요.<br><br><b>강조할 강점</b><br>${safe(best.item.strengths || "문제 해결과 실행력")}<br><br><b>보완할 내용</b><br>${safe(missing)}</div><button class="mini" id="selectRecommended" type="button" style="margin-top:10px">이 경험 선택</button></div>`;
    $("#selectRecommended").onclick = () => {
      const checkbox = $("[data-exp-id='" + best.item.id + "']");
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change"));
        checkbox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
  }

  function createAdaptedDraft() {
    const project = projectById();
    const question = questionText();
    const selected = $$(".vault-choice:checked").map(input => vault.find(item => String(item.id) === String(input.dataset.expId))).filter(Boolean);
    if (!project || !question || !selected.length) {
      alert("문항과 활용할 경험을 선택해주세요.");
      return;
    }
    const main = selected[0];
    const talent = project.idealTalent || (project.type === "school" ? "성장 가능성과 학업 의지" : "주도성과 협업 역량");
    const competence = project.coreCompetencies || main.strengths || "문제 해결력";
    const action = main.action || main.activity;
    const result = main.result || "맡은 역할을 끝까지 수행하며 의미 있는 변화를 만들었습니다";
    const learning = main.learning || `${main.strengths || "책임감과 실행력"}의 중요성을 배웠습니다`;
    const opening = /지원|동기/.test(question)
      ? `${project.targetName}의 ${project.role}에 지원한 이유는 저의 경험과 ${competence} 역량을 가장 의미 있게 발전시킬 수 있다고 판단했기 때문입니다.`
      : `저는 ${main.title}을 통해 ${competence} 역량을 실제 행동으로 길러왔습니다.`;
    const text = `${opening} ${main.period ? main.period + " 동안 " : ""}${main.organizationRole ? main.organizationRole + "로서 " : ""}${main.activity} 당시 ${main.problem || "목표를 달성하기 위해 해결해야 할 과제를 구체적으로 정리했습니다."} 저는 ${action} 그 결과 ${result}. 이 경험을 통해 ${learning} ${project.targetName}이 중요하게 보는 ${talent}에 맞춰, ${project.role}에서도 상황을 정확히 파악하고 필요한 행동을 실행해 기여하겠습니다.`.slice(0, 500);
    $("#coverExample").value = text;
    $("#exampleWrap").style.display = "block";
    project.experienceIds = [...new Set([...(project.experienceIds || []).map(String), ...selected.map(item => String(item.id))])];
    project.updatedAt = todayText();
    persistProjects();
  }

  function updateCoverState() {
    const text = $("#coverText")?.value || "";
    if ($("#coverCount")) $("#coverCount").textContent = `${text.length}/500`;
    const valid = !!questionText() && !!text.trim();
    if ($("#review")) {
      $("#review").disabled = !valid;
      $("#review").classList.toggle("active", valid);
    }
    updateDraftState();
  }

  function saveProjectCover() {
    const project = projectById();
    const text = $("#coverText")?.value.trim();
    const question = questionText();
    if (!project || !text || !question) return;
    project.covers ||= [];
    let cover = project.covers.find(item => item.question === question);
    const stamp = todayText();
    const selectedIds = $$(".vault-choice:checked").map(input => String(input.dataset.expId));
    if (cover) Object.assign(cover, { text, experienceIds: selectedIds, updatedAt: stamp });
    else {
      cover = { id: Date.now(), question, text, analysis: "", experienceIds: selectedIds, createdAt: stamp, updatedAt: stamp };
      project.covers.unshift(cover);
    }
    project.experienceIds = [...new Set([...(project.experienceIds || []).map(String), ...selectedIds])];
    project.updatedAt = stamp;
    persistProjects();
    syncLegacy(project);
  }

  function captureAnalysis() {
    const project = projectById();
    if (!project) return;
    saveProjectCover();
    const question = questionText();
    const cover = (project.covers || []).find(item => item.question === question);
    const analysis = $("#analysisSummary")?.textContent.trim() || "";
    if (cover) cover.analysis = analysis;
    project.analysisResults ||= [];
    if (analysis) {
      const record = { id: Date.now(), question, analysis, createdAt: todayText() };
      project.analysisResults.unshift(record);
      project.analysisResults = project.analysisResults.slice(0, 30);
    }
    project.updatedAt = todayText();
    persistProjects();
  }

  function suggestedQuestions(project) {
    const target = project.targetName;
    const role = project.role;
    const talent = project.idealTalent || "인재상";
    return [
      `${target}의 ${role}에 지원한 가장 큰 이유는 무엇인가요?`,
      `${role}에 필요한 역량을 발휘한 경험을 설명해주세요.`,
      `${talent}과 본인이 잘 맞는다고 생각하는 근거는 무엇인가요?`,
      "협업 중 문제가 생겼을 때 어떻게 해결했나요?",
      `입사 또는 입학 후 ${target}에서 이루고 싶은 목표는 무엇인가요?`
    ];
  }

  function saveExpectedQuestions() {
    const project = projectById();
    if (!project) return;
    project.expectedQuestions = suggestedQuestions(project);
    project.updatedAt = todayText();
    persistProjects();
  }

  function captureInterviewHistory() {
    const project = projectById();
    if (!project) return;
    project.interviews = read("mk_hist", []);
    project.updatedAt = todayText();
    persistProjects();
    renderRightRecords();
  }

  function renderRightRecords() {
    const project = projectById();
    const records = project?.interviews || [];
    if ($("#rightRecords")) $("#rightRecords").innerHTML = records.length
      ? records.slice(0, 5).map(item => `<div class="record"><div class="muted">${safe(item.date)}</div><b>${safe(project.targetName)} · ${safe(item.mode || "모의면접")}</b><div class="muted">습관어 ${item.fillers ?? "기록 없음"}${item.fillers == null ? "" : "회"}</div><div class="score">${safe(item.total)}</div></div>`).join("")
      : '<div class="muted">현재 프로젝트의 면접 기록이 없어요.</div>';
  }

  function renderProjectHistory() {
    const project = projectById();
    const records = project?.interviews || [];
    if (!$("#hist")) return;
    $("#hist").innerHTML = project
      ? (records.length ? records.map((item, index) => `<div class="record"><div class="muted">${safe(item.date)}</div><b>${safe(project.targetName)} · ${safe(item.mode || "모의면접")} ${records.length - index}회차</b><div class="muted">구체성 ${safe(item.specific)} · STAR ${safe(item.star)} · 말하기 ${safe(item.speech)} · 습관어 ${item.fillers ?? "기록 없음"}${item.fillers == null ? "" : "회"}</div><div class="score">${safe(item.total)}</div></div>`).join("") : '<div class="info">현재 프로젝트의 면접 기록이 없어요.</div>')
      : '<div class="info">프로젝트를 먼저 선택해주세요.</div>';
  }

  function wireEvents() {
    $("#projectType").onchange = () => {
      updateProjectLabels();
      validateProjectForm();
    };
    ["company", "role", "field"].forEach(id => $("#" + id)?.addEventListener("input", validateProjectForm));
    $("#field")?.addEventListener("change", validateProjectForm);
    $("#saveCompany").onclick = () => saveProject();
    $("#profileNext").onclick = () => {
      const wasCreating = creatingProject;
      const project = saveProject({ silent: true });
      if (!project) return;
      if (wasCreating) {
        sessionStorage.setItem("mk_v2_after_reload", "experience");
        location.reload();
      } else go("experience");
    };
    $("#cancelProject").onclick = () => {
      creatingProject = false;
      fillProjectForm(projectById());
      go("home");
    };
    $(".side .new").onclick = startNewProject;
    $("#newProjectHome").onclick = startNewProject;
    $("#openVaultHome").onclick = () => go("experience");
    $("#saveExperience").onclick = saveExperience;
    $("#newExperience").onclick = () => {
      clearExperienceForm();
      $("#experienceEditor").scrollIntoView({ behavior: "smooth" });
    };
    $("#cancelExperienceEdit").onclick = clearExperienceForm;
    $("#experienceSearch").oninput = renderVault;
    $("#experienceFilter").onchange = renderVault;
    $("#exp").oninput = () => $("#expCount").textContent = $("#exp").value.length;
    $("#strength").oninput = () => $("#strengthCount").textContent = $("#strength").value.length;
    $("#expNext").onclick = () => {
      renderExperienceChoices();
      go("cover");
    };
    $("#openVaultCover").onclick = () => go("experience");
    $("#quickExperienceInterview").onclick = () => go("experience");
    $("#recommendExperience").onclick = recommendExperience;
    $("#draft").onclick = createAdaptedDraft;
    $("#useExample").onclick = () => {
      $("#coverText").value = $("#coverExample").value.slice(0, 500);
      updateCoverState();
      saveProjectCover();
    };
    $("#coverText").oninput = () => {
      updateCoverState();
      saveProjectCover();
    };
    $("#questionType").addEventListener("change", () => {
      $("#experienceRecommendation").innerHTML = "";
      renderExperienceChoices();
      updateCoverState();
    });
    $("#customQuestion").addEventListener("input", updateCoverState);
    $("#review").addEventListener("click", () => setTimeout(captureAnalysis, 0));
    $("#toQuestions").addEventListener("click", () => setTimeout(saveExpectedQuestions, 0));
    $("#save").addEventListener("click", () => setTimeout(captureInterviewHistory, 0));
    $$("[data-go]").forEach(button => button.addEventListener("click", () => {
      const target = button.dataset.go;
      if (target === "profile") {
        if (projectById()) {
          creatingProject = false;
          fillProjectForm(projectById());
          $("#saveCompany").textContent = "프로젝트 수정 저장";
        } else if (!creatingProject) startNewProject();
      }
      if (target === "experience") renderVault();
      if (target === "cover") renderExperienceChoices();
      if (target === "history") renderProjectHistory();
    }));
  }

  function initialize() {
    migrateLegacyData();
    projects = read(PROJECTS_KEY, []);
    vault = read(VAULT_KEY, []);
    let projectDataUpdated = false;
    projects.forEach(project => {
      if (typeof project.favorite !== "boolean") {
        project.favorite = !!project.fav;
        projectDataUpdated = true;
      }
      if (!project.aiAnalysis) {
        project.aiAnalysis = autoSummary(project);
        projectDataUpdated = true;
      }
    });
    if (projectDataUpdated) persistProjects();
    activeProjectId = localStorage.getItem(ACTIVE_KEY);
    if (!projectById() && projects.length) activeProjectId = String(projects[0].id);
    if (activeProjectId) localStorage.setItem(ACTIVE_KEY, activeProjectId);
    syncLegacy(projectById());
    ensureRightCardTabs();
    wireEvents();
    fillProjectForm(projectById());
    $("#saveCompany").textContent = projectById() ? "프로젝트 수정 저장" : "프로젝트 저장";
    renderProjects();
    renderVault();
    renderExperienceChoices();
    updateCoverState();
    const editId = sessionStorage.getItem("mk_v2_edit_project");
    const detailId = sessionStorage.getItem("mk_v2_open_detail");
    const afterReload = sessionStorage.getItem("mk_v2_after_reload");
    sessionStorage.removeItem("mk_v2_edit_project");
    sessionStorage.removeItem("mk_v2_open_detail");
    sessionStorage.removeItem("mk_v2_after_reload");
    if (editId && projectById(editId)) {
      creatingProject = false;
      fillProjectForm(projectById(editId));
      go("profile");
    } else if (detailId && projectById(detailId)) showProjectDetail(projectById(detailId));
    else if (afterReload) go(afterReload);
    document.documentElement.dataset.projectsReady = "true";
  }

  window.MyeonjeopkokProjects = {
    getActiveProject: () => {
      const project = projectById();
      return project ? JSON.parse(JSON.stringify(project)) : null;
    },
    saveRemoteInterview: record => {
      const project = projectById();
      if (!project) return false;
      project.interviews ||= [];
      project.interviews.unshift(record);
      project.interviews = project.interviews.slice(0, 30);
      project.updatedAt = todayText();
      persistProjects();
      syncLegacy(project);
      renderRightRecords();
      return true;
    }
  };

  initialize();
})();
