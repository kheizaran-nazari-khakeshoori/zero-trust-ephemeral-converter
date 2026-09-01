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

// Helper function to reset status messages
function setStatus(message, isSuccess = false) {
  authStatus.innerText = message;
  authStatus.style.color = isSuccess ? '#4ade80' : '#f87171';
}

// 1. REGISTER ACTION
regBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    setStatus('Please fill in both email and password.');
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
      setStatus('Registered! Save your key, then click Step 1: Password Login.', true);
    } else {
      setStatus(data.error || 'Registration failed.');
    }
  } catch (err) {
    console.error('Registration error:', err);
    setStatus('Cannot connect to backend server.');
  }
});

// 2. STEP 1 LOGIN (Password Check)
login1Btn.addEventListener('click', async (e) => {
  e.preventDefault();

  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    setStatus('Please enter your email and password.');
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
      setStatus('Password accepted! Enter your 6-digit TOTP code.', true);
    } else {
      setStatus(data.error || 'Login failed.');
    }
  } catch (err) {
    console.error('Step 1 error:', err);
    setStatus('Cannot connect to backend server.');
  }
});

// 3. STEP 2 LOGIN (TOTP Check)
login2Btn.addEventListener('click', async (e) => {
  e.preventDefault();

  const code = totpCode.value.trim();
  const email = authEmail.value.trim();

  if (!code || code.length !== 6) {
    setStatus('Please enter a 6-digit TOTP code.');
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
      authCard.style.display = 'none';
      dashboardCard.style.display = 'block';
    } else {
      setStatus(data.error || 'Invalid 2FA code.');
    }
  } catch (err) {
    console.error('Step 2 error:', err);
    setStatus('Cannot connect to backend server.');
  }
});

// 4. FILE UPLOAD & DRAG/DROP
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
    fileLabel.innerText = `Selected: ${selectedFile.name}`;
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    fileLabel.innerText = `Selected: ${selectedFile.name}`;
  }
});

uploadBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!selectedFile) {
    statusMsg.innerText = 'Please select a file first.';
    statusMsg.style.color = '#f87171';
    return;
  }
  statusMsg.innerText = `File "${selectedFile.name}" ready to convert.`;
  statusMsg.style.color = '#4ade80';
});