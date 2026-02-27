// form.js – AdmitGuard Candidate Admission Form

const API_BASE = "http://localhost:8000";

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
if (!token) window.location.href = "login.html";

const user = JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("user") || "{}");
document.getElementById("userName").textContent   = user.name  || "User";
document.getElementById("userAvatar").textContent = (user.name || "U")[0].toUpperCase();

// ── URL params ────────────────────────────────────────────────────────────────
const params      = new URLSearchParams(window.location.search);
const batchId     = params.get("batch_id");
const candidateId = params.get("candidate_id"); // null = new, set = edit
if (!batchId) window.location.href = "dashboard.html";

// ── State ─────────────────────────────────────────────────────────────────────
let rulesConfig    = null;   // loaded from batch API
let scoreMode      = "percent"; // percent | cgpa
let fieldStates    = {};     // { fieldKey: "ok" | "error" | "warn" | "excused" }
let exceptions     = {};     // { fieldKey: { checked: bool, reason: string } }

const RATIONALE_MIN_LENGTH = 30;
const RATIONALE_KEYWORDS   = ["approved by", "special case", "documentation pending", "waiver granted"];

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
  t._timer = setTimeout(() => { t.className = ""; }, 4000);
}

// ── Nav helpers ───────────────────────────────────────────────────────────────
function toggleUserDropdown() {
  document.getElementById("userDropdown").classList.toggle("open");
}
document.addEventListener("click", (e) => {
  if (!document.getElementById("userMenu").contains(e.target))
    document.getElementById("userDropdown").classList.remove("open");
});
function handleLogout() {
  sessionStorage.clear(); localStorage.clear();
  window.location.href = "login.html";
}

// ── Section toggle ────────────────────────────────────────────────────────────
function toggleSection(n) {
  const body    = document.getElementById(`body${n}`);
  const chevron = document.getElementById(`chevron${n}`);
  const isOpen  = body.classList.contains("open");
  body.classList.toggle("open", !isOpen);
  chevron.classList.toggle("open", !isOpen);
}

// ── Score mode (% vs CGPA) ────────────────────────────────────────────────────
function setScoreMode(mode) {
  scoreMode = mode;
  document.getElementById("modePercent").classList.toggle("active", mode === "percent");
  document.getElementById("modeCgpa").classList.toggle("active",    mode === "cgpa");
  const hint    = document.getElementById("scoreHint");
  const input   = document.getElementById("percentage_cgpa");
  if (mode === "percent") {
    hint.textContent      = "Enter percentage (0–100)";
    input.placeholder     = "e.g. 75";
    input.max             = "100";
    input.step            = "0.01";
  } else {
    hint.textContent      = "Enter CGPA (0–10)";
    input.placeholder     = "e.g. 7.5";
    input.max             = "10";
    input.step            = "0.01";
  }
  validateField("percentage_cgpa");
}

// ── Load batch (for rules config + breadcrumb) ────────────────────────────────
async function loadBatch() {
  try {
    const res  = await fetch(`${API_BASE}/api/batches/${batchId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error("Batch not found.");

    rulesConfig = data.rules_config || DEFAULT_RULES_CONFIG;

    // Breadcrumb
    const batchLink = document.getElementById("breadcrumbBatch");
    batchLink.textContent = data.name;
    batchLink.href        = `batch.html?id=${batchId}`;

    // Populate qualification dropdown from rules
    const qualRule = rulesConfig.qualification;
    if (qualRule?.allowed) {
      const sel = document.getElementById("qualification");
      qualRule.allowed.forEach(q => {
        const opt   = document.createElement("option");
        opt.value   = q;
        opt.textContent = q;
        sel.appendChild(opt);
      });
    }

    // If editing, load candidate data
    if (candidateId) {
      document.getElementById("breadcrumbForm").textContent = "Edit Student";
      document.getElementById("formTitle").textContent      = "Edit Candidate";
      await loadCandidate();
    }

  } catch (err) {
    showToast(err.message, "error");
  }
}

// ── Load candidate for edit ───────────────────────────────────────────────────
async function loadCandidate() {
  try {
    const res  = await fetch(
      `${API_BASE}/api/batches/${batchId}/candidates/${candidateId}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error("Candidate not found.");
    prefillForm(data);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function prefillForm(c) {
  const d = c.data || {};
  setVal("full_name",        d.full_name        || c.name  || "");
  setVal("email",            d.email            || c.email || "");
  setVal("phone",            d.phone            || "");
  setVal("date_of_birth",    d.date_of_birth    || "");
  setVal("qualification",    d.qualification    || "");
  setVal("graduation_year",  d.graduation_year  || "");
  setVal("percentage_cgpa",  d.percentage_cgpa  || "");
  setVal("screening_score",  c.screening_score  !== undefined ? c.screening_score : (d.screening_score || ""));
  setVal("interview_status", c.interview_status || "");
  setVal("aadhaar",          d.aadhaar          || "");
  setVal("offer_letter",     c.offer_letter_sent === true ? "true" : c.offer_letter_sent === false ? "false" : "");

  // Restore score mode
  if (d.score_mode) setScoreMode(d.score_mode);

  // Restore exceptions
  if (d.exceptions) {
    Object.entries(d.exceptions).forEach(([field, exc]) => {
      exceptions[field] = exc;
      if (exc.checked) {
        const cb = document.getElementById(`excCheck_${field}`);
        if (cb) cb.checked = true;
        const ta = document.getElementById(`excReason_${field}`);
        if (ta) { ta.value = exc.reason || ""; ta.classList.remove("hidden"); }
      }
    });
  }

  // Re-validate all
  ALL_FIELDS.forEach(f => validateField(f));
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Validation engine ─────────────────────────────────────────────────────────
const ALL_FIELDS = [
  "full_name", "email", "phone", "date_of_birth",
  "qualification", "graduation_year", "percentage_cgpa",
  "screening_score", "interview_status",
  "aadhaar", "offer_letter_sent"
];

function validateField(fieldKey) {
  if (!rulesConfig) return;

  const rule = rulesConfig[fieldKey];
  if (!rule) return;

  // Get value
  let value;
  if (fieldKey === "offer_letter_sent") {
    value = document.getElementById("offer_letter")?.value;
  } else {
    value = document.getElementById(fieldKey)?.value;
  }

  const result = runRule(fieldKey, rule, value);
  applyValidationResult(fieldKey, result);
  updateExceptionCounter();
  updateSectionStatuses();
}

function runRule(fieldKey, rule, value) {
  const type = rule.type; // strict | soft | system

  // ── Full Name ──
  if (fieldKey === "full_name") {
    if (!value || value.trim().length < 2)
      return { status: "error", msg: "Full name is required (min 2 characters)." };
    if (/\d/.test(value))
      return { status: "error", msg: "Full name must not contain numbers." };
    return { status: "ok" };
  }

  // ── Email ──
  if (fieldKey === "email") {
    if (!value || !value.trim())
      return { status: "error", msg: "Email address is required." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return { status: "error", msg: "Enter a valid email address." };
    return { status: "ok" };
  }

  // ── Phone ──
  if (fieldKey === "phone") {
    if (!value || !value.trim())
      return { status: "error", msg: "Phone number is required." };
    if (!/^[6-9]\d{9}$/.test(value.trim()))
      return { status: "error", msg: "Enter a valid 10-digit Indian mobile number (starts with 6/7/8/9)." };
    return { status: "ok" };
  }

  // ── Date of Birth ──
  if (fieldKey === "date_of_birth") {
    if (!value) return { status: "none" };
    const dob      = new Date(value);
    const today    = new Date();
    let age        = today.getFullYear() - dob.getFullYear();
    const m        = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    const minAge   = rule.min_age || 18;
    const maxAge   = rule.max_age || 35;
    if (age < minAge || age > maxAge)
      return { status: "warn", msg: `Candidate age (${age}) must be between ${minAge} and ${maxAge} years. Exception required.` };
    return { status: "ok" };
  }

  // ── Qualification ──
  if (fieldKey === "qualification") {
    if (!value) return { status: "error", msg: "Please select a qualification." };
    if (rule.allowed && !rule.allowed.includes(value))
      return { status: "error", msg: `Qualification must be one of: ${rule.allowed.join(", ")}.` };
    return { status: "ok" };
  }

  // ── Graduation Year ──
  if (fieldKey === "graduation_year") {
    if (!value) return { status: "none" };
    const yr  = parseInt(value);
    const min = rule.min || 2015;
    const max = rule.max || 2025;
    if (yr < min || yr > max)
      return { status: "warn", msg: `Graduation year must be between ${min} and ${max}. Exception required.` };
    return { status: "ok" };
  }

  // ── Percentage / CGPA ──
  if (fieldKey === "percentage_cgpa") {
    if (!value) return { status: "none" };
    const num = parseFloat(value);
    if (scoreMode === "percent") {
      const min = rule.min_percent || 60;
      if (num < min)
        return { status: "warn", msg: `Percentage must be ≥ ${min}%. Entered: ${num}%. Exception required.` };
    } else {
      const min = rule.min_cgpa || 6.0;
      if (num < min)
        return { status: "warn", msg: `CGPA must be ≥ ${min} (10-point scale). Entered: ${num}. Exception required.` };
    }
    return { status: "ok" };
  }

  // ── Screening Score ──
  if (fieldKey === "screening_score") {
    if (!value) return { status: "none" };
    const score = parseFloat(value);
    const min   = rule.min || 40;
    if (score < min)
      return { status: "warn", msg: `Screening score must be ≥ ${min}/100. Entered: ${score}. Exception required.` };
    return { status: "ok" };
  }

  // ── Interview Status ──
  if (fieldKey === "interview_status") {
    if (!value) return { status: "error", msg: "Interview status is required." };
    if (value === "Rejected")
      return { status: "error", msg: "Candidate is Rejected. Submission blocked." };
    if (rule.allowed && !rule.allowed.includes(value))
      return { status: "error", msg: `Status must be one of: ${rule.allowed.join(", ")}.` };
    return { status: "ok" };
  }

  // ── Aadhaar ──
  if (fieldKey === "aadhaar") {
    if (!value || !value.trim())
      return { status: "error", msg: "Aadhaar number is required." };
    if (!/^\d{12}$/.test(value.trim()))
      return { status: "error", msg: "Aadhaar must be exactly 12 digits with no letters." };
    return { status: "ok" };
  }

  // ── Offer Letter ──
  if (fieldKey === "offer_letter_sent") {
    if (!value) return { status: "none" };
    const interviewStatus = document.getElementById("interview_status")?.value;
    if (value === "true" && !["Cleared", "Waitlisted"].includes(interviewStatus))
      return { status: "error", msg: "Offer letter can only be 'Yes' if Interview Status is Cleared or Waitlisted." };
    return { status: "ok" };
  }

  return { status: "ok" };
}

// ── Apply validation result to DOM ────────────────────────────────────────────
function applyValidationResult(fieldKey, result) {
  const inputId  = fieldKey === "offer_letter_sent" ? "offer_letter" : fieldKey;
  const input    = document.getElementById(inputId);
  const errEl    = document.getElementById(`err_${fieldKey}`);
  const warnEl   = document.getElementById(`warn_${fieldKey}`);
  const excEl    = document.getElementById(`exc_${fieldKey}`);

  if (!input) return;

  // Clear states
  input.classList.remove("input-error", "input-warn");
  errEl?.classList.add("hidden");
  warnEl?.classList.add("hidden");

  const rule = rulesConfig[fieldKey];
  const isExcused = exceptions[fieldKey]?.checked &&
    validateRationaleValue(exceptions[fieldKey]?.reason || "");

  if (result.status === "error") {
    input.classList.add("input-error");
    if (errEl) { errEl.textContent = result.msg; errEl.classList.remove("hidden"); }
    excEl?.classList.add("hidden");
    fieldStates[fieldKey] = "error";

  } else if (result.status === "warn") {
    if (isExcused) {
      fieldStates[fieldKey] = "excused";
    } else {
      input.classList.add("input-warn");
      if (warnEl) { warnEl.textContent = `⚠ ${result.msg}`; warnEl.classList.remove("hidden"); }
      excEl?.classList.remove("hidden");
      fieldStates[fieldKey] = "warn";
    }

  } else {
    excEl?.classList.add("hidden");
    fieldStates[fieldKey] = result.status === "none" ? "none" : "ok";
  }
}

// ── Exception toggle ──────────────────────────────────────────────────────────
function toggleException(fieldKey) {
  const cb = document.getElementById(`excCheck_${fieldKey}`);
  const ta = document.getElementById(`excReason_${fieldKey}`);
  if (!cb || !ta) return;

  if (!exceptions[fieldKey]) exceptions[fieldKey] = { checked: false, reason: "" };
  exceptions[fieldKey].checked = cb.checked;

  ta.classList.toggle("hidden", !cb.checked);
  if (!cb.checked) {
    ta.value = "";
    exceptions[fieldKey].reason = "";
    document.getElementById(`excErr_${fieldKey}`)?.classList.add("hidden");
  }

  validateField(fieldKey);
  updateExceptionCounter();
}

// ── Rationale validation ──────────────────────────────────────────────────────
function validateRationale(fieldKey) {
  const ta     = document.getElementById(`excReason_${fieldKey}`);
  const errEl  = document.getElementById(`excErr_${fieldKey}`);
  if (!ta) return;

  const value = ta.value.trim();
  if (!exceptions[fieldKey]) exceptions[fieldKey] = { checked: true, reason: value };
  exceptions[fieldKey].reason = value;

  const isValid = validateRationaleValue(value);
  if (errEl) {
    if (!isValid && value.length > 0) {
      errEl.textContent = `Rationale must be ≥ ${RATIONALE_MIN_LENGTH} characters and include one of: "${RATIONALE_KEYWORDS.join('", "')}".`;
      errEl.classList.remove("hidden");
    } else {
      errEl.classList.add("hidden");
    }
  }

  validateField(fieldKey);
  updateExceptionCounter();
}

function validateRationaleValue(value) {
  if (!value || value.length < RATIONALE_MIN_LENGTH) return false;
  return RATIONALE_KEYWORDS.some(kw => value.toLowerCase().includes(kw));
}

// ── Exception counter ─────────────────────────────────────────────────────────
function updateExceptionCounter() {
  // Count fields with soft violations that are excused (valid rationale)
  const excusedCount = Object.entries(fieldStates).filter(([k, v]) => {
    return v === "excused" ||
      (v === "warn" && exceptions[k]?.checked && validateRationaleValue(exceptions[k]?.reason || ""));
  }).length;

  // Count active soft violations (warned but not excused)
  const warnCount = Object.values(fieldStates).filter(v => v === "warn").length;

  const totalExceptions = excusedCount +
    Object.entries(exceptions).filter(([k, e]) => e.checked).length;

  // Use the number of toggled exceptions as the display count
  const displayCount = Object.values(exceptions).filter(e => e.checked).length;

  const counter = document.getElementById("excCounter");
  const text    = document.getElementById("excCounterText");
  const banner  = document.getElementById("flagBanner");

  text.textContent = `${displayCount} exception${displayCount !== 1 ? "s" : ""}`;

  counter.classList.remove("has-exceptions", "flagged");
  if (displayCount > 2) {
    counter.classList.add("flagged");
    banner?.classList.remove("hidden");
  } else if (displayCount > 0) {
    counter.classList.add("has-exceptions");
    banner?.classList.add("hidden");
  } else {
    banner?.classList.add("hidden");
  }
}

// ── Section status ────────────────────────────────────────────────────────────
const SECTION_FIELDS = {
  1: ["full_name", "email", "phone", "date_of_birth"],
  2: ["qualification", "graduation_year", "percentage_cgpa"],
  3: ["screening_score", "interview_status"],
  4: ["aadhaar", "offer_letter_sent"],
};

function updateSectionStatuses() {
  Object.entries(SECTION_FIELDS).forEach(([sec, fields]) => {
    const el      = document.getElementById(`sec${sec}Status`);
    if (!el) return;
    const hasError = fields.some(f => fieldStates[f] === "error");
    const hasWarn  = fields.some(f => fieldStates[f] === "warn");
    if (hasError)     { el.textContent = "⚠ Errors"; el.style.color = "var(--error)"; }
    else if (hasWarn) { el.textContent = "⚠ Warnings"; el.style.color = "var(--warn)"; }
    else              { el.textContent = ""; }
  });
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  // Validate all fields first
  ALL_FIELDS.forEach(f => validateField(f));

  // Check strict errors
  const errors = Object.entries(fieldStates).filter(([, v]) => v === "error");
  if (errors.length > 0) {
    showToast("Please fix all errors before submitting.", "error");
    // Open sections with errors
    Object.entries(SECTION_FIELDS).forEach(([sec, fields]) => {
      if (fields.some(f => fieldStates[f] === "error")) {
        document.getElementById(`body${sec}`).classList.add("open");
        document.getElementById(`chevron${sec}`).classList.add("open");
      }
    });
    return;
  }

  // Check soft violations without valid rationale
  const unexcusedWarnings = Object.entries(fieldStates)
    .filter(([k, v]) => v === "warn")
    .filter(([k]) => {
      const exc = exceptions[k];
      return !exc?.checked || !validateRationaleValue(exc?.reason || "");
    });

  if (unexcusedWarnings.length > 0) {
    showToast("Soft rule violations must be acknowledged with a valid rationale.", "error");
    return;
  }

  // Build payload
  const exceptionCount = Object.values(exceptions).filter(e => e.checked).length;
  const flagged        = exceptionCount > 2;

  const interviewStatus = document.getElementById("interview_status").value;
  const offerLetterVal  = document.getElementById("offer_letter").value;

  const payload = {
    name:               document.getElementById("full_name").value.trim(),
    email:              document.getElementById("email").value.trim(),
    interview_status:   interviewStatus || null,
    screening_score:    parseFloat(document.getElementById("screening_score").value) || null,
    offer_letter_sent:  offerLetterVal === "true" ? true : offerLetterVal === "false" ? false : null,
    exception_count:    exceptionCount,
    flagged:            flagged,
    data: {
      full_name:        document.getElementById("full_name").value.trim(),
      email:            document.getElementById("email").value.trim(),
      phone:            document.getElementById("phone").value.trim(),
      date_of_birth:    document.getElementById("date_of_birth").value,
      qualification:    document.getElementById("qualification").value,
      graduation_year:  parseInt(document.getElementById("graduation_year").value) || null,
      percentage_cgpa:  parseFloat(document.getElementById("percentage_cgpa").value) || null,
      score_mode:       scoreMode,
      screening_score:  parseFloat(document.getElementById("screening_score").value) || null,
      interview_status: interviewStatus || null,
      aadhaar:          document.getElementById("aadhaar").value.trim(),
      offer_letter_sent: offerLetterVal === "true" ? true : offerLetterVal === "false" ? false : null,
      exceptions:       exceptions,
    },
  };

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  document.getElementById("submitBtnText").innerHTML = `<span class="spinner"></span> Saving…`;

  try {
    let res, data;
    if (candidateId) {
      // Edit mode — PUT
      res  = await fetch(`${API_BASE}/api/batches/${batchId}/candidates/${candidateId}`, {
        method:  "PUT",
        headers: authHeaders(),
        body:    JSON.stringify(payload),
      });
    } else {
      // New — POST
      res  = await fetch(`${API_BASE}/api/batches/${batchId}/candidates`, {
        method:  "POST",
        headers: authHeaders(),
        body:    JSON.stringify(payload),
      });
    }
    data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Submission failed.");

    showSuccessScreen(payload, flagged, exceptionCount);

  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    document.getElementById("submitBtnText").textContent = "Submit Candidate";
  }
}

// ── Success screen ────────────────────────────────────────────────────────────
function showSuccessScreen(payload, flagged, excCount) {
  const d = payload.data;
  document.getElementById("successSummary").innerHTML = `
    <div class="summary-row"><span class="s-label">Name</span><span class="s-value">${escHtml(d.full_name)}</span></div>
    <div class="summary-row"><span class="s-label">Email</span><span class="s-value">${escHtml(d.email)}</span></div>
    <div class="summary-row"><span class="s-label">Qualification</span><span class="s-value">${escHtml(d.qualification || "—")}</span></div>
    <div class="summary-row"><span class="s-label">Interview Status</span><span class="s-value">${escHtml(d.interview_status || "—")}</span></div>
    <div class="summary-row"><span class="s-label">Exceptions</span><span class="s-value ${flagged ? 's-flagged' : ''}">${excCount} ${flagged ? "🚩 Flagged" : ""}</span></div>
  `;
  document.getElementById("successOverlay").classList.remove("hidden");
}

function addAnother() {
  document.getElementById("successOverlay").classList.add("hidden");
  // Reset form
  ALL_FIELDS.forEach(f => {
    const inputId = f === "offer_letter_sent" ? "offer_letter" : f;
    const el = document.getElementById(inputId);
    if (el) el.value = "";
    const errEl  = document.getElementById(`err_${f}`);
    const warnEl = document.getElementById(`warn_${f}`);
    const excEl  = document.getElementById(`exc_${f}`);
    errEl?.classList.add("hidden");
    warnEl?.classList.add("hidden");
    excEl?.classList.add("hidden");
    el?.classList.remove("input-error", "input-warn");
  });
  fieldStates = {};
  exceptions  = {};
  updateExceptionCounter();
  updateSectionStatuses();
}

function goToBatch() {
  window.location.href = `batch.html?id=${batchId}`;
}

function cancelForm() {
  window.location.href = `batch.html?id=${batchId}`;
}

function escHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadBatch();