const platformNames = {
  xhs: "小红书",
  douyin: "抖音",
  moments: "朋友圈",
};

let state = {
  user: null,
  store: null,
  employees: {},
  submissions: [],
  generations: [],
  accounts: [],
  services: {},
  assets: {},
  billing: null,
  verticalModels: null,
  activeEmployee: "",
  activeServiceId: "",
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  restoreSession();
});

function bindElements() {
  Object.assign(els, {
    loginScreen: document.querySelector("#loginScreen"),
    appShell: document.querySelector("#appShell"),
    accountLoginForm: document.querySelector("#accountLoginForm"),
    loginPhone: document.querySelector("#loginPhone"),
    loginPassword: document.querySelector("#loginPassword"),
    registerForm: document.querySelector("#registerForm"),
    registerStoreName: document.querySelector("#registerStoreName"),
    registerBossName: document.querySelector("#registerBossName"),
    registerPhone: document.querySelector("#registerPhone"),
    registerPassword: document.querySelector("#registerPassword"),
    pageTitle: document.querySelector("#pageTitle"),
    userBadge: document.querySelector("#userBadge"),
    logoutButton: document.querySelector("#logoutButton"),
    employeeSelect: document.querySelector("#employeeSelect"),
    navItems: document.querySelectorAll(".nav-item"),
    views: document.querySelectorAll(".view"),
    storeName: document.querySelector("#storeName"),
    storeMeta: document.querySelector("#storeMeta"),
    staffProgress: document.querySelector("#staffProgress"),
    dashboardTasks: document.querySelector("#dashboardTasks"),
    todayTarget: document.querySelector("#todayTarget"),
    todayDone: document.querySelector("#todayDone"),
    todayRate: document.querySelector("#todayRate"),
    generationUsed: document.querySelector("#generationUsed"),
    generationQuota: document.querySelector("#generationQuota"),
    pendingReview: document.querySelector("#pendingReview"),
    creatorForm: document.querySelector("#creatorForm"),
    serviceProfile: document.querySelector("#serviceProfile"),
    serviceProfilePreview: document.querySelector("#serviceProfilePreview"),
    resultOutput: document.querySelector("#resultOutput"),
    resultTitle: document.querySelector("#resultTitle"),
    copyResult: document.querySelector("#copyResult"),
    saveDraft: document.querySelector("#saveDraft"),
    taskForm: document.querySelector("#taskForm"),
    taskEmployee: document.querySelector("#taskEmployee"),
    xhsTarget: document.querySelector("#xhsTarget"),
    douyinTarget: document.querySelector("#douyinTarget"),
    momentsTarget: document.querySelector("#momentsTarget"),
    submitForm: document.querySelector("#submitForm"),
    submitPlatform: document.querySelector("#submitPlatform"),
    submitLink: document.querySelector("#submitLink"),
    kpiTable: document.querySelector("#kpiTable"),
    reviewList: document.querySelector("#reviewList"),
    teamList: document.querySelector("#teamList"),
    serviceForm: document.querySelector("#serviceForm"),
    serviceFormTitle: document.querySelector("#serviceFormTitle"),
    newServiceButton: document.querySelector("#newServiceButton"),
    editingServiceId: document.querySelector("#editingServiceId"),
    serviceCategory: document.querySelector("#serviceCategory"),
    serviceEditorName: document.querySelector("#serviceEditorName"),
    servicePrice: document.querySelector("#servicePrice"),
    serviceDuration: document.querySelector("#serviceDuration"),
    serviceSuitableFor: document.querySelector("#serviceSuitableFor"),
    serviceSellingPoints: document.querySelector("#serviceSellingPoints"),
    serviceCautions: document.querySelector("#serviceCautions"),
    serviceContraindications: document.querySelector("#serviceContraindications"),
    serviceAftercare: document.querySelector("#serviceAftercare"),
    serviceUpsellSuggestions: document.querySelector("#serviceUpsellSuggestions"),
    serviceMaterialKeywords: document.querySelector("#serviceMaterialKeywords"),
    serviceShootingAngles: document.querySelector("#serviceShootingAngles"),
    serviceCaseNotes: document.querySelector("#serviceCaseNotes"),
    serviceList: document.querySelector("#serviceList"),
    assetForm: document.querySelector("#assetForm"),
    assetFormTitle: document.querySelector("#assetFormTitle"),
    newAssetButton: document.querySelector("#newAssetButton"),
    editingAssetId: document.querySelector("#editingAssetId"),
    assetServiceId: document.querySelector("#assetServiceId"),
    assetEmployeeId: document.querySelector("#assetEmployeeId"),
    assetType: document.querySelector("#assetType"),
    assetTitle: document.querySelector("#assetTitle"),
    assetUrl: document.querySelector("#assetUrl"),
    assetTags: document.querySelector("#assetTags"),
    assetUsageNotes: document.querySelector("#assetUsageNotes"),
    assetComplianceNotes: document.querySelector("#assetComplianceNotes"),
    assetList: document.querySelector("#assetList"),
    billingSummary: document.querySelector("#billingSummary"),
    planGrid: document.querySelector("#planGrid"),
    exportBackupButton: document.querySelector("#exportBackupButton"),
    copyBackupButton: document.querySelector("#copyBackupButton"),
    importBackupButton: document.querySelector("#importBackupButton"),
    refreshBackupsButton: document.querySelector("#refreshBackupsButton"),
    backupOutput: document.querySelector("#backupOutput"),
    backupInput: document.querySelector("#backupInput"),
    backupList: document.querySelector("#backupList"),
    verticalModelSummary: document.querySelector("#verticalModelSummary"),
    providerGrid: document.querySelector("#providerGrid"),
    modelRules: document.querySelector("#modelRules"),
    employeeForm: document.querySelector("#employeeForm"),
    employeeName: document.querySelector("#employeeName"),
    employeeRole: document.querySelector("#employeeRole"),
    employeeFocus: document.querySelector("#employeeFocus"),
    employeePhone: document.querySelector("#employeePhone"),
    employeePassword: document.querySelector("#employeePassword"),
    employeeLoginResult: document.querySelector("#employeeLoginResult"),
    toast: document.querySelector("#toast"),
  });
}

function bindEvents() {
  els.accountLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loginWithAccount();
  });

  els.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await registerBossAccount();
  });

  document.querySelectorAll("[data-login]").forEach((button) => {
    button.addEventListener("click", () => login(button.dataset.login));
  });

  els.logoutButton.addEventListener("click", () => {
    localStorage.removeItem("meiye-user-id");
    localStorage.removeItem("meiye-session-token");
    state.user = null;
    els.loginScreen.classList.remove("hidden");
    els.appShell.classList.add("hidden");
    showToast("已退出账号");
  });

  els.navItems.forEach((item) => {
    item.addEventListener("click", () => showView(item.dataset.view));
  });

  document.querySelectorAll("[data-view-jump]").forEach((item) => {
    item.addEventListener("click", () => showView(item.dataset.viewJump));
  });

  document.querySelectorAll("[data-create]").forEach((item) => {
    item.addEventListener("click", async () => {
      showView("creator");
      document.querySelector("#contentType").value = item.dataset.create;
      try {
        await generateContent();
      } catch (error) {
        showToast(error.message || "生成失败");
      }
    });
  });

  els.employeeSelect.addEventListener("change", () => {
    state.activeEmployee = els.employeeSelect.value;
    renderAll();
  });

  els.serviceProfile.addEventListener("change", () => {
    state.activeServiceId = els.serviceProfile.value;
    populateServiceForm();
    renderServicePreview();
  });

  els.creatorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await generateContent();
      showToast("内容已生成，并计入本月生成次数");
    } catch (error) {
      showToast(error.message || "生成失败");
    }
  });

  els.copyResult.addEventListener("click", async () => {
    const text = els.resultOutput.innerText.trim();
    try {
      await navigator.clipboard.writeText(text);
      showToast("生成结果已复制");
    } catch {
      showToast("浏览器未开放剪贴板权限，可手动选择复制");
    }
  });

  els.saveDraft.addEventListener("click", () => {
    showToast("后续版本会保存到草稿箱；当前生成记录已在后端保存");
  });

  els.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const employeeId = els.taskEmployee.value;
    const data = await api("/api/tasks", {
      method: "POST",
      body: {
        employeeId,
        tasks: {
          xhs: Number(els.xhsTarget.value),
          douyin: Number(els.douyinTarget.value),
          moments: Number(els.momentsTarget.value),
        },
      },
    });
    applyServerState(data);
    showToast(`${state.employees[employeeId].name} 的本周任务已更新`);
  });

  els.taskEmployee.addEventListener("change", () => {
    const employee = state.employees[els.taskEmployee.value];
    if (!employee) return;
    els.xhsTarget.value = employee.tasks.xhs;
    els.douyinTarget.value = employee.tasks.douyin;
    els.momentsTarget.value = employee.tasks.moments;
  });

  els.submitForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const platform = els.submitPlatform.value;
    const link = els.submitLink.value.trim();
    if (!link) {
      showToast("请先填写发布链接或截图说明");
      return;
    }
    const data = await api("/api/submissions", {
      method: "POST",
      body: {
        employeeId: state.activeEmployee,
        platform,
        link,
      },
    });
    els.submitLink.value = "";
    applyServerState(data);
    showToast("已提交，今日 KPI 已保存");
  });

  els.employeeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = await api("/api/employees", {
      method: "POST",
      body: {
        name: els.employeeName.value,
        role: els.employeeRole.value,
        focus: els.employeeFocus.value,
        phone: els.employeePhone.value,
        password: els.employeePassword.value,
      },
    });
    applyServerState(data);
    renderEmployeeLoginResult(data.employeeLogin);
    resetEmployeeForm();
    showToast(data.employeeLogin ? `已新增员工，可用 ${data.employeeLogin.phone} 登录` : "已新增员工档案");
  });

  els.newServiceButton.addEventListener("click", () => {
    resetServiceForm();
  });

  els.serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const serviceId = els.editingServiceId.value;
    const payload = readServiceForm();
    const data = await api(serviceId ? `/api/services/${encodeURIComponent(serviceId)}` : "/api/services", {
      method: serviceId ? "PUT" : "POST",
      body: payload,
    });
    applyServerState(data);
    state.activeServiceId = serviceId || findServiceByName(data.services, payload.name) || state.activeServiceId;
    resetServiceForm();
    renderAll();
    showToast("项目素材已保存");
  });

  els.newAssetButton.addEventListener("click", () => {
    resetAssetForm();
  });

  els.assetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const assetId = els.editingAssetId.value;
    const data = await api(assetId ? `/api/assets/${encodeURIComponent(assetId)}` : "/api/assets", {
      method: assetId ? "PUT" : "POST",
      body: readAssetForm(),
    });
    applyServerState(data);
    resetAssetForm();
    showToast("内容素材已保存");
  });

  els.exportBackupButton.addEventListener("click", exportBackup);
  els.copyBackupButton.addEventListener("click", copyBackup);
  els.importBackupButton.addEventListener("click", importBackup);
  els.refreshBackupsButton.addEventListener("click", loadBackups);
}

async function restoreSession() {
  const savedToken = localStorage.getItem("meiye-session-token");
  if (savedToken) {
    try {
      const data = await api("/api/auth/session");
      state.user = data.user;
      applyServerState(data.state);
      els.loginScreen.classList.add("hidden");
      els.appShell.classList.remove("hidden");
      showView("dashboard");
      await loadVerticalModels();
      return;
    } catch {
      localStorage.removeItem("meiye-session-token");
    }
  }
  const savedUserId = localStorage.getItem("meiye-user-id");
  if (savedUserId) {
    await login(savedUserId, { quiet: true });
  }
}

async function loginWithAccount() {
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: {
        phone: els.loginPhone.value,
        password: els.loginPassword.value,
      },
      skipAuth: true,
    });
    await enterAppWithAuth(data);
    showToast(`${data.user.name} 已登录`);
  } catch (error) {
    showToast(error.message || "登录失败");
  }
}

async function registerBossAccount() {
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: {
        storeName: els.registerStoreName.value,
        name: els.registerBossName.value,
        phone: els.registerPhone.value,
        password: els.registerPassword.value,
      },
      skipAuth: true,
    });
    await enterAppWithAuth(data);
    showToast("老板账号已创建");
  } catch (error) {
    showToast(error.message || "创建账号失败");
  }
}

async function login(userId, options = {}) {
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: { userId },
      skipAuth: true,
    });
    state.user = data.user;
    localStorage.removeItem("meiye-session-token");
    localStorage.setItem("meiye-user-id", data.user.id);
    applyServerState(data.state);
    els.loginScreen.classList.add("hidden");
    els.appShell.classList.remove("hidden");
    showView("dashboard");
    await loadVerticalModels();
    if (!options.quiet) showToast(`${data.user.name} 已登录`);
  } catch (error) {
    showToast(error.message || "登录失败");
  }
}

async function enterAppWithAuth(data) {
  state.user = data.user;
  localStorage.removeItem("meiye-user-id");
  localStorage.setItem("meiye-session-token", data.token);
  applyServerState(data.state);
  els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  showView("dashboard");
  await loadVerticalModels();
}

function applyServerState(data) {
  state = {
    ...state,
    user: data.user || state.user,
    store: data.store,
    employees: data.employees || {},
    submissions: data.submissions || [],
    generations: data.generations || [],
    accounts: data.accounts || [],
    services: data.services || state.services || {},
    assets: data.assets || state.assets || {},
    billing: data.billing || state.billing,
  };
  if (!state.activeEmployee || !state.employees[state.activeEmployee]) {
    state.activeEmployee = Object.keys(state.employees)[0] || "";
  }
  if (!state.activeServiceId || !state.services[state.activeServiceId]) {
    state.activeServiceId = Object.keys(state.services)[0] || "";
  }
  renderAll();
}

async function refreshState() {
  const data = await api("/api/state");
  applyServerState(data);
}

async function loadVerticalModels() {
  const data = await api("/api/vertical-models");
  state.verticalModels = data;
  renderVerticalModels();
}

function renderAll() {
  if (!state.user || !state.store) return;
  renderRole();
  renderStore();
  renderEmployeeOptions();
  renderServiceOptions();
  renderAssetSelectOptions();
  renderDashboardMetrics();
  renderStaffProgress();
  renderTaskList();
  renderKpiTable();
  renderReviews();
  renderTeam();
  renderServiceManager();
  renderAssetManager();
  renderBilling();
  renderVerticalModels();
}

function renderRole() {
  els.userBadge.textContent = `${state.user.name} · ${state.user.role === "boss" ? "老板" : state.user.title}`;
  els.employeeSelect.disabled = state.user.role !== "boss";
  document.querySelectorAll(".boss-only").forEach((node) => {
    node.classList.toggle("hidden", state.user.role !== "boss");
  });
  if (state.user.role !== "boss" && ["reviews", "team", "services", "assets", "providers", "billing", "data"].includes(getActiveView())) {
    showView("dashboard");
  }
}

function renderStore() {
  els.storeName.textContent = state.store.name;
  els.storeMeta.textContent = `${state.store.plan} · ${Object.keys(state.employees).length} 名员工`;
  els.generationUsed.textContent = state.store.generationUsed;
  const remaining = state.billing ? `剩余 ${state.billing.remaining} 次` : `本月额度 ${state.store.generationQuota} 次`;
  els.generationQuota.textContent = `本月额度 ${state.store.generationQuota} 次 · ${remaining}`;
  els.pendingReview.textContent = state.submissions.filter((item) => item.status === "pending").length;
}

function renderEmployeeOptions() {
  const options = Object.values(state.employees)
    .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)} · ${escapeHtml(employee.role)}</option>`)
    .join("");
  els.employeeSelect.innerHTML = options;
  els.taskEmployee.innerHTML = options;
  els.employeeSelect.value = state.activeEmployee;
  if (state.user.role === "boss") {
    els.taskEmployee.value = state.activeEmployee;
  } else {
    els.taskEmployee.value = state.user.id;
  }
  els.taskEmployee.dispatchEvent(new Event("change"));
}

function renderServiceOptions() {
  const options = Object.values(state.services)
    .map((service) => `<option value="${service.id}">${escapeHtml(service.category)} · ${escapeHtml(service.name)}</option>`)
    .join("");
  els.serviceProfile.innerHTML = options;
  els.serviceProfile.value = state.activeServiceId;
  renderServicePreview();
}

function renderAssetSelectOptions() {
  if (!els.assetServiceId || !els.assetEmployeeId) return;
  els.assetServiceId.innerHTML = Object.values(state.services)
    .map((service) => `<option value="${service.id}">${escapeHtml(service.category)} · ${escapeHtml(service.name)}</option>`)
    .join("");
  els.assetEmployeeId.innerHTML = Object.values(state.employees)
    .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)} · ${escapeHtml(employee.role)}</option>`)
    .join("");
}

function populateServiceForm() {
  const service = state.services[state.activeServiceId];
  if (!service) return;
  document.querySelector("#serviceName").value = service.name;
  document.querySelector("#offer").value = service.price;
}

function renderServicePreview() {
  const service = state.services[state.activeServiceId];
  if (!service) {
    els.serviceProfilePreview.innerHTML = "";
    return;
  }
  els.serviceProfilePreview.innerHTML = `
    <strong>${escapeHtml(service.name)}</strong>
    <span>${escapeHtml(service.price)} · ${escapeHtml(service.duration)}</span>
    <span>适合：${service.suitableFor.map(escapeHtml).join(" / ")}</span>
    <span>注意：${service.cautions.map(escapeHtml).join(" / ")}</span>
  `;
}

function renderDashboardMetrics() {
  const ids = visibleEmployeeIds();
  const target = ids.reduce((sum, id) => sum + sumValues(state.employees[id].tasks), 0);
  const done = ids.reduce((sum, id) => sum + sumValues(state.employees[id].done), 0);
  const rate = target ? Math.round((done / target) * 100) : 0;
  els.todayTarget.textContent = target;
  els.todayDone.textContent = done;
  els.todayRate.textContent = `完成率 ${rate}%`;
}

function renderStaffProgress() {
  els.staffProgress.innerHTML = visibleEmployeeIds()
    .map((id) => {
      const employee = state.employees[id];
      const target = sumValues(employee.tasks);
      const done = sumValues(employee.done);
      const rate = target ? Math.min(Math.round((done / target) * 100), 100) : 100;
      return `
        <article class="staff-row">
          <div class="staff-row-top">
            <div>
              <strong>${escapeHtml(employee.name)} · ${escapeHtml(employee.role)}</strong>
              <div class="muted">${escapeHtml(employee.focus)}</div>
            </div>
            <span class="pill ${rate < 60 ? "warn" : ""}">${done}/${target} 条</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${rate}%"></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTaskList() {
  const rows = [];
  visibleEmployeeIds().forEach((id) => {
    const employee = state.employees[id];
    Object.keys(employee.tasks).forEach((key) => {
      const target = employee.tasks[key];
      if (!target) return;
      const done = employee.done[key];
      rows.push({
        employee,
        platform: platformNames[key],
        target,
        done,
        left: Math.max(target - done, 0),
      });
    });
  });

  els.dashboardTasks.innerHTML = rows
    .map((row) => `
      <article class="task-row">
        <div class="task-row-top">
          <strong>${escapeHtml(row.employee.name)} · ${escapeHtml(row.platform)}</strong>
          <span class="pill ${row.left ? "rose" : ""}">${row.left ? `还差 ${row.left} 条` : "已完成"}</span>
        </div>
        <span class="muted">今日目标 ${row.target} 条，已提交 ${row.done} 条</span>
      </article>
    `)
    .join("");
}

function renderKpiTable() {
  const rows = Object.values(state.employees)
    .map((employee) => {
      const target = sumValues(employee.tasks) * 7;
      const doneToday = sumValues(employee.done);
      const projected = doneToday * 7;
      const rate = target ? Math.min(Math.round((projected / target) * 100), 100) : 100;
      return `
        <tr>
          <td>${escapeHtml(employee.name)}</td>
          <td>${escapeHtml(employee.role)}</td>
          <td>${employee.tasks.xhs} / ${employee.tasks.douyin} / ${employee.tasks.moments}</td>
          <td>${doneToday} 条</td>
          <td>${projected}/${target}</td>
          <td><span class="pill ${rate < 70 ? "warn" : ""}">${rate}%</span></td>
        </tr>
      `;
    })
    .join("");

  els.kpiTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>员工</th>
          <th>岗位</th>
          <th>每日任务 小红书/抖音/朋友圈</th>
          <th>今日已发</th>
          <th>本周预计</th>
          <th>完成率</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTeam() {
  els.teamList.innerHTML = Object.values(state.employees)
    .map((employee) => {
      const target = sumValues(employee.tasks);
      return `
        <article class="team-card">
          <div>
            <div class="team-row-top">
              <strong>${escapeHtml(employee.name)} · ${escapeHtml(employee.role)}</strong>
              <span class="pill">${escapeHtml(employee.focus)}</span>
            </div>
            <small>每日任务：小红书 ${employee.tasks.xhs} 条，抖音 ${employee.tasks.douyin} 条，朋友圈 ${employee.tasks.moments} 条</small>
          </div>
          <button class="secondary-button" data-assign="${employee.id}">调整任务 ${target} 条/天</button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-assign]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeEmployee = button.dataset.assign;
      showView("tasks");
      renderAll();
    });
  });
}

function resetEmployeeForm() {
  els.employeeName.value = "";
  els.employeeRole.value = "";
  els.employeeFocus.value = "";
  els.employeePhone.value = "";
  els.employeePassword.value = "";
}

function renderEmployeeLoginResult(login) {
  if (!els.employeeLoginResult) return;
  if (!login) {
    els.employeeLoginResult.classList.add("hidden");
    els.employeeLoginResult.innerHTML = "";
    return;
  }
  els.employeeLoginResult.classList.remove("hidden");
  els.employeeLoginResult.innerHTML = `
    <strong>员工登录信息</strong>
    <span>手机号：${escapeHtml(login.phone)}</span>
    <span>初始密码：${escapeHtml(login.password)}</span>
  `;
}

function renderReviews() {
  if (!els.reviewList) return;
  if (!state.submissions.length) {
    els.reviewList.innerHTML = `<article class="review-card"><span class="muted">暂无员工提交。</span></article>`;
    return;
  }
  els.reviewList.innerHTML = state.submissions
    .map((item) => {
      const employee = state.employees[item.employeeId];
      const status = reviewStatusText(item.status);
      return `
        <article class="review-card">
          <div>
            <div class="team-row-top">
              <strong>${escapeHtml(employee?.name || item.employeeId)} · ${escapeHtml(item.platform)}</strong>
              <span class="pill ${item.status === "rejected" ? "rose" : item.status === "pending" ? "warn" : ""}">${status}</span>
            </div>
            <p>${escapeHtml(item.link)}</p>
            <small>${escapeHtml(item.date || "")} ${escapeHtml(item.time || "")}</small>
            ${item.reviewNote ? `<small>审核意见：${escapeHtml(item.reviewNote)}</small>` : ""}
          </div>
          <div class="review-actions">
            <button class="secondary-button" data-approve-submission="${item.id}" ${item.status === "approved" ? "disabled" : ""}>通过</button>
            <button class="danger-button" data-reject-submission="${item.id}">退回</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-approve-submission]").forEach((button) => {
    button.addEventListener("click", async () => {
      const data = await api(`/api/submissions/${encodeURIComponent(button.dataset.approveSubmission)}/review`, {
        method: "POST",
        body: { status: "approved", reviewNote: "" },
      });
      applyServerState(data);
      showToast("已通过这条提交");
    });
  });

  document.querySelectorAll("[data-reject-submission]").forEach((button) => {
    button.addEventListener("click", async () => {
      const note = window.prompt("填写退回意见", "请调整标题或补充发布链接截图");
      if (note === null) return;
      const data = await api(`/api/submissions/${encodeURIComponent(button.dataset.rejectSubmission)}/review`, {
        method: "POST",
        body: { status: "rejected", reviewNote: note },
      });
      applyServerState(data);
      showToast("已退回这条提交");
    });
  });
}

function renderServiceManager() {
  if (!els.serviceList) return;
  els.serviceList.innerHTML = Object.values(state.services)
    .map((service) => `
      <article class="service-card">
        <div>
          <div class="team-row-top">
            <strong>${escapeHtml(service.name)}</strong>
            <span class="pill">${escapeHtml(service.category)}</span>
          </div>
          <small>${escapeHtml(service.price)} · ${escapeHtml(service.duration)}</small>
          <p>${escapeHtml(service.caseNotes || "")}</p>
          <div class="service-tags">
            ${(service.sellingPoints || []).slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
        <div class="service-actions">
          <button class="secondary-button" data-edit-service="${service.id}">编辑</button>
          <button class="danger-button" data-delete-service="${service.id}">删除</button>
        </div>
      </article>
    `)
    .join("");

  document.querySelectorAll("[data-edit-service]").forEach((button) => {
    button.addEventListener("click", () => {
      fillServiceForm(state.services[button.dataset.editService]);
    });
  });

  document.querySelectorAll("[data-delete-service]").forEach((button) => {
    button.addEventListener("click", async () => {
      const service = state.services[button.dataset.deleteService];
      if (!service || !window.confirm(`删除「${service.name}」这个项目素材？`)) return;
      const data = await api(`/api/services/${encodeURIComponent(service.id)}`, {
        method: "DELETE",
      });
      applyServerState(data);
      resetServiceForm();
      showToast("项目素材已删除");
    });
  });
}

function renderAssetManager() {
  if (!els.assetList) return;
  els.assetList.innerHTML = Object.values(state.assets)
    .map((asset) => {
      const service = state.services[asset.serviceId];
      const employee = state.employees[asset.employeeId];
      return `
        <article class="asset-card">
          ${asset.url ? `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.title)}" />` : `<div class="asset-placeholder">素材</div>`}
          <div>
            <div class="team-row-top">
              <strong>${escapeHtml(asset.title)}</strong>
              <span class="pill">${escapeHtml(assetTypeText(asset.type))}</span>
            </div>
            <small>${escapeHtml(service?.name || "未关联项目")} · ${escapeHtml(employee?.name || "未关联员工")}</small>
            <p>${escapeHtml(asset.usageNotes || "")}</p>
            <div class="service-tags">
              ${(asset.tags || []).slice(0, 5).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            </div>
          </div>
          <div class="service-actions">
            <button class="secondary-button" data-edit-asset="${asset.id}">编辑</button>
            <button class="danger-button" data-delete-asset="${asset.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-edit-asset]").forEach((button) => {
    button.addEventListener("click", () => fillAssetForm(state.assets[button.dataset.editAsset]));
  });

  document.querySelectorAll("[data-delete-asset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const asset = state.assets[button.dataset.deleteAsset];
      if (!asset || !window.confirm(`删除「${asset.title}」这个内容素材？`)) return;
      const data = await api(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      applyServerState(data);
      resetAssetForm();
      showToast("内容素材已删除");
    });
  });
}

function renderBilling() {
  if (!state.billing || !els.billingSummary || !els.planGrid) return;
  const billing = state.billing;
  els.billingSummary.innerHTML = `
    <article class="billing-card">
      <strong>${escapeHtml(billing.subscription.planName)}</strong>
      <span>${billing.used}/${billing.quota} 次 · 剩余 ${billing.remaining} 次</span>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${billing.usageRate}%"></div>
      </div>
    </article>
  `;
  els.planGrid.innerHTML = Object.values(billing.plans)
    .map((plan) => `
      <article class="provider-card">
        <strong>${escapeHtml(plan.planName)}</strong>
        <span>${plan.billingMode === "trial" ? "试用" : `¥${plan.priceMonthly}/月`}</span>
        <ul class="compact-list">
          <li>员工上限：${plan.employeeLimit} 人</li>
          <li>每月生成：${plan.quotaMonthly} 次</li>
        </ul>
        <button class="secondary-button" data-plan-id="${plan.planId}" ${plan.planId === billing.subscription.planId ? "disabled" : ""}>
          ${plan.planId === billing.subscription.planId ? "当前方案" : "切换方案"}
        </button>
      </article>
    `)
    .join("");

  document.querySelectorAll("[data-plan-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const data = await api("/api/billing/plan", {
        method: "POST",
        body: { planId: button.dataset.planId },
      });
      applyServerState(data);
      showToast("订阅方案已切换，额度已刷新");
    });
  });
}

async function exportBackup() {
  try {
    const backup = await api("/api/backups/export");
    els.backupOutput.value = JSON.stringify(backup, null, 2);
    await loadBackups();
    showToast("当前数据已导出");
  } catch (error) {
    showToast(error.message || "导出失败");
  }
}

async function copyBackup() {
  const text = els.backupOutput.value.trim();
  if (!text) {
    showToast("请先导出备份");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("备份文本已复制");
  } catch {
    showToast("浏览器未开放剪贴板权限，可手动复制");
  }
}

async function importBackup() {
  const raw = els.backupInput.value.trim();
  if (!raw) {
    showToast("请先粘贴备份 JSON");
    return;
  }
  if (!window.confirm("导入会覆盖当前数据。系统会先自动保存一份导入前备份，确认继续？")) return;
  try {
    const parsed = JSON.parse(raw);
    const data = await api("/api/backups/import", {
      method: "POST",
      body: { backup: parsed },
    });
    if (data.token) {
      localStorage.setItem("meiye-session-token", data.token);
    }
    state.user = data.user || state.user;
    applyServerState(data.state || data);
    els.backupInput.value = "";
    await loadBackups();
    showToast("备份已导入并恢复");
  } catch (error) {
    showToast(error.message || "导入失败，请检查 JSON 格式");
  }
}

async function loadBackups() {
  if (!state.user || state.user.role !== "boss") return;
  try {
    const data = await api("/api/backups");
    renderBackups(data.backups || []);
  } catch {
    renderBackups([]);
  }
}

function renderBackups(backups = []) {
  if (!els.backupList) return;
  if (!backups.length) {
    els.backupList.innerHTML = `<article class="submission-row"><span class="muted">暂无自动备份。修改数据或导入前会自动生成备份。</span></article>`;
    return;
  }
  els.backupList.innerHTML = backups
    .map((backup) => `
      <article class="submission-row">
        <div class="team-row-top">
          <strong>${escapeHtml(backup.fileName)}</strong>
          <span class="pill">${Math.ceil(backup.size / 1024)} KB</span>
        </div>
        <span class="muted">${escapeHtml(backup.createdAt)}</span>
      </article>
    `)
    .join("");
}

function readAssetForm() {
  return {
    id: els.editingAssetId.value,
    serviceId: els.assetServiceId.value,
    employeeId: els.assetEmployeeId.value,
    type: els.assetType.value,
    title: els.assetTitle.value,
    url: els.assetUrl.value,
    tags: els.assetTags.value,
    usageNotes: els.assetUsageNotes.value,
    complianceNotes: els.assetComplianceNotes.value,
  };
}

function fillAssetForm(asset) {
  if (!asset) return;
  els.assetFormTitle.textContent = "编辑素材";
  els.editingAssetId.value = asset.id;
  els.assetServiceId.value = asset.serviceId;
  els.assetEmployeeId.value = asset.employeeId;
  els.assetType.value = asset.type;
  els.assetTitle.value = asset.title;
  els.assetUrl.value = asset.url || "";
  els.assetTags.value = (asset.tags || []).join("\n");
  els.assetUsageNotes.value = asset.usageNotes || "";
  els.assetComplianceNotes.value = asset.complianceNotes || "";
}

function resetAssetForm() {
  els.assetFormTitle.textContent = "新增素材";
  els.editingAssetId.value = "";
  els.assetType.value = "case_image";
  els.assetTitle.value = "";
  els.assetUrl.value = "";
  els.assetTags.value = "";
  els.assetUsageNotes.value = "";
  els.assetComplianceNotes.value = "";
}

function readServiceForm() {
  return {
    id: els.editingServiceId.value,
    category: els.serviceCategory.value,
    name: els.serviceEditorName.value,
    price: els.servicePrice.value,
    duration: els.serviceDuration.value,
    suitableFor: els.serviceSuitableFor.value,
    sellingPoints: els.serviceSellingPoints.value,
    cautions: els.serviceCautions.value,
    contraindications: els.serviceContraindications.value,
    aftercare: els.serviceAftercare.value,
    upsellSuggestions: els.serviceUpsellSuggestions.value,
    materialKeywords: els.serviceMaterialKeywords.value,
    shootingAngles: els.serviceShootingAngles.value,
    caseNotes: els.serviceCaseNotes.value,
  };
}

function fillServiceForm(service) {
  if (!service) return;
  els.serviceFormTitle.textContent = "编辑项目";
  els.editingServiceId.value = service.id;
  els.serviceCategory.value = service.category;
  els.serviceEditorName.value = service.name;
  els.servicePrice.value = service.price;
  els.serviceDuration.value = service.duration;
  els.serviceSuitableFor.value = (service.suitableFor || []).join("\n");
  els.serviceSellingPoints.value = (service.sellingPoints || []).join("\n");
  els.serviceCautions.value = (service.cautions || []).join("\n");
  els.serviceContraindications.value = (service.contraindications || []).join("\n");
  els.serviceAftercare.value = (service.aftercare || []).join("\n");
  els.serviceUpsellSuggestions.value = (service.upsellSuggestions || []).join("\n");
  els.serviceMaterialKeywords.value = (service.materialKeywords || []).join("\n");
  els.serviceShootingAngles.value = (service.shootingAngles || []).join("\n");
  els.serviceCaseNotes.value = service.caseNotes || "";
}

function resetServiceForm() {
  els.serviceFormTitle.textContent = "新增项目";
  els.editingServiceId.value = "";
  els.serviceCategory.value = "美甲";
  els.serviceEditorName.value = "";
  els.servicePrice.value = "";
  els.serviceDuration.value = "";
  els.serviceSuitableFor.value = "";
  els.serviceSellingPoints.value = "";
  els.serviceCautions.value = "";
  els.serviceContraindications.value = "";
  els.serviceAftercare.value = "";
  els.serviceUpsellSuggestions.value = "";
  els.serviceMaterialKeywords.value = "";
  els.serviceShootingAngles.value = "";
  els.serviceCaseNotes.value = "";
}

function renderVerticalModels() {
  if (!state.verticalModels || !els.providerGrid) return;
  const models = state.verticalModels;
  els.verticalModelSummary.innerHTML = `
    <article class="model-summary-card">
      <strong>${escapeHtml(models.positioning)}</strong>
      <span>知识包版本：${escapeHtml(models.version)}</span>
    </article>
    <article class="model-summary-card">
      <strong>${models.runtimeProvider.configured ? "真实模型已连接" : "当前使用本地垂直模板"}</strong>
      <span>${escapeHtml(models.runtimeProvider.name)} · ${escapeHtml(models.runtimeProvider.model)}</span>
    </article>
    ${models.principles
      .map((principle) => `
        <article class="model-summary-card">
          <strong>${escapeHtml(principle)}</strong>
          <span>所有底层厂商模型都先经过这条规则再输出。</span>
        </article>
      `)
      .join("")}
  `;

  els.providerGrid.innerHTML = Object.values(models.providerRouting)
    .map((route) => `
      <article class="provider-card">
        <strong>${escapeHtml(route.modelType)}</strong>
        <span>${escapeHtml(route.domain)}</span>
        <ul class="compact-list">
          ${route.futureProviders.map((provider) => `<li>${escapeHtml(provider)}</li>`).join("")}
        </ul>
        <button class="secondary-button">垂直路由已就绪</button>
      </article>
    `)
    .join("");

  const serviceItems = Object.values(models.serviceCategories)
    .map((category) => `
      <article class="rule-card">
        <strong>${escapeHtml(category.name)}</strong>
        <span>${category.sellingPoints.map(escapeHtml).join(" / ")}</span>
      </article>
    `)
    .join("");
  const complianceItems = models.complianceRules.blockedClaims
    .slice(0, 8)
    .map((claim) => `
      <article class="rule-card warn">
        <strong>禁用：${escapeHtml(claim)}</strong>
        <span>${escapeHtml(models.complianceRules.saferAlternatives[claim] || "避免绝对化承诺")}</span>
      </article>
    `)
    .join("");
  els.modelRules.innerHTML = serviceItems + complianceItems;
}

async function generateContent() {
  if (!state.user) return;
  const payload = {
    contentType: document.querySelector("#contentType").value,
    serviceProfileId: state.activeServiceId,
    serviceName: document.querySelector("#serviceName").value.trim(),
    offer: document.querySelector("#offer").value.trim(),
    goal: document.querySelector("#goal").value,
    tone: document.querySelector("#tone").value,
    storeFeature: document.querySelector("#storeFeature").value.trim(),
  };
  const data = await api("/api/generate", {
    method: "POST",
    body: payload,
  });
  els.resultTitle.textContent = data.title;
  els.resultOutput.innerHTML = data.blocks.map(renderOutputBlock).join("");
  state.store.generationUsed = data.generationUsed;
  state.store.generationQuota = data.generationQuota;
  renderStore();
}

function renderOutputBlock(block) {
  const content = block.lines
    ? `<ul>${block.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;
  return `
    <article class="output-block">
      <h3>${escapeHtml(block.title)}</h3>
      ${content}
    </article>
  `;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (!options.skipAuth) {
    const token = localStorage.getItem("meiye-session-token");
    if (token) {
      headers["x-session-token"] = token;
    } else if (state.user) {
      headers["x-user-id"] = state.user.id;
    }
  }
  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

function visibleEmployeeIds() {
  if (state.user.role === "boss") return Object.keys(state.employees);
  return [state.user.id].filter((id) => state.employees[id]);
}

function showView(viewId) {
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  const activeItem = [...els.navItems].find((item) => item.dataset.view === viewId);
  els.pageTitle.textContent = activeItem ? activeItem.dataset.title : "今日工作台";
  if (viewId === "data") {
    loadBackups();
  }
}

function getActiveView() {
  const active = document.querySelector(".view.active");
  return active ? active.id : "dashboard";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

function sumValues(value) {
  return Object.values(value).reduce((sum, item) => sum + item, 0);
}

function findServiceByName(services, name) {
  return Object.values(services || {}).find((service) => service.name === name)?.id || "";
}

function reviewStatusText(status) {
  return {
    pending: "待审核",
    approved: "已通过",
    rejected: "已退回",
  }[status] || "待审核";
}

function assetTypeText(type) {
  return {
    case_image: "案例图",
    education_card: "科普卡片",
    video_clip: "视频片段",
    customer_feedback: "客户反馈",
  }[type] || "素材";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
