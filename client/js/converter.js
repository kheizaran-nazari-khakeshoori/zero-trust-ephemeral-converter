import { API_BASE, getAccessToken, clearAuth, initCommon } from './common.js';

document.addEventListener('DOMContentLoaded', () => {
  initCommon();

  const gateCard = document.getElementById('gateCard');
  const dashboardCard = document.getElementById('dashboardCard');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileLabel = document.getElementById('fileLabel');
  const uploadBtn = document.getElementById('uploadBtn');
  const statusMsg = document.getElementById('status');
  const historyList = document.getElementById('historyList');
  const historyStatus = document.getElementById('historyStatus');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const formatSelect = document.getElementById('formatSelect');

  let accessToken = getAccessToken();
  let selectedFile = null;

  function updateGate() {
    accessToken = getAccessToken();
    const loggedIn = Boolean(accessToken);
    if (loggedIn) {
      if (gateCard) gateCard.style.display = 'none';
      if (dashboardCard) dashboardCard.style.display = 'block';
    } else {
      if (gateCard) gateCard.style.display = 'block';
      if (dashboardCard) dashboardCard.style.display = 'none';
    }
    initCommon();
  }
  updateGate();

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      updateGate();
      statusMsg.innerText = '';
      statusMsg.style.color = '#38bdf8';
      historyList.replaceChildren();
      if (historyStatus) historyStatus.innerText = 'Sign in to view your history.';
    });
  }

  function uploadForConversion(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE}/api/convert`);
      request.setRequestHeader('Authorization', `Bearer ${getAccessToken()}`);
      request.responseType = 'blob';
      request.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => resolve(request));
      request.addEventListener('error', () => reject(new Error('Network error')));
      request.addEventListener('abort', () => reject(new Error('Upload aborted')));
      request.send(formData);
    });
  }

  async function loadHistory() {
    const token = getAccessToken();
    if (!token) {
      historyStatus.innerText = 'Sign in to view your history.';
      return;
    }
    historyStatus.innerText = 'Loading history...';
    try {
      const response = await fetch(`${API_BASE}/api/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        clearAuth();
        updateGate();
        historyStatus.innerText = 'Session expired. Please log in again.';
        // optional redirect
        setTimeout(() => { location.href = 'login.html'; }, 800);
        return;
      }
      if (!response.ok) throw new Error('History request failed');
      const { jobs } = await response.json();
      historyList.replaceChildren();
      if (!jobs || jobs.length === 0) {
        historyStatus.innerText = 'No conversions yet.';
        return;
      }
      historyStatus.innerText = '';
      for (const job of jobs) {
        const item = document.createElement('li');
        item.className = 'history-item';
        const file = document.createElement('span');
        file.className = 'history-file';
        file.innerText = job.originalFilename;
        const meta = document.createElement('span');
        meta.className = 'history-meta';
        meta.innerText = `${job.sourceType} → ${job.targetType} · ${new Date(job.createdAt).toLocaleString()}`;
        item.append(file, meta);
        historyList.append(item);
      }
    } catch {
      historyStatus.innerText = 'Could not load conversion history.';
    }
  }

  // Drag & drop
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault(); e.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault(); e.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        selectedFile = files[0];
        fileLabel.innerText = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
        statusMsg.innerText = '';
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        fileLabel.innerText = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
        statusMsg.innerText = '';
      }
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!selectedFile) {
        statusMsg.innerText = 'Please select or drag a file first.';
        statusMsg.style.color = '#f87171';
        return;
      }
      if (!getAccessToken()) {
        statusMsg.innerText = 'Please complete authentication first.';
        statusMsg.style.color = '#f87171';
        updateGate();
        return;
      }
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('targetFormat', formatSelect.value);
      statusMsg.innerText = 'Preparing upload...';
      statusMsg.style.color = '#38bdf8';
      uploadBtn.disabled = true;
      const originalLabel = uploadBtn.innerText;
      uploadBtn.innerText = 'Converting...';
      try {
        const res = await uploadForConversion(formData, progress => {
          statusMsg.innerText = `Uploading… ${progress}%`;
        });
        if (res.status !== 200) {
          let errorMessage = 'Conversion failed.';
          try {
            const text = await res.response.text();
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `Conversion failed (${res.status}).`;
          }
          if (res.status === 401) {
            clearAuth();
            updateGate();
          }
          statusMsg.innerText = errorMessage;
          statusMsg.style.color = '#f87171';
          return;
        }
        const blob = res.response;
        const ext = formatSelect.value;
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `converted_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        statusMsg.innerText = 'File converted and downloaded successfully!';
        statusMsg.style.color = '#4ade80';
        loadHistory();
      } catch {
        statusMsg.innerText = `Failed to connect to ${API_BASE}. Is the server running?`;
        statusMsg.style.color = '#f87171';
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = originalLabel;
      }
    });
  }

  if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', loadHistory);

  // Initial load
  if (getAccessToken()) {
    loadHistory().then(() => {
      if (!getAccessToken()) updateGate();
    });
  } else {
    if (historyStatus) historyStatus.innerText = 'Sign in to view your history.';
  }

  // Keep nav in sync on storage events (e.g., login in other tab)
  window.addEventListener('storage', updateGate);
});
