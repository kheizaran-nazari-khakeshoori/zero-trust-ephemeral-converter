// DOM Element References
const regBtn = document.getElementById('regBtn');
const login1Btn = document.getElementById('login1Btn');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authStatus = document.getElementById('authStatus');
const mfaDisplay = document.getElementById('mfaDisplay');
const mfaSecretKey = document.getElementById('mfaSecretKey');

const step1Box = document.getElementById('step1Box');
const step2Box = document.getElementById('step2Box');
const login2Btn = document.getElementById('login2Btn');
const totpCode = document.getElementById('totpCode');

let tempAuthToken = '';

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
      // Show 2FA Secret Key
      mfaSecretKey.innerText = data.mfaSecret;
      mfaDisplay.style.display = 'block';

      // Hide the Register button so only Login remains
      regBtn.style.display = 'none';

      authStatus.innerText = 'Registration successful! Save your 2FA Key, then click Step 1: Password Login.';
      authStatus.style.color = '#4ade80';
    } else {
      authStatus.innerText = data.error || 'Registration failed.';
      authStatus.style.color = '#f87171';
    }
  } catch (err) {
    console.error('Registration fetch error:', err);
    authStatus.innerText = 'Server connection error.';
    authStatus.style.color = '#f87171';
  }
});

// 2. STEP 1 LOGIN ACTION
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

      // Hide Step 1 Box and MFA display, then show Step 2 Box (TOTP)
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
    console.error('Step 1 login error:', err);
    authStatus.innerText = 'Server connection error.';
    authStatus.style.color = '#f87171';
  }
});

// 3. STEP 2 LOGIN ACTION (TOTP Verification)
login2Btn.addEventListener('click', async () => {
  const code = totpCode.value.trim();

  if (!code || code.length !== 6) {
    authStatus.innerText = 'Please enter a valid 6-digit TOTP code.';
    authStatus.style.color = '#f87171';
    return;
  }

  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login-step2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: tempAuthToken, totpCode: code })
    });

    const data = await res.json();

    if (res.ok) {
      authStatus.innerText = 'Authentication Complete! You are logged in.';
      authStatus.style.color = '#4ade80';

      // Unlock file upload converter card
      document.getElementById('uploadBtn').disabled = false;
    } else {
      authStatus.innerText = data.error || 'Invalid TOTP Code.';
      authStatus.style.color = '#f87171';
    }
  } catch (err) {
    console.error('Step 2 login error:', err);
    authStatus.innerText = 'Server connection error.';
    authStatus.style.color = '#f87171';
  }
});