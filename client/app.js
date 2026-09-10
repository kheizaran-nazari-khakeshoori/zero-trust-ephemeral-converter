document.addEventListener('DOMContentLoaded', () => {
  const regBtn = document.getElementById('regBtn');
  const login1Btn = document.getElementById('login1Btn');
  const login2Btn = document.getElementById('login2Btn');
  const logoutBtn = document.getElementById('logoutBtn');

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

  // Allow overriding API via <meta name="api-base" content="..."> or localStorage
  const API_BASE = (() => {
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    const stored = localStorage.getItem('apiBase');
    if (stored) return stored.replace(/\/$/, '');
    // Default: same host, port 5000 when served from :5500, otherwise relative
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      if (location.port === '5500') return 'http://127.0.0.1:5000';
    }
    return location.origin.replace(/\/$/, '');
  })();

  let tempAuthToken = '';
  let accessToken = sessionStorage.getItem('accessToken') || '';
  let selectedFile = null;

  function setAuthStatus(msg, isError = true) {
    authStatus.innerText = msg;
    authStatus.style.color = isError ? '#f87171' : '#4ade80';
  }

  function updateAuthUI() {
    const loggedIn = Boolean(accessToken);
    if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-block' : 'none';
    if (loggedIn) {
      historyStatus.innerText = '';
    } else {
      historyStatus.innerText = 'Sign in to view your history.';
      historyList.replaceChildren();
    }
  }

  function clearAuth() {
    accessToken = '';
    tempAuthToken = '';
    sessionStorage.removeItem('accessToken');
    step1Box.style.display = 'block';
    step2Box.style.display = 'none';
    mfaDisplay.style.display = 'none';
    updateAuthUI();
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
    } catch {
      historyStatus.innerText = 'Could not load conversion history.';
    }
  }

  // 1. REGISTER USER
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
        if (data.otpauthUrl) {
          mfaSecretKey.title = data.otpauthUrl;
        }
        setAuthStatus('Registered! Save the key in your authenticator app, then do Step 1 login.', false);
      } else {
        setAuthStatus(data.error || 'Registration failed.');
      }
    } catch {
      setAuthStatus(`Cannot connect to ${API_BASE}`);
    } finally {
      regBtn.disabled = false;
    }
  });

  // 2. STEP 1: PASSWORD LOGIN
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
        tempAuthToken = data.tempToken;
        step1Box.style.display = 'none';
        mfaDisplay.style.display = 'none';
        step2Box.style.display = 'block';
        setAuthStatus('Password accepted! Enter your 6-digit code.', false);
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

  // 3. STEP 2: TOTP CODE VERIFICATION
  login2Btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const code = totpCode.value.trim();
    const email = authEmail.value.trim();

    if (!code || code.length !== 6) return setAuthStatus('Enter a 6-digit code.');
    if (!/^\d{6}$/.test(code)) return setAuthStatus('Code must be 6 digits.');

    login2Btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/login-step2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tempToken: tempAuthToken, totpCode: code })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        accessToken = data.accessToken;
        sessionStorage.setItem('accessToken', accessToken);
        setAuthStatus('Authentication complete! You can now convert files.', false);
        step2Box.style.display = 'none';
        updateAuthUI();
        loadHistory();
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
    logoutBtn.addEventListener('click', () => {
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
          // res.response is a Blob when responseType is blob — need to read as text
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
    } catch {
      statusMsg.innerText = `Failed to connect to ${API_BASE}. Is the server running?`;
      statusMsg.style.color = '#f87171';
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerText = originalLabel;
    }
  });

  refreshHistoryBtn.addEventListener('click', loadHistory);
  updateAuthUI();
  if (accessToken) {
    // Validate session on load — hide converter if invalid
    loadHistory().then(() => {
      if (!accessToken) clearAuth();
    });
  }
});


//handles user registration, login with TOTP, file selection via drag-and-drop or file input, and uploading files for conversion. It also manages authentication state and displays conversion history.
