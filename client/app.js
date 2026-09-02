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

  const authCard = document.getElementById('authCard');
  const dashboardCard = document.getElementById('dashboardCard');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileLabel = document.getElementById('fileLabel');
  const uploadBtn = document.getElementById('uploadBtn');
  const statusMsg = document.getElementById('status');

  let tempAuthToken = '';
  let selectedFile = null;

  function showStatus(msg, success = false) {
    authStatus.innerText = msg;
    authStatus.style.color = success ? '#4ade80' : '#f87171';
  }

  // 1. REGISTER
  regBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) return showStatus('Enter both email and password.');

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
        showStatus('Registered! Copy key, then click Step 1: Password Login.', true);
      } else {
        showStatus(data.error || 'Registration failed.');
      }
    } catch (err) {
      showStatus('Cannot reach server at http://127.0.0.1:5000');
    }
  });

  // 2. STEP 1: PASSWORD LOGIN
  login1Btn.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevents page reload
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) return showStatus('Enter both email and password.');

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
        showStatus('Password accepted! Enter 6-digit TOTP code.', true);
      } else {
        showStatus(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      showStatus('Cannot reach server at http://127.0.0.1:5000');
    }
  });

  // 3. STEP 2: TOTP LOGIN
  login2Btn.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevents page reload
    const code = totpCode.value.trim();
    const email = authEmail.value.trim();

    if (!code || code.length !== 6) return showStatus('Enter a 6-digit TOTP code.');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tempToken: tempAuthToken, totpCode: code })
      });
      const data = await res.json();

      if (res.ok) {
        authCard.style.display = 'none';
        dashboardCard.style.display = 'block';
      } else {
        showStatus(data.error || 'Invalid 2FA Code.');
      }
    } catch (err) {
      showStatus('Cannot reach server at http://127.0.0.1:5000');
    }
  });

  // Drag and Drop Logic
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      selectedFile = e.dataTransfer.files[0];
      fileLabel.innerText = `Selected: ${selectedFile.name}`;
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      selectedFile = e.target.files[0];
      fileLabel.innerText = `Selected: ${selectedFile.name}`;
    }
  });

  uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!selectedFile) {
      statusMsg.innerText = 'Select a file first.';
      statusMsg.style.color = '#f87171';
      return;
    }
    statusMsg.innerText = `File "${selectedFile.name}" selected for conversion.`;
    statusMsg.style.color = '#4ade80';
  });
});