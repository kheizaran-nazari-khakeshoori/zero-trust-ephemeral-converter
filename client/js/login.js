import { API_BASE, getAccessToken, setAccessToken, clearAuth, initCommon } from './common.js';

document.addEventListener('DOMContentLoaded', () => {
  initCommon();

  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authStatus = document.getElementById('authStatus');
  const step1Box = document.getElementById('step1Box');
  const step2Box = document.getElementById('step2Box');
  const totpCode = document.getElementById('totpCode');
  const login1Btn = document.getElementById('login1Btn');
  const login2Btn = document.getElementById('login2Btn');
  const backToStep1Btn = document.getElementById('backToStep1Btn');
  const alreadyLoggedIn = document.getElementById('alreadyLoggedIn');
  const logoutInlineBtn = document.getElementById('logoutInlineBtn');

  let tempAuthToken = sessionStorage.getItem('tempAuthToken') || '';

  function setAuthStatus(msg, isError = true) {
    authStatus.innerText = msg;
    authStatus.style.color = isError ? '#f87171' : '#4ade80';
  }

  function showAlreadyLoggedIn() {
    if (getAccessToken()) {
      if (alreadyLoggedIn) alreadyLoggedIn.style.display = 'block';
      // Optionally hide forms
      // step1Box.style.display = 'none';
      // step2Box.style.display = 'none';
    } else {
      if (alreadyLoggedIn) alreadyLoggedIn.style.display = 'none';
    }
  }
  showAlreadyLoggedIn();

  if (logoutInlineBtn) {
    logoutInlineBtn.addEventListener('click', () => {
      clearAuth();
      tempAuthToken = '';
      sessionStorage.removeItem('tempAuthToken');
      step1Box.style.display = 'block';
      step2Box.style.display = 'none';
      initCommon();
      showAlreadyLoggedIn();
      setAuthStatus('Signed out.', false);
    });
  }

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', () => {
      step2Box.style.display = 'none';
      step1Box.style.display = 'block';
      setAuthStatus('', false);
    });
  }

  // Step 1: Password login
  if (login1Btn) {
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
          sessionStorage.setItem('tempAuthToken', tempAuthToken);
          // keep email for step2
          sessionStorage.setItem('pendingEmail', email);
          step1Box.style.display = 'none';
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
  }

  // Step 2: TOTP
  if (login2Btn) {
    login2Btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const code = totpCode.value.trim();
      const email = (authEmail.value.trim() || sessionStorage.getItem('pendingEmail') || '').trim();
      if (!code || code.length !== 6) return setAuthStatus('Enter a 6-digit code.');
      if (!/^\d{6}$/.test(code)) return setAuthStatus('Code must be 6 digits.');
      if (!email) return setAuthStatus('Missing email — go back and enter email again.');
      // ensure temp token present
      if (!tempAuthToken) tempAuthToken = sessionStorage.getItem('tempAuthToken') || '';
      if (!tempAuthToken) return setAuthStatus('Session expired. Please start from Step 1.');

      login2Btn.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/auth/login-step2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, tempToken: tempAuthToken, totpCode: code })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setAccessToken(data.accessToken);
          sessionStorage.removeItem('tempAuthToken');
          setAuthStatus('Authentication complete! Redirecting to converter…', false);
          initCommon();
          showAlreadyLoggedIn();
          setTimeout(() => { location.href = 'converter.html'; }, 700);
        } else {
          setAuthStatus(data.error || 'Invalid TOTP code.');
        }
      } catch {
        setAuthStatus(`Cannot connect to ${API_BASE}`);
      } finally {
        login2Btn.disabled = false;
      }
    });
  }

  // Auto-redirect if already fully authenticated and user just wants converter?
  // keep them here but show banner
});
