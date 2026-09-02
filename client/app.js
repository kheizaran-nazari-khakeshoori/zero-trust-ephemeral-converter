document.addEventListener('DOMContentLoaded', () => {
  const regBtn = document.getElementById('regBtn');
  const login1Btn = document.getElementById('login1Btn');
  const login2Btn = document.getElementById('login2Btn');
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

  let tempAuthToken = '';
  let selectedFile = null;

  function setAuthStatus(msg, isError = true) {
    authStatus.innerText = msg;
    authStatus.style.color = isError ? '#f87171' : '#4ade80';
  }

  // 1. REGISTER
  regBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) return setAuthStatus('Please fill in both email and password.');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        mfaSecretKey.innerText = data.mfaSecret;
        mfaDisplay.style.display = 'block';
        setAuthStatus('Registration successful! Save key and proceed to Step 1.', false);
      } else {
        setAuthStatus(data.error || 'User already exists.');
      }
    } catch (err) {
      setAuthStatus('Cannot connect to server at http://127.0.0.1:5000');
    }
  });

  // 2. STEP 1 LOGIN
  login1Btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) return setAuthStatus('Please enter email and password.');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login-step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        tempAuthToken = data.tempToken;
        step1Box.style.display = 'none';
        mfaDisplay.style.display = 'none';
        step2Box.style.display = 'block';
        setAuthStatus('Password accepted! Enter 6-digit TOTP code.', false);
      } else {
        setAuthStatus(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setAuthStatus('Cannot connect to server at http://127.0.0.1:5000');
    }
  });

  // 3. STEP 2 TOTP LOGIN
  login2Btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const code = totpCode.value.trim();
    const email = authEmail.value.trim();

    if (!code || code.length !== 6) return setAuthStatus('Enter 6-digit code.');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tempToken: tempAuthToken, totpCode: code })
      });
      const data = await res.json();

      if (res.ok) {
        setAuthStatus('Authentication complete! You can now convert files below.', false);
      } else {
        setAuthStatus(data.error || 'Invalid TOTP code.');
      }
    } catch (err) {
      setAuthStatus('Cannot connect to server at http://127.0.0.1:5000');
    }
  });

  // DRAG AND DROP FIXES
  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      selectedFile = files[0];
      fileLabel.innerText = `Selected File: ${selectedFile.name}`;
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      fileLabel.innerText = `Selected File: ${selectedFile.name}`;
    }
  });

  uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!selectedFile) {
      statusMsg.innerText = 'Please select or drag a file first.';
      statusMsg.style.color = '#f87171';
      return;
    }
    statusMsg.innerText = `File "${selectedFile.name}" ready for conversion!`;
    statusMsg.style.color = '#4ade80';
  });
});