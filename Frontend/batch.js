// batch.js – AdmitGuard Batch Detail Page

const API_BASE = "http://localhost:8000";

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
if (!token) window.location.href = "login.html";

const user = JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("user") || "{}");
document.getElementById("userName").textContent   = user.name  || "User";
document.getElementById("userAvatar").textContent = (user.name || "U")[0].toUpperCase();

// ── Batch ID from URL ─────────────────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const batchId = params.get("id");
if (!batchId) window.location.href = "dashboard.html";

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
  sessionStorage.clear(); localStorage.clear();
  window.location.href = "login.html";
}

// ── Load batch details ────────────────────────────────────────────────────────
let currentBatch = null;

async function loadBatch() {
  try {
    const res  = await fetch(`${API_BASE}/api/batches/${batchId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Batch not found.");
    currentBatch = data;
    renderBatchSummary(data);
  } catch (err) {
    showToast(err.message, "error");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
  }
}

function renderBatchSummary(batch) {
  document.title = `AdmitGuard – ${batch.name}`;
  document.getElementById("breadcrumbBatch").textContent = batch.name;

  const isCustom = batch.rules_config &&
    JSON.stringify(batch.rules_config) !== JSON.stringify(DEFAULT_RULES_CONFIG);

  document.getElementById("batchSummary").innerHTML = `
    <div class="summary-left">
      <span class="summary-name">${escHtml(batch.name)}</span>
      <span class="summary-program">${escHtml(batch.program)}</span>
    </div>
    <div class="summary-meta">
      <div class="meta-item">
        <span class="meta-label">Start Date</span>
        <span class="meta-value">${formatDate(batch.start_date)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Intake Size</span>
        <span class="meta-value">${batch.intake_size}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Rules</span>
        <span class="rules-badge ${isCustom ? 'custom' : 'default'}">
          ${isCustom ? 'Custom Rules' : 'Default Rules'}
        </span>
      </div>
    </div>
  `;
}

// ── Load candidates ───────────────────────────────────────────────────────────
let allCandidates = [];

async function loadCandidates() {
  try {
    const res  = await fetch(`${API_BASE}/api/batches/${batchId}/candidates`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load students.");
    allCandidates = data;
    renderTable(data);
  } catch (err) {
    document.getElementById("tableLoading").innerHTML =
      `<p style="color:#e55">Failed to load students.</p>`;
  }
}

function renderTable(candidates) {
  const loading = document.getElementById("tableLoading");
  const table   = document.getElementById("studentTable");
  const empty   = document.getElementById("emptyTable");
  const tbody   = document.getElementById("studentTableBody");
  const countEl = document.getElementById("studentCount");

  loading.classList.add("hidden");
  countEl.textContent = `${candidates.length} student${candidates.length !== 1 ? "s" : ""}`;

  if (candidates.length === 0) {
    table.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  table.classList.remove("hidden");
  tbody.innerHTML = "";

  candidates.forEach((c, i) => {
    const tr = document.createElement("tr");

    // Interview status badge
    const statusClass = {
      "Cleared":    "status-cleared",
      "Waitlisted": "status-waitlisted",
      "Rejected":   "status-rejected",
    }[c.interview_status] || "status-na";
    const statusLabel = c.interview_status || "—";

    // Exception count highlight
    const excClass = c.exception_count > 2 ? "exception-flagged" : "exception-normal";

    // Offer letter
    const offerHtml = c.offer_letter_sent === true
      ? `<span class="offer-yes">✓ Yes</span>`
      : c.offer_letter_sent === false
        ? `<span class="offer-no">No</span>`
        : `<span class="offer-no">—</span>`;

    tr.innerHTML = `
      <td class="row-num">${i + 1}</td>
      <td class="td-name">${escHtml(c.name)}</td>
      <td class="td-email">${escHtml(c.email)}</td>
      <td><span class="status-badge ${statusClass}">${escHtml(statusLabel)}</span></td>
      <td>${c.screening_score !== null && c.screening_score !== undefined ? c.screening_score : "—"}</td>
      <td>${offerHtml}</td>
      <td><span class="exception-badge ${excClass}">${c.exception_count}</span></td>
      <td><button class="btn-edit" onclick="editStudent('${c.id}')">Edit →</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function addStudent() {
  window.location.href = `form.html?batch_id=${batchId}`;
}

function editStudent(candidateId) {
  window.location.href = `form.html?batch_id=${batchId}&candidate_id=${candidateId}`;
}

// ── Download CSV ──────────────────────────────────────────────────────────────
function downloadCSV() {
  if (allCandidates.length === 0) {
    showToast("No students to export.", "error");
    return;
  }

  const headers = ["#", "Name", "Email", "Interview Status", "Test Score", "Offer Letter Sent", "Exception Count", "Flagged"];
  const rows = allCandidates.map((c, i) => [
    i + 1,
    `"${c.name}"`,
    `"${c.email}"`,
    c.interview_status || "",
    c.screening_score ?? "",
    c.offer_letter_sent === true ? "Yes" : c.offer_letter_sent === false ? "No" : "",
    c.exception_count,
    c.flagged ? "Yes" : "No",
  ]);

  const csv     = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob    = new Blob([csv], { type: "text/csv" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = url;
  a.download    = `${currentBatch?.name || "batch"}_students.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV downloaded!");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadBatch();
loadCandidates();