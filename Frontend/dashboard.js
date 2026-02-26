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

// ── Rules toggle ──────────────────────────────────────────────────────────────
let useDefaultRules = true;

function toggleRules() {
  useDefaultRules = !useDefaultRules;

  const toggle       = document.getElementById("rulesToggle");
  const badge        = document.getElementById("rulesBadge");
  const toggleText   = document.getElementById("toggleText");
  const preview      = document.getElementById("defaultRulesPreview");
  const editor       = document.getElementById("customRulesEditor");

  if (useDefaultRules) {
    toggle.classList.remove("off");
    badge.textContent = "Default";
    badge.className   = "rules-badge default";
    toggleText.textContent = "Use Default Rules";
    preview.classList.remove("hidden");
    editor.classList.add("hidden");
  } else {
    toggle.classList.add("off");
    badge.textContent = "Custom";
    badge.className   = "rules-badge custom";
    toggleText.textContent = "Use Custom Rules";
    preview.classList.add("hidden");
    editor.classList.remove("hidden");
    // Pre-fill with default as starting point
    if (!document.getElementById("customRulesJson").value) {
      document.getElementById("customRulesJson").value =
        JSON.stringify(DEFAULT_RULES_CONFIG, null, 2);
    }
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  clearModalErrors();
  clearModalFields();
  // Reset toggle to default
  useDefaultRules = true;
  document.getElementById("rulesToggle").classList.remove("off");
  document.getElementById("rulesBadge").textContent = "Default";
  document.getElementById("rulesBadge").className   = "rules-badge default";
  document.getElementById("toggleText").textContent = "Use Default Rules";
  document.getElementById("defaultRulesPreview").classList.remove("hidden");
  document.getElementById("customRulesEditor").classList.add("hidden");
  // Show default JSON preview
  document.getElementById("defaultRulesJson").textContent =
    JSON.stringify(DEFAULT_RULES_CONFIG, null, 2);

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
    document.getElementById(id).value = "";
    document.getElementById(id).classList.remove("error");
  });
  document.getElementById("customRulesJson").value = "";
}

function setModalError(id, msg) {
  document.getElementById(id + "Err").textContent = msg;
  document.getElementById(id).classList.toggle("error", !!msg);
}

function clearModalErrors() {
  ["batchName","batchProgram","batchStartDate","batchIntake"].forEach(id => setModalError(id, ""));
  document.getElementById("customRulesErr").textContent = "";
  document.getElementById("customRulesJson")?.classList.remove("error");
}

// ── Create Batch ──────────────────────────────────────────────────────────────
async function handleCreateBatch() {
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

  // Resolve rules config
  let rules_config = DEFAULT_RULES_CONFIG;
  if (!useDefaultRules) {
    const raw = document.getElementById("customRulesJson").value.trim();
    try {
      rules_config = JSON.parse(raw);
    } catch {
      document.getElementById("customRulesErr").textContent = "Invalid JSON. Please check your rules config.";
      document.getElementById("customRulesJson").classList.add("error");
      valid = false;
    }
  }

  if (!valid) return;

  const btn = document.getElementById("createBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Creating…`;

  try {
    const res  = await fetch(`${API_BASE}/api/batches`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ name, program, start_date, intake_size, rules_config }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to create batch.");

    closeModal();
    showToast(`Batch "${name}" created! 🎉`);
    loadBatches();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Create Batch`;
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && !document.getElementById("modalOverlay").classList.contains("hidden")) {
    handleCreateBatch();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadBatches();