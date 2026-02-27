// dashboard.js – AdmitGuard Dashboard

const API_BASE = "http://localhost:8000";

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
if (!token) window.location.href = "login.html";

const user = JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("user") || "{}");
document.getElementById("userName").textContent   = user.name  || "User";
document.getElementById("userAvatar").textContent = (user.name || "U")[0].toUpperCase();

// ── Auth header ───────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show ${type === "error" ? "error-toast" : "success"}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ""; }, 3500);
}

// ── User dropdown ─────────────────────────────────────────────────────────────
function toggleUserDropdown() {
  document.getElementById("userDropdown").classList.toggle("open");
}
document.addEventListener("click", (e) => {
  if (!document.getElementById("userMenu").contains(e.target)) {
    document.getElementById("userDropdown").classList.remove("open");
  }
});

function handleLogout() {
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = "login.html";
}

// ── Fetch batches ─────────────────────────────────────────────────────────────
async function loadBatches() {
  try {
    const res  = await fetch(`${API_BASE}/api/batches`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load batches.");
    renderBatches(data);
  } catch (err) {
    document.getElementById("loadingState").innerHTML =
      `<p style="color:#e55">Failed to load batches. Is the server running?</p>`;
  }
}

// ── Render batch cards ────────────────────────────────────────────────────────
function renderBatches(batches) {
  const grid    = document.getElementById("batchGrid");
  const empty   = document.getElementById("emptyState");
  const loading = document.getElementById("loadingState");

  loading.classList.add("hidden");

  document.getElementById("kpiTotal").textContent    = batches.length;
  document.getElementById("kpiIntake").textContent   = batches.reduce((s, b) => s + (b.intake_size || 0), 0);
  document.getElementById("kpiPrograms").textContent = new Set(batches.map(b => b.program)).size;

  if (batches.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  grid.classList.remove("hidden");
  grid.querySelectorAll(".batch-card").forEach(c => c.remove());

  batches.forEach((batch, i) => {
    const hasCustomRules = batch.rules_config &&
      JSON.stringify(batch.rules_config) !== JSON.stringify(DEFAULT_RULES_CONFIG);

    const card = document.createElement("div");
    card.className = "batch-card";
    card.style.animationDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="batch-card-header">
        <span class="batch-name">${escHtml(batch.name)}</span>
        <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end">
          <span class="batch-badge">${escHtml(batch.program)}</span>
          ${hasCustomRules
            ? `<span class="batch-badge" style="background:#fef3e2;color:#c17d0a">Custom Rules</span>`
            : `<span class="batch-badge" style="background:#e8f0fe;color:#3b6ef5">Default Rules</span>`}
        </div>
      </div>
      <div class="batch-meta">
        <div class="batch-meta-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${formatDate(batch.start_date)}
        </div>
        <div class="batch-meta-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Intake: ${batch.intake_size}
        </div>
      </div>
      <div class="batch-card-footer">
        <button class="btn-view" onclick="viewBatch('${batch.id}')">View Batch →</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function viewBatch(id) {
  window.location.href = `batch.html?id=${id}`;
}

// ── Wizard state and helpers ─────────────────────────────────────────────────
let currentStep = 1;          // 1 = batch details, 2 = rule editor
let tempBatchData = null;     // stored after step1 validation

function showStep(step) {
  currentStep = step;
  document.getElementById("step1").classList.toggle("hidden", step !== 1);
  document.getElementById("step2").classList.toggle("hidden", step !== 2);
  document.getElementById("footerStep1").classList.toggle("hidden", step !== 1);
  document.getElementById("footerStep2").classList.toggle("hidden", step !== 2);
  if (step === 2) {
    renderRulesWizard();
  }
}

function validateBatchFields() {
  clearModalErrors();
  const name        = document.getElementById("batchName").value.trim();
  const program     = document.getElementById("batchProgram").value.trim();
  const start_date  = document.getElementById("batchStartDate").value;
  const intake_size = parseInt(document.getElementById("batchIntake").value);
  let valid = true;

  if (!name)                          { setModalError("batchName",      "Batch name is required.");     valid = false; }
  if (!program)                       { setModalError("batchProgram",   "Program is required.");        valid = false; }
  if (!start_date)                    { setModalError("batchStartDate", "Start date is required.");     valid = false; }
  if (!intake_size || intake_size < 1){ setModalError("batchIntake",    "Enter a valid intake size.");  valid = false; }

  if (!valid) return null;
  return { name, program, start_date, intake_size };
}

async function handleNext() {
  const data = validateBatchFields();
  if (!data) return;
  tempBatchData = data;
  showStep(2);
}

function goBack() {
  showStep(1);
}

function renderRulesWizard() {
  const container = document.getElementById("rulesWizard");
  container.innerHTML = "";
  Object.entries(DEFAULT_RULES_CONFIG).forEach(([key, cfg]) => {
    const item = document.createElement("div");
    item.className = "rule-item";
    const labelText = cfg.label || key;
    item.innerHTML = `
      <label>
        <input type="checkbox" class="rule-default-toggle" data-key="${key}" checked>
        Keep default for "${labelText}"
      </label>
      <textarea class="rule-json" data-key="${key}" rows="3" disabled>${JSON.stringify(cfg,null,2)}</textarea>
    `;
    container.appendChild(item);

    const checkbox = item.querySelector(".rule-default-toggle");
    const textarea = item.querySelector(".rule-json");
    checkbox.addEventListener("change", () => {
      textarea.disabled = checkbox.checked;
      if (checkbox.checked) {
        textarea.value = JSON.stringify(DEFAULT_RULES_CONFIG[key], null, 2);
      }
    });
  });
}

async function handleSubmitRules() {
  // collect rules configuration from wizard
  const rules_config = {};
  let errorMsg = "";
  document.getElementById("wizardErr").textContent = "";
  document.querySelectorAll(".rule-item").forEach(item => {
    const key = item.querySelector(".rule-default-toggle").getAttribute("data-key");
    const checkbox = item.querySelector(".rule-default-toggle");
    const textarea = item.querySelector(".rule-json");
    if (checkbox.checked) {
      rules_config[key] = DEFAULT_RULES_CONFIG[key];
    } else {
      try {
        rules_config[key] = JSON.parse(textarea.value);
      } catch (e) {
        errorMsg = `Invalid JSON for module ${key}.`;
      }
    }
  });
  if (errorMsg) {
    document.getElementById("wizardErr").textContent = errorMsg;
    return;
  }

  // decide if config is custom or default
  const isSame = JSON.stringify(rules_config) === JSON.stringify(DEFAULT_RULES_CONFIG);
  const finalConfig = isSame ? DEFAULT_RULES_CONFIG : rules_config;

  // post to server
  await postBatch(tempBatchData, finalConfig);
}

async function postBatch(batchData, rules_config) {
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Creating…`;

  try {
    const res  = await fetch(`${API_BASE}/api/batches`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ ...batchData, rules_config }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to create batch.");

    closeModal();
    showToast(`Batch "${batchData.name}" created! 🎉`);
    loadBatches();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Submit`;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  clearModalErrors();
  clearModalFields();
  // reset wizard state
  tempBatchData = null;
  document.getElementById("wizardErr").textContent = "";
  document.getElementById("rulesWizard").innerHTML = "";
  showStep(1);
  document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById("modalOverlay")) closeModal();
}

function clearModalFields() {
  ["batchName","batchProgram","batchStartDate","batchIntake"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.classList.remove("error");
    }
  });
}

function setModalError(id, msg) {
  document.getElementById(id + "Err").textContent = msg;
  document.getElementById(id).classList.toggle("error", !!msg);
}

function clearModalErrors() {
  ["batchName","batchProgram","batchStartDate","batchIntake"].forEach(id => setModalError(id, ""));
}


// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && !document.getElementById("modalOverlay").classList.contains("hidden")) {
    if (currentStep === 1) handleNext();
    else if (currentStep === 2) handleSubmitRules();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadBatches();

// ── Admin: show Create User button if role is admin ───────────────────────────
if (user.role === "admin") {
  document.getElementById("createUserBtn")?.classList.remove("hidden");
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function openCreateUserModal() {
  ["newUserName","newUserEmail","newUserPassword"].forEach(id => {
    document.getElementById(id).value = "";
    document.getElementById(id).classList?.remove("error");
  });
  document.getElementById("newUserRole").value = "user";
  ["newUserNameErr","newUserEmailErr","newUserPasswordErr","newUserRoleErr"]
    .forEach(id => { document.getElementById(id).textContent = ""; });
  document.getElementById("createUserModal").classList.remove("hidden");
}

function closeCreateUserModal() {
  document.getElementById("createUserModal").classList.add("hidden");
}

function handleUserModalOverlay(e) {
  if (e.target === document.getElementById("createUserModal")) closeCreateUserModal();
}

async function handleCreateUser() {
  const name     = document.getElementById("newUserName").value.trim();
  const email    = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const role     = document.getElementById("newUserRole").value;
  let valid = true;

  if (!name)              { document.getElementById("newUserNameErr").textContent = "Name is required.";          valid = false; }
  if (!email)             { document.getElementById("newUserEmailErr").textContent = "Email is required.";        valid = false; }
  if (password.length < 8){ document.getElementById("newUserPasswordErr").textContent = "Min. 8 characters.";    valid = false; }
  if (!valid) return;

  const btn = document.getElementById("createUserBtn");
  btn.disabled = true;

  try {
    const res  = await fetch(`${API_BASE}/api/admin/users`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to create user.");
    closeCreateUserModal();
    showToast(`User "${name}" (${role}) created successfully!`);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}