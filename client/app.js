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
  let accessToken = sessionStorage.getItem('accessToken') || '';
  let selectedFile = null;

  function setAuthStatus(msg, isError = true) {
    authStatus.innerText = msg;
    authStatus.style.color = isError ? '#f87171' : '#4ade80';
  }

  async function getErrorMessage(response, fallback) {
    try {
      const data = await response.json();
      return data.error || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function uploadForConversion(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', 'http://127.0.0.1:5000/api/convert');
      request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      request.responseType = 'blob';
      request.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => resolve(request));
      request.addEventListener('error', reject);
      request.send(formData);
    });
  }

  // 1. REGISTER USER
  regBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) return setAuthStatus('Please enter an email and password.');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        mfaSecretKey.innerText = data.mfaSecret;
        setAuthStatus('Registered! Save key in Google Authenticator, then click Step 1 Login.', false);
      } else {
        setAuthStatus(data.error || 'User already exists.');
      }
    } catch (err) {
      setAuthStatus('Cannot connect to http://127.0.0.1:5000');
    }
  });

  // 2. STEP 1: PASSWORD LOGIN
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
      setAuthStatus('Cannot connect to http://127.0.0.1:5000');
    }
  });

  // 3. STEP 2: TOTP CODE VERIFICATION
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
        accessToken = data.accessToken;
        sessionStorage.setItem('accessToken', accessToken);
        setAuthStatus('Authentication complete! You can now convert files below.', false);
      } else {
        setAuthStatus(data.error || 'Invalid TOTP code.');
      }
    } catch (err) {
      setAuthStatus('Cannot connect to http://127.0.0.1:5000');
    }
  });

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
      fileLabel.innerText = `Selected File: ${selectedFile.name}`;
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      fileLabel.innerText = `Selected File: ${selectedFile.name}`;
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

    statusMsg.innerText = 'Converting file...';
    statusMsg.style.color = '#38bdf8';
    uploadBtn.disabled = true;
    uploadBtn.innerText = 'Converting...';

    try {
      const res = await uploadForConversion(formData, progress => {
        statusMsg.innerText = `Uploading file... ${progress}%`;
      });

      if (!res.ok) {
        let errorMessage = 'Conversion failed.';
        try {
          const errorData = JSON.parse(await res.response.text());
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          errorMessage = 'The server returned an unreadable error.';
        }
        if (res.status === 401) {
          accessToken = '';
          sessionStorage.removeItem('accessToken');
        }
        statusMsg.innerText = errorMessage;
        statusMsg.style.color = '#f87171';
        return;
      }

      const blob = res.response;
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `converted_${Date.now()}.${document.getElementById('formatSelect').value}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      statusMsg.innerText = 'File converted and downloaded successfully!';
      statusMsg.style.color = '#4ade80';
    } catch (err) {
      statusMsg.innerText = 'Failed to connect to converter server.';
      statusMsg.style.color = '#f87171';
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerText = 'Upload & Convert';
    }
  });
});