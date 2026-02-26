// login.js – AdmitGuard Auth Frontend
// Talks to FastAPI backend at API_BASE

const API_BASE = "http://localhost:8000";

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("tabLogin").classList.toggle("active",  isLogin);
  document.getElementById("tabSignup").classList.toggle("active", !isLogin);
  document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
  document.getElementById("signupForm").classList.toggle("hidden",  isLogin);
  document.getElementById("cardTitle").textContent = isLogin
    ? "Welcome back"
    : "Create an account";
  clearErrors();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show ${type === "error" ? "error-toast" : "success"}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ""; }, 3500);
}

// ── Field errors ──────────────────────────────────────────────────────────────
function setError(errId, msg) {
  const errEl = document.getElementById(errId);
  if (errEl) errEl.textContent = msg;
  const inputId = errId.replace("Err", "");
  const input   = document.getElementById(inputId);
  if (input) input.classList.toggle("error", !!msg);
}

function clearErrors() {
  ["loginEmailErr","loginPassErr","signupNameErr","signupEmailErr","signupPassErr"]
    .forEach(id => setError(id, ""));
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Button loading state ──────────────────────────────────────────────────────
function setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  if (on) {
    btn.disabled = true;
    btn.dataset.original = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span>Loading…`;
  } else {
    btn.disabled  = false;
    btn.textContent = btn.dataset.original || btn.textContent;
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin() {
  clearErrors();
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  let valid = true;

  if (!email)                  { setError("loginEmailErr", "Email is required.");          valid = false; }
  else if (!validateEmail(email)) { setError("loginEmailErr", "Enter a valid email address."); valid = false; }
  if (!password)               { setError("loginPassErr",  "Password is required.");      valid = false; }
  if (!valid) return;

  setLoading("loginBtn", true);
  try {
    const res  = await fetch(`${API_BASE}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed.");

    sessionStorage.setItem("access_token", data.access_token);
    sessionStorage.setItem("user", JSON.stringify(data.user));

    showToast(`Welcome back, ${data.user.name || email}! 👋`);
    setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setLoading("loginBtn", false);
  }
}

// ── Signup ────────────────────────────────────────────────────────────────────
async function handleSignup() {
  clearErrors();
  const name     = document.getElementById("signupName").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  let valid = true;

  if (!name)                      { setError("signupNameErr", "Full name is required.");           valid = false; }
  if (!email)                     { setError("signupEmailErr", "Email is required.");              valid = false; }
  else if (!validateEmail(email)) { setError("signupEmailErr", "Enter a valid email address.");    valid = false; }
  if (!password)                  { setError("signupPassErr", "Password is required.");            valid = false; }
  else if (password.length < 8)   { setError("signupPassErr", "Password must be at least 8 chars."); valid = false; }
  if (!valid) return;

  setLoading("signupBtn", true);
  try {
    const res  = await fetch(`${API_BASE}/api/auth/signup`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Signup failed.");

    sessionStorage.setItem("access_token", data.access_token);
    sessionStorage.setItem("user", JSON.stringify(data.user));

    showToast(`Account created! Welcome, ${name}! 🎉`);
    setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setLoading("signupBtn", false);
  }
}

// ── Enter key to submit ───────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const loginVisible = !document.getElementById("loginForm").classList.contains("hidden");
  loginVisible ? handleLogin() : handleSignup();
});