// --- Elements: Authentication ---
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authStatus = document.getElementById('authStatus');

let activeEmail = '';

// 1. User Registration
document.getElementById('regBtn')?.addEventListener('click', async () => {
  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value, password: authPassword.value })
    });
    const data = await res.json();
    authStatus.style.color = res.ok ? '#4ade80' : '#f87171';
    authStatus.innerText = data.message || data.error;
    if (data.step2Setup) {
      alert(`Save your TOTP Secret Key into Google Authenticator or Authy:\n\n${data.step2Setup.totpSecret}`);
    }
  } catch (err) {
    authStatus.style.color = '#f87171';
    authStatus.innerText = 'Server connection error.';
  }
});

// 2. Step 1 Login: Password
document.getElementById('login1Btn')?.addEventListener('click', async () => {
  activeEmail = authEmail.value;
  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: activeEmail, password: authPassword.value })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('step1Box').style.display = 'none';
      document.getElementById('step2Box').style.display = 'block';
      authStatus.style.color = '#4ade80';
      authStatus.innerText = data.message;
    } else {
      authStatus.style.color = '#f87171';
      authStatus.innerText = data.error;
    }
  } catch (err) {
    authStatus.style.color = '#f87171';
    authStatus.innerText = 'Server connection error.';
  }
});

// 3. Step 2 Login: TOTP Verification
document.getElementById('login2Btn')?.addEventListener('click', async () => {
  const code = document.getElementById('totpCode').value;
  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: activeEmail, totpCode: code })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('step2Box').style.display = 'none';
      document.getElementById('step3Box').style.display = 'block';
      document.getElementById('secToken').value = data.securityToken;
      authStatus.style.color = '#4ade80';
      authStatus.innerText = data.message;
    } else {
      authStatus.style.color = '#f87171';
      authStatus.innerText = data.error;
    }
  } catch (err) {
    authStatus.style.color = '#f87171';
    authStatus.innerText = 'Server connection error.';
  }
});

// 4. Step 3 Login: Security Key Verification
document.getElementById('login3Btn')?.addEventListener('click', async () => {
  const token = document.getElementById('secToken').value;
  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: activeEmail, securityToken: token })
    });
    const data = await res.json();
    authStatus.style.color = res.ok ? '#4ade80' : '#f87171';
    authStatus.innerText = data.message || data.error;
  } catch (err) {
    authStatus.style.color = '#f87171';
    authStatus.innerText = 'Server connection error.';
  }
});


// --- Elements: File Converter ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const uploadBtn = document.getElementById('uploadBtn');
const statusDiv = document.getElementById('status');
const formatSelect = document.getElementById('formatSelect');

let selectedFile = null;

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    fileLabel.innerText = `Selected: ${selectedFile.name}`;
    uploadBtn.disabled = false;
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.background = 'rgba(59, 130, 246, 0.2)';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.background = 'transparent';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.background = 'transparent';
  if (e.dataTransfer.files.length > 0) {
    selectedFile = e.dataTransfer.files[0];
    fileLabel.innerText = `Selected: ${selectedFile.name}`;
    uploadBtn.disabled = false;
  }
});

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  statusDiv.style.color = '#93c5fd';
  statusDiv.innerText = 'Converting in memory...';

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('targetFormat', formatSelect.value);

  try {
    const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'converted-file';
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      statusDiv.style.color = '#4ade80';
      statusDiv.innerText = 'File converted and downloaded successfully!';
    } else {
      const result = await response.json();
      statusDiv.style.color = '#f87171';
      statusDiv.innerText = `Error: ${result.error}`;
    }
  } catch (err) {
    statusDiv.style.color = '#f87171';
    statusDiv.innerText = 'Server connection failed.';
  }
});