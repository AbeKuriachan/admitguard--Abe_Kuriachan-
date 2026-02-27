// batch.js – AdmitGuard Batch Detail Page

const API_BASE = "http://localhost:8000";

// ── Auth ──────────────────────────────────────────────────────────────────────
const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
if (!token) window.location.href = "login.html";

const user = JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("user") || "{}");
document.getElementById("userName").textContent   = user.name  || "User";
document.getElementById("userAvatar").textContent = (user.name || "U")[0].toUpperCase();

const userRole = user.role || "user";  // admin | manager | user

// ── Batch ID ──────────────────────────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const batchId = params.get("id");
if (!batchId) window.location.href = "dashboard.html";

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show ${type === "error" ? "error-toast" : "success"}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ""; }, 3500);
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function toggleUserDropdown() { document.getElementById("userDropdown").classList.toggle("open"); }
document.addEventListener("click", (e) => {
  if (!document.getElementById("userMenu").contains(e.target))
    document.getElementById("userDropdown").classList.remove("open");
});
function handleLogout() { sessionStorage.clear(); localStorage.clear(); window.location.href = "login.html"; }

// ── Load Batch ────────────────────────────────────────────────────────────────
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
        <span class="rules-badge ${isCustom ? 'custom' : 'default'}">${isCustom ? 'Custom Rules' : 'Default Rules'}</span>
      </div>
    </div>
  `;
}

// ── Load Candidates ───────────────────────────────────────────────────────────
let allCandidates = [];

async function loadCandidates() {
  try {
    const res  = await fetch(`${API_BASE}/api/batches/${batchId}/candidates`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load students.");
    allCandidates = data;
    renderKPIs(data);
    renderTable(data);
  } catch (err) {
    document.getElementById("tableLoading").innerHTML = `<p style="color:#e55">Failed to load students.</p>`;
  }
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs(candidates) {
  const total    = candidates.length;
  const offered  = candidates.filter(c => c.offer_letter_sent === true).length;
  const pending  = candidates.filter(c => c.flagged && !c.review_status).length;
  const flagged  = candidates.filter(c => c.flagged).length;

  document.getElementById("kpiTotal").textContent   = total;
  document.getElementById("kpiOffer").textContent   = offered;
  document.getElementById("kpiPending").textContent = pending;
  document.getElementById("kpiFlagged").textContent = flagged;

  if (total > 0) document.getElementById("kpiStrip").style.display = "grid";
}

// ── Table ─────────────────────────────────────────────────────────────────────
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

  const canReview = userRole === "admin" || userRole === "manager";

  candidates.forEach((c, i) => {
    const statusClass = { "Cleared": "status-cleared", "Waitlisted": "status-waitlisted", "Rejected": "status-rejected" }[c.interview_status] || "status-na";
    const excClass    = c.exception_count > 2 ? "exc-flagged" : "exc-normal";

    const offerHtml = c.offer_letter_sent === true
      ? `<span class="offer-yes">✓ Yes</span>`
      : c.offer_letter_sent === false ? `<span class="offer-no">No</span>` : `<span class="offer-no">—</span>`;

    // Flag badge
    const flagHtml = c.flagged
      ? `<span class="flag-badge flag-yes">🚩 Review</span>`
      : `<span class="flag-badge flag-no">—</span>`;

    // Review status badge
    let reviewHtml = `<span class="review-badge review-na">—</span>`;
    if (c.flagged && !c.review_status)
      reviewHtml = `<span class="review-badge review-pending">Pending</span>`;
    else if (c.review_status === "accepted")
      reviewHtml = `<span class="review-badge review-accepted">✓ Accepted</span>`;
    else if (c.review_status === "rejected")
      reviewHtml = `<span class="review-badge review-rejected">✕ Rejected</span>`;

    // Actions
    let actionsHtml = `<button class="btn-edit" onclick="editStudent('${c.id}')">Edit →</button>`;
    if (canReview && c.flagged && c.review_status !== "accepted" && c.review_status !== "rejected") {
      actionsHtml += ` <button class="btn-review" onclick="openReviewModal('${c.id}')">Review</button>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="row-num">${i + 1}</td>
      <td class="td-name">${escHtml(c.name)}</td>
      <td class="td-email">${escHtml(c.email)}</td>
      <td><span class="status-badge ${statusClass}">${escHtml(c.interview_status || "—")}</span></td>
      <td>${c.screening_score !== null && c.screening_score !== undefined ? c.screening_score : "—"}</td>
      <td>${offerHtml}</td>
      <td><span class="exc-badge ${excClass}">${c.exception_count}</span></td>
      <td>${flagHtml}</td>
      <td>${reviewHtml}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">${actionsHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function addStudent()         { window.location.href = `form.html?batch_id=${batchId}`; }
function editStudent(id)      { window.location.href = `form.html?batch_id=${batchId}&candidate_id=${id}`; }

// ── Review Modal ──────────────────────────────────────────────────────────────
let reviewingCandidateId = null;

function openReviewModal(candidateId) {
  reviewingCandidateId = candidateId;
  const c = allCandidates.find(x => x.id === candidateId);
  if (!c) return;

  document.getElementById("reviewNote").value = "";
  document.getElementById("reviewSummary").innerHTML = `
    <div class="review-flag-warn">
      🚩 This candidate has ${c.exception_count} exception${c.exception_count !== 1 ? "s" : ""} and is flagged for manager review.
    </div>
    <div class="review-row"><span class="rl">Name</span><span class="rv">${escHtml(c.name)}</span></div>
    <div class="review-row"><span class="rl">Email</span><span class="rv">${escHtml(c.email)}</span></div>
    <div class="review-row"><span class="rl">Interview Status</span><span class="rv">${escHtml(c.interview_status || "—")}</span></div>
    <div class="review-row"><span class="rl">Test Score</span><span class="rv">${c.screening_score ?? "—"}</span></div>
    <div class="review-row"><span class="rl">Offer Letter</span><span class="rv">${c.offer_letter_sent === true ? "Yes" : c.offer_letter_sent === false ? "No" : "—"}</span></div>
    <div class="review-row"><span class="rl">Exceptions</span><span class="rv">${c.exception_count}</span></div>
  `;
  document.getElementById("reviewModal").classList.remove("hidden");
}

function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("hidden");
  reviewingCandidateId = null;
}

function handleReviewOverlay(e) {
  if (e.target === document.getElementById("reviewModal")) closeReviewModal();
}

async function submitReview(decision) {
  if (!reviewingCandidateId) return;
  const note = document.getElementById("reviewNote").value.trim();

  try {
    const res  = await fetch(
      `${API_BASE}/api/batches/${batchId}/candidates/${reviewingCandidateId}/review`,
      {
        method:  "PATCH",
        headers: authHeaders(),
        body:    JSON.stringify({ review_status: decision, review_note: note || null }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Review failed.");
    closeReviewModal();
    showToast(`Candidate ${decision === "accepted" ? "accepted ✓" : "rejected ✕"}`);
    loadCandidates();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── CSV (all form fields) ─────────────────────────────────────────────────────
function downloadCSV() {
  if (allCandidates.length === 0) { showToast("No students to export.", "error"); return; }

  const headers = [
    "#", "Name", "Email", "Phone", "Date of Birth",
    "Qualification", "Graduation Year", "Score/CGPA", "Score Mode",
    "Screening Score", "Interview Status", "Aadhaar", "Offer Letter Sent",
    "Exception Count", "Flagged", "Review Status", "Reviewed By", "Review Note"
  ];

  const rows = allCandidates.map((c, i) => {
    const d = c.data || {};
    return [
      i + 1,
      csvCell(c.name),
      csvCell(c.email),
      csvCell(d.phone),
      csvCell(d.date_of_birth),
      csvCell(d.qualification),
      csvCell(d.graduation_year),
      csvCell(d.percentage_cgpa),
      csvCell(d.score_mode),
      csvCell(c.screening_score),
      csvCell(c.interview_status),
      csvCell(d.aadhaar),
      c.offer_letter_sent === true ? "Yes" : c.offer_letter_sent === false ? "No" : "",
      c.exception_count,
      c.flagged ? "Yes" : "No",
      csvCell(c.review_status),
      csvCell(c.reviewed_by),
      csvCell(c.review_note),
    ];
  });

  const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${currentBatch?.name || "batch"}_students.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV downloaded!");
}

function csvCell(val) {
  if (val === null || val === undefined) return "";
  return `"${String(val).replace(/"/g, '""')}"`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadBatch();
loadCandidates();