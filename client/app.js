document.addEventListener('DOMContentLoaded', () => {
  const regBtn = document.getElementById('regBtn');
  const login1Btn = document.getElementById('login1Btn');
  const login2Btn = document.getElementById('login2Btn');
  const logoutBtn = document.getElementById('logoutBtn');

  const authCard = document.getElementById('authCard');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authStatus = document.getElementById('authStatus');

  const mfaDisplay = document.getElementById('mfaDisplay');
  const mfaSecretKey = document.getElementById('mfaSecretKey');

  const step1Box = document.getElementById('step1Box');
  const step2Box = document.getElementById('step2Box');
  const totpCode = document.getElementById('totpCode');

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileLabel = document.getElementById('fileLabel');
  const uploadBtn = document.getElementById('uploadBtn');
  const statusMsg = document.getElementById('status');
  const historyList = document.getElementById('historyList');
  const historyStatus = document.getElementById('historyStatus');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

  const userGreeting = document.getElementById('userGreeting');
  const userEmailEl = document.getElementById('userEmail');
  const welcomeMsg = document.getElementById('welcomeMsg');

  const API_BASE = (() => {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    const stored = localStorage.getItem('apiBase');
    if (stored) return stored.replace(/\/$/, '');
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      if (location.port === '5500') return 'http://127.0.0.1:5000';
    }
    return location.origin.replace(/\/$/, '');
  })();

  // Cross-window shared state: use localStorage so second window/tab sees the same login
  let tempAuthToken = localStorage.getItem('tempToken') || '';
  let tempEmail = localStorage.getItem('tempEmail') || '';
  let accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  let currentUserEmail = localStorage.getItem('userEmail') || '';
  let selectedFile = null;

  // Keep sessionStorage in sync for legacy
  if (accessToken) sessionStorage.setItem('accessToken', accessToken);

  function setAuthStatus(msg, isError = true) {
    authStatus.innerText = msg;
    authStatus.style.color = isError ? '#f87171' : '#4ade80';
  }

  function persistAccessToken(token, email) {
    accessToken = token;
    currentUserEmail = email || currentUserEmail;
    localStorage.setItem('accessToken', token);
    sessionStorage.setItem('accessToken', token);
    if (email) localStorage.setItem('userEmail', email);
    // clear temp state once verified
    localStorage.removeItem('tempToken');
    localStorage.removeItem('tempEmail');
    tempAuthToken = '';
    tempEmail = '';
  }

  function persistTempToken(token, email) {
    tempAuthToken = token;
    tempEmail = email;
    localStorage.setItem('tempToken', token);
    localStorage.setItem('tempEmail', email);
  }

  function clearAuth() {
    accessToken = '';
    tempAuthToken = '';
    tempEmail = '';
    currentUserEmail = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tempToken');
    localStorage.removeItem('tempEmail');
    sessionStorage.removeItem('accessToken');
    if (userGreeting) userGreeting.style.display = 'none';
    if (authCard) authCard.style.display = 'block';
    step1Box.style.display = 'block';
    step2Box.style.display = 'none';
    mfaDisplay.style.display = 'none';
    historyList.replaceChildren();
    historyStatus.innerText = 'Sign in to view your history.';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  async function fetchProfile() {
    if (!accessToken) return null;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.status === 401) {
        clearAuth();
        setAuthStatus('Session expired. Please log in again.');
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      currentUserEmail = data.email;
      localStorage.setItem('userEmail', data.email);
      return data;
    } catch {
      return null;
    }
  }

  async function updateAuthUI() {
    const loggedIn = Boolean(accessToken);
    if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-block' : 'none';

    if (loggedIn) {
      // Show personalized dashboard
      const profile = await fetchProfile();
      if (profile) {
        if (userEmailEl) userEmailEl.innerText = profile.email;
        if (welcomeMsg) welcomeMsg.innerText = `Welcome back! You have ${profile.jobs.length} file(s) converted before.`;
        if (userGreeting) userGreeting.style.display = 'block';
        // Hide step boxes, keep auth card minimal but show signed-in state
        step1Box.style.display = 'none';
        step2Box.style.display = 'none';
        mfaDisplay.style.display = 'none';
        setAuthStatus(`Verified as ${profile.email}. You are now on your dashboard.`, false);
      }
      // Render history from profile to avoid extra call
      if (profile && profile.jobs) {
        renderHistory(profile.jobs);
      } else {
        loadHistory();
      }
    } else {
      if (userGreeting) userGreeting.style.display = 'none';
      // If we have a temp token from another window, show Step 2 directly
      if (tempAuthToken && tempEmail) {
        authEmail.value = tempEmail;
        step1Box.style.display = 'none';
        step2Box.style.display = 'block';
        setAuthStatus('Password verified in another window. Enter your 6-digit code here.', false);
        totpCode.focus();
      } else {
        step1Box.style.display = 'block';
        step2Box.style.display = 'none';
        historyStatus.innerText = 'Sign in to view your history.';
        historyList.replaceChildren();
      }
    }
  }

  function renderHistory(jobs) {
    historyList.replaceChildren();
    if (!jobs || jobs.length === 0) {
      historyStatus.innerText = 'No conversions yet.';
      return;
    }
    historyStatus.innerText = '';
    for (const job of jobs) {
      const item = document.createElement('li');
      item.className = 'history-item';
      const file = document.createElement('span');
      file.className = 'history-file';
      file.innerText = job.originalFilename;
      const meta = document.createElement('span');
      meta.className = 'history-meta';
      meta.innerText = `${job.sourceType} → ${job.targetType} · ${new Date(job.createdAt).toLocaleString()}`;
      item.append(file, meta);
      historyList.append(item);
    }
  }

  function uploadForConversion(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE}/api/convert`);
      request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      request.responseType = 'blob';
      request.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => resolve(request));
      request.addEventListener('error', () => reject(new Error('Network error')));
      request.addEventListener('abort', () => reject(new Error('Upload aborted')));
      request.send(formData);
    });
  }

  async function loadHistory() {
    if (!accessToken) {
      historyStatus.innerText = 'Sign in to view your history.';
      return;
    }
    historyStatus.innerText = 'Loading history...';
    try {
      const response = await fetch(`${API_BASE}/api/history`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.status === 401) {
        clearAuth();
        setAuthStatus('Session expired. Please log in again.');
        historyStatus.innerText = 'Session expired.';
        return;
      }
      if (!response.ok) throw new Error('History request failed');
      const { jobs } = await response.json();
      renderHistory(jobs);
    } catch {
      historyStatus.innerText = 'Could not load conversion history.';
    }
  }

  // Listen for cross-window storage changes (register in one tab, verify in another)
  window.addEventListener('storage', (e) => {
    if (e.key === 'accessToken' || e.key === 'tempToken') {
      tempAuthToken = localStorage.getItem('tempToken') || '';
      tempEmail = localStorage.getItem('tempEmail') || '';
      accessToken = localStorage.getItem('accessToken') || '';
      if (accessToken) sessionStorage.setItem('accessToken', accessToken);
      updateAuthUI();
    }
  });

  // Prefill email from previous window
  if (tempEmail) authEmail.value = tempEmail;
  if (currentUserEmail && !authEmail.value) authEmail.value = currentUserEmail;

  // 1. REGISTER USER — can be done in Browser A, then continue in Browser B
  regBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    if (!email || !password) return setAuthStatus('Please enter an email and password.');
    if (password.length < 8) return setAuthStatus('Password must be at least 8 characters.');
    regBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        mfaDisplay.style.display = 'block';
        mfaSecretKey.innerText = data.mfaSecret;
        if (data.otpauthUrl) mfaSecretKey.title = data.otpauthUrl;
        // Remember email for second window
        localStorage.setItem('tempEmail', email.trim().toLowerCase());
        setAuthStatus('Registered! Save the key in your authenticator app. Now open a second window and do Step 1 login — or stay here and continue.', false);
      } else {
        setAuthStatus(data.error || 'Registration failed.');
      }
    } catch {
      setAuthStatus(`Cannot connect to ${API_BASE}`);
    } finally {
      regBtn.disabled = false;
    }
  });

  // 2. STEP 1: PASSWORD LOGIN — sets tempToken shared via localStorage for other window
  login1Btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    if (!email || !password) return setAuthStatus('Please enter email and password.');
    login1Btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/login-step1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        persistTempToken(data.tempToken, email.trim().toLowerCase());
        authEmail.value = email;
        step1Box.style.display = 'none';
        mfaDisplay.style.display = 'none';
        step2Box.style.display = 'block';
        setAuthStatus('Password accepted! Enter your 6-digit code here — or in your other window. Both will sync.', false);
        totpCode.focus();
      } else {
        setAuthStatus(data.error || 'Invalid credentials.');
      }
    } catch {
      setAuthStatus(`Cannot connect to ${API_BASE}`);
    } finally {
      login1Btn.disabled = false;
    }
  });

  // 3. STEP 2: TOTP CODE VERIFICATION — works from whichever window you use
  login2Btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const code = totpCode.value.trim();
    const email = (authEmail.value.trim() || tempEmail || currentUserEmail).trim();
    if (!code || code.length !== 6) return setAuthStatus('Enter a 6-digit code.');
    if (!/^\d{6}$/.test(code)) return setAuthStatus('Code must be 6 digits.');
    // Use temp token from this window or from the other window via localStorage
    const tokenToUse = tempAuthToken || localStorage.getItem('tempToken') || '';
    if (!tokenToUse) return setAuthStatus('No login session found. Please do Step 1 again.');
    if (!email) return setAuthStatus('Email is required for verification.');

    login2Btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/login-step2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tempToken: tokenToUse, totpCode: code })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        persistAccessToken(data.accessToken, email.toLowerCase());
        setAuthStatus('Authentication complete! Loading your dashboard...', false);
        step2Box.style.display = 'none';
        await updateAuthUI();
      } else {
        setAuthStatus(data.error || 'Invalid TOTP code.');
      }
    } catch {
      setAuthStatus(`Cannot connect to ${API_BASE}`);
    } finally {
      login2Btn.disabled = false;
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (accessToken) {
          await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        }
      } catch {}
      clearAuth();
      setAuthStatus('Signed out. Please log in again.', false);
    });
  }

  // 4. DRAG & DROP FILE SELECTION
  dropZone.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      selectedFile = files[0];
      fileLabel.innerText = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
      statusMsg.innerText = '';
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      fileLabel.innerText = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
      statusMsg.innerText = '';
    }
  });

  // 5. UPLOAD & CONVERT FILE
  uploadBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      statusMsg.innerText = 'Please select or drag a file first.';
      statusMsg.style.color = '#f87171';
      return;
    }
    if (!accessToken) {
      statusMsg.innerText = 'Please complete authentication first.';
      statusMsg.style.color = '#f87171';
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('targetFormat', document.getElementById('formatSelect').value);
    statusMsg.innerText = 'Preparing upload...';
    statusMsg.style.color = '#38bdf8';
    uploadBtn.disabled = true;
    const originalLabel = uploadBtn.innerText;
    uploadBtn.innerText = 'Converting...';
    try {
      const res = await uploadForConversion(formData, progress => {
        statusMsg.innerText = `Uploading… ${progress}%`;
      });
      if (res.status !== 200) {
        let errorMessage = 'Conversion failed.';
        try {
          const text = await res.response.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Conversion failed (${res.status}).`;
        }
        if (res.status === 401) {
          clearAuth();
          setAuthStatus('Session expired. Please log in again.');
        }
        statusMsg.innerText = errorMessage;
        statusMsg.style.color = '#f87171';
        return;
      }
      const blob = res.response;
      const ext = document.getElementById('formatSelect').value;
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `converted_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      statusMsg.innerText = 'File converted and downloaded successfully!';
      statusMsg.style.color = '#4ade80';
      loadHistory();
      // Also refresh greeting count
      fetchProfile().then(p => {
        if (p && welcomeMsg) welcomeMsg.innerText = `Welcome back! You have ${p.jobs.length} file(s) converted before.`;
      });
    } catch {
      statusMsg.innerText = `Failed to connect to ${API_BASE}. Is the server running?`;
      statusMsg.style.color = '#f87171';
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerText = originalLabel;
    }
  });

  refreshHistoryBtn.addEventListener('click', loadHistory);
  // Initial UI — handles all three cases: verified, step2-pending from other window, or fresh
  updateAuthUI();
});
