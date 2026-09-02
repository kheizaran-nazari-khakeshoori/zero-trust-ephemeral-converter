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

  // REGISTER: Obtains Secret Key for Google Authenticator
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
        // Force display of the MFA key box
        mfaSecretKey.innerText = data.mfaSecret || data.secret || 'KEY-GENERATED-CHECK-CONSOLE';
        mfaDisplay.style.display = 'block';
        setAuthStatus('Registered! Save this Secret Key in Google Authenticator, then click Step 1 Login.', false);
      } else {
        setAuthStatus(data.error || 'User already exists.');
      }
    } catch (err) {
      console.error(err);
      setAuthStatus('Cannot reach backend server. Ensure node server is running on port 5000.');
    }
  });

  // STEP 1: PASSWORD LOGIN (DEBUG VERSION)
login1Btn.addEventListener('click', async (e) => {
  e.preventDefault();
  
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    setAuthStatus('Please enter both email and password.');
    return;
  }

  setAuthStatus('Connecting to server...', false);

  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      tempAuthToken = data.tempToken;
      
      // Force UI transition to Step 2
      step1Box.style.display = 'none';
      mfaDisplay.style.display = 'none';
      step2Box.style.display = 'block';
      
      setAuthStatus('Password accepted! Enter 6-digit TOTP code.', false);
    } else {
      // Display the exact error returned by your backend server
      setAuthStatus(`Server Error (${res.status}): ${data.error || 'Login failed'}`);
    }
  } catch (err) {
    console.error('Fetch error:', err);
    setAuthStatus('Network Error: Cannot connect to http://127.0.0.1:5000. Is your backend node server running?');
  }
});

  // STEP 2: TOTP VERIFICATION
  login2Btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const code = totpCode.value.trim();
    const email = authEmail.value.trim();

    if (!code || code.length !== 6) return setAuthStatus('Enter the 6-digit code from Authenticator.');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tempToken: tempAuthToken, totpCode: code })
      });
      const data = await res.json();

      if (res.ok) {
        setAuthStatus('Successfully logged in! You can now use the converter.', false);
      } else {
        setAuthStatus(data.error || 'Invalid 6-digit code.');
      }
    } catch (err) {
      console.error(err);
      setAuthStatus('Server error during Step 2 verification.');
    }
  });

  // FILE DRAG & DROP LOGIC
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

  uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!selectedFile) {
      statusMsg.innerText = 'Please drag or select a file first.';
      statusMsg.style.color = '#f87171';
      return;
    }
    statusMsg.innerText = `File "${selectedFile.name}" selected.`;
    statusMsg.style.color = '#4ade80';
  });
});