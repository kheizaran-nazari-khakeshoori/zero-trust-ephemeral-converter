// DOM Element References
const regBtn = document.getElementById('regBtn');
const login1Btn = document.getElementById('login1Btn');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authStatus = document.getElementById('authStatus');
const mfaDisplay = document.getElementById('mfaDisplay');
const mfaSecretKey = document.getElementById('mfaSecretKey');

const authCard = document.getElementById('authCard');
const dashboardCard = document.getElementById('dashboardCard');

const step1Box = document.getElementById('step1Box');
const step2Box = document.getElementById('step2Box');
const login2Btn = document.getElementById('login2Btn');
const totpCode = document.getElementById('totpCode');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const uploadBtn = document.getElementById('uploadBtn');
const statusMsg = document.getElementById('status');

let tempAuthToken = '';
let selectedFile = null;

// 1. REGISTER ACTION
regBtn.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    authStatus.innerText = 'Please enter both email and password to register.';
    authStatus.style.color = '#f87171';
    return;
  }

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
      regBtn.style.display = 'none';

      authStatus.innerText = 'Registration successful! Save your 2FA Key, then click Step 1: Password Login.';
      authStatus.style.color = '#4ade80';
    } else {
      authStatus.innerText = data.error || 'Registration failed.';
      authStatus.style.color = '#f87171';
    }
  } catch (err) {
    console.error('Registration error:', err);
    authStatus.innerText = 'Server connection error.';
    authStatus.style.color = '#f87171';
  }
});

// 2. STEP 1 LOGIN
login1Btn.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    authStatus.innerText = 'Please enter your email and password.';
    authStatus.style.color = '#f87171';
    return;
  }

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

      authStatus.innerText = 'Password verified! Enter your 6-digit TOTP code.';
      authStatus.style.color = '#4ade80';
    } else {
      authStatus.innerText = data.error || 'Login failed.';
      authStatus.style.color = '#f87171';
    }
  } catch (err) {
    console.error('Step 1 error:', err);
    authStatus.innerText = 'Server connection error.';
    authStatus.style.color = '#f87171';
  }
});

// 3. STEP 2 LOGIN & REDIRECT TO DASHBOARD
login2Btn.addEventListener('click', async () => {
  const code = totpCode.value.trim();
  const email = authEmail.value.trim();

  if (!code || code.length !== 6) {
    authStatus.innerText = 'Please enter a valid 6-digit TOTP code.';
    authStatus.style.color = '#f87171';
    return;
  }

  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login-step2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tempToken: tempAuthToken, totpCode: code })
    });

    const data = await res.json();

    if (res.ok) {
      // Hide Auth Card and display Converter Dashboard
      authCard.style.display = 'none';
      dashboardCard.style.display = 'block';
    } else {
      authStatus.innerText = data.error || 'Invalid TOTP Code.';
      authStatus.style.color = '#f87171';
    }
  } catch (err) {
    console.error('Step 2 error:', err);
    authStatus.innerText = 'Server connection error.';
    authStatus.style.color = '#f87171';
  }
});

// 4. DRAG AND DROP FILE HANDLERS
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');

  if (e.dataTransfer.files.length > 0) {
    selectedFile = e.dataTransfer.files[0];
    fileLabel.innerText = `Selected File: ${selectedFile.name}`;
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    fileLabel.innerText = `Selected File: ${selectedFile.name}`;
  }
});

uploadBtn.addEventListener('click', () => {
  if (!selectedFile) {
    statusMsg.innerText = 'Please select or drop a file first.';
    statusMsg.style.color = '#f87171';
    return;
  }
  statusMsg.innerText = `File "${selectedFile.name}" ready for conversion.`;
  statusMsg.style.color = '#4ade80';
});