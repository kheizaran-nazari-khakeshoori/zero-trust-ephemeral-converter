import { API_BASE, initCommon } from './common.js';

document.addEventListener('DOMContentLoaded', () => {
  initCommon();

  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const regBtn = document.getElementById('regBtn');
  const authStatus = document.getElementById('authStatus');
  const mfaDisplay = document.getElementById('mfaDisplay');
  const mfaSecretKey = document.getElementById('mfaSecretKey');
  const mfaQrImage = document.getElementById('mfaQrImage');
  const mfaOtpauthUrl = document.getElementById('mfaOtpauthUrl');
  const qrStatus = document.getElementById('qrStatus');
  const copySecretBtn = document.getElementById('copySecretBtn');

  function setAuthStatus(msg, isError = true) {
    authStatus.innerText = msg;
    authStatus.style.color = isError ? '#f87171' : '#4ade80';
  }

  if (copySecretBtn) {
    copySecretBtn.addEventListener('click', async () => {
      const secret = mfaSecretKey ? mfaSecretKey.innerText : '';
      if (!secret) return;
      try {
        await navigator.clipboard.writeText(secret);
        const prev = copySecretBtn.innerText;
        copySecretBtn.innerText = 'Copied!';
        setTimeout(() => { copySecretBtn.innerText = prev; }, 1500);
      } catch {
        window.prompt('Copy your secret key:', secret);
      }
    });
  }

  async function generateClientQr(otpauthUrl) {
    try {
      if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
        return await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 300, color: { dark: '#000000', light: '#ffffff' } });
      }
    } catch (e) {
      console.warn('client QR generation failed', e);
    }
    return null;
  }

  let lastOtpauthUrl = '';
  if (mfaQrImage) {
    mfaQrImage.addEventListener('error', async () => {
      if (lastOtpauthUrl) {
        const clientUrl = await generateClientQr(lastOtpauthUrl);
        if (clientUrl && mfaQrImage.src !== clientUrl) {
          mfaQrImage.src = clientUrl;
          return;
        }
        const fallback = `${API_BASE}/api/auth/qr?data=${encodeURIComponent(lastOtpauthUrl)}`;
        if (mfaQrImage.src !== fallback) {
          mfaQrImage.src = fallback;
          return;
        }
      }
      if (qrStatus) {
        qrStatus.innerText = 'QR failed to load — use the manual key below.';
        qrStatus.style.display = 'block';
      }
    });
    mfaQrImage.addEventListener('load', () => {
      if (qrStatus) qrStatus.style.display = 'none';
    });
  }

  if (regBtn) {
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
          mfaSecretKey.innerText = data.mfaSecret || '';
          lastOtpauthUrl = data.otpauthUrl || '';
          if (mfaOtpauthUrl) {
            mfaOtpauthUrl.innerText = data.otpauthUrl || '';
            mfaSecretKey.title = data.otpauthUrl || '';
          }
          if (mfaQrImage) {
            mfaQrImage.style.display = 'block';
            if (qrStatus) { qrStatus.style.display = 'none'; qrStatus.innerText = ''; }
            if (data.qrDataUrl) {
              mfaQrImage.src = data.qrDataUrl;
            } else if (data.otpauthUrl) {
              const clientUrl = await generateClientQr(data.otpauthUrl);
              if (clientUrl) mfaQrImage.src = clientUrl;
              else mfaQrImage.src = `${API_BASE}/api/auth/qr?data=${encodeURIComponent(data.otpauthUrl)}`;
            } else {
              mfaQrImage.style.display = 'none';
            }
          }
          setAuthStatus('Registered! Scan the QR with Google Authenticator (or any TOTP app), then log in.', false);
          // Persist email for login convenience
          sessionStorage.setItem('pendingEmail', email);
        } else {
          setAuthStatus(data.error || 'Registration failed.');
        }
      } catch {
        setAuthStatus(`Cannot connect to ${API_BASE}`);
      } finally {
        regBtn.disabled = false;
      }
    });
  }
});
