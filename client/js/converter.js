import { API_BASE, getAccessToken, clearAuth, initCommon } from './common.js';

document.addEventListener('DOMContentLoaded', () => {
  initCommon();

  const gateCard = document.getElementById('gateCard');
  const dashboardCard = document.getElementById('dashboardCard');
  const trustBar = document.getElementById('trustBar');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileLabel = document.getElementById('fileLabel');
  const fileMeta = document.getElementById('fileMeta');
  const metaName = document.getElementById('metaName');
  const metaDetails = document.getElementById('metaDetails');
  const clearFileBtn = document.getElementById('clearFileBtn');
  const previewPanel = document.getElementById('previewPanel');
  const previewContent = document.getElementById('previewContent');
  const previewNote = document.getElementById('previewNote');
  const togglePreviewBtn = document.getElementById('togglePreviewBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const statusMsg = document.getElementById('status');
  const historyList = document.getElementById('historyList');
  const historyStatus = document.getElementById('historyStatus');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const formatSelect = document.getElementById('formatSelect');
  const formatExplain = document.getElementById('formatExplain');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const resultPanel = document.getElementById('resultPanel');
  const resultInfo = document.getElementById('resultInfo');
  const downloadLink = document.getElementById('downloadLink');
  const previewResultBtn = document.getElementById('previewResultBtn');
  const resultPreview = document.getElementById('resultPreview');

  let accessToken = getAccessToken();
  let selectedFile = null;
  let lastPreviewUrl = null;
  let lastResultBlob = null;
  let lastResultExt = null;

  const EXPLANATIONS = {
    html: '<strong>→ HTML</strong> — Clean, sanitized HTML from your Markdown/text/JSON/CSV. Headings (<code>#</code>), lists (<code>-</code>), inline <code>**bold**</code>/<code>*italic*</code> and <code>code</code> are converted. Great for publishing or emailing.',
    pdf: '<strong>→ PDF</strong> — Renders your text/Markdown to a print-ready PDF (PDFKit, A4, margins 50). Ideal for reports and archiving. Entirely in RAM.',
    txt: '<strong>→ TXT</strong> — Normalized plain text (LF line endings). Useful to strip markdown or normalize JSON/CSV to readable text.',
    csv: '<strong>→ CSV</strong> — From a JSON array of objects. Keys become headers (union of all keys), values are quoted. Up to 10k rows, 100 cols. Verified via <code>JSON.parse</code>.',
    json: '<strong>→ JSON</strong> — From CSV (header row required). Auto-detects <code>,</code> or <code>;</code>, handles quoted fields, coerces numbers/booleans. Returns pretty-printed array.',
    webp: '<strong>→ WebP</strong> — Modern image format (~30% smaller than PNG/JPG). Uses Sharp with <code>quality:85</code>, 25M pixel limit. Keep transparency.',
    png: '<strong>→ PNG</strong> — Lossless, with transparency. From JPG/WebP/PNG via Sharp. Use when you need pixel-perfect quality.',
    jpg: '<strong>→ JPG</strong> — Lossy but small, no transparency. From PNG/WebP/JPG via Sharp <code>quality:85</code>. Best for photos.',
  };

  const COMPAT = {
    txt: ['html', 'pdf', 'txt'],
    md: ['html', 'pdf', 'txt'],
    markdown: ['html', 'pdf', 'txt'],
    json: ['csv', 'html', 'pdf', 'txt'],
    csv: ['json', 'html', 'txt'],
    png: ['webp', 'png', 'jpg'],
    jpg: ['webp', 'png', 'jpg'],
    jpeg: ['webp', 'png', 'jpg'],
    webp: ['png', 'jpg', 'webp'],
    gif: ['png', 'webp'],
    pdf: []
  };

  function inferType(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['md', 'markdown', 'txt'].includes(ext)) return 'txt';
    if (ext === 'json') return 'json';
    if (ext === 'csv') return 'csv';
    if (ext === 'png') return 'png';
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    if (ext === 'webp') return 'webp';
    if (ext === 'gif') return 'gif';
    if (ext === 'pdf') return 'pdf';
    // fallback via mime
    if (file.type.startsWith('image/')) {
      if (file.type.includes('png')) return 'png';
      if (file.type.includes('jpeg') || file.type.includes('jpg')) return 'jpg';
      if (file.type.includes('webp')) return 'webp';
    }
    if (file.type.includes('json')) return 'json';
    if (file.type.includes('csv')) return 'csv';
    return 'txt';
  }

  function updateExplain() {
    const v = formatSelect.value;
    formatExplain.innerHTML = EXPLANATIONS[v] || '';
  }

  function filterFormats() {
    if (!selectedFile) {
      // show all, but keep as is
      [...formatSelect.options].forEach(o => { o.disabled = false; o.hidden = false; });
      updateExplain();
      return;
    }
    const type = inferType(selectedFile);
    const allowed = new Set(COMPAT[type] || []);
    // Special: allow jpg as jpeg alias
    let hasVisible = false;
    [...formatSelect.options].forEach(o => {
      const val = o.value;
      const ok = allowed.has(val) || (val === 'jpg' && allowed.has('jpeg')) || (val === 'jpeg' && allowed.has('jpg'));
      // For broader compatibility, if type is txt/json/csv mix, we allow document group broadly
      // For json, csv already precise; for txt we already precise
      o.disabled = !ok;
      o.hidden = !ok;
      if (ok && !hasVisible) hasVisible = true;
    });
    // If current selection hidden/disabled, pick first allowed
    const current = formatSelect.value;
    if (!allowed.has(current) && !(current === 'jpg' && allowed.has('jpeg'))) {
      const first = [...formatSelect.options].find(o => !o.disabled);
      if (first) formatSelect.value = first.value;
    }
    updateExplain();
  }

  function updateGate() {
    accessToken = getAccessToken();
    const loggedIn = Boolean(accessToken);
    if (loggedIn) {
      if (gateCard) gateCard.style.display = 'none';
      if (dashboardCard) dashboardCard.style.display = 'block';
      if (trustBar) trustBar.style.display = 'flex';
    } else {
      if (gateCard) gateCard.style.display = 'block';
      if (dashboardCard) dashboardCard.style.display = 'none';
      if (trustBar) trustBar.style.display = 'none';
    }
    initCommon();
  }
  updateGate();

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      updateGate();
      statusMsg.innerText = '';
      progressWrap.style.display = 'none';
      resultPanel.style.display = 'none';
      historyList.replaceChildren();
      if (historyStatus) historyStatus.innerText = 'Sign in to view your history.';
    });
  }

  function resetFile() {
    selectedFile = null;
    fileInput.value = '';
    fileMeta.style.display = 'none';
    previewPanel.style.display = 'none';
    previewContent.replaceChildren();
    resultPanel.style.display = 'none';
    if (lastPreviewUrl) { URL.revokeObjectURL(lastPreviewUrl); lastPreviewUrl = null; }
    fileLabel.innerText = 'or click to browse — supports .md, .txt, .json, .csv, .png, .jpg, .webp';
    dropZone.style.opacity = '1';
    filterFormats();
    statusMsg.innerText = '';
    progressWrap.style.display = 'none';
    progressBar.style.width = '0%';
  }

  async function renderPreview(file) {
    previewPanel.style.display = 'block';
    previewContent.replaceChildren();
    previewNote.innerText = '';
    if (lastPreviewUrl) { URL.revokeObjectURL(lastPreviewUrl); lastPreviewUrl = null; }

    const type = inferType(file);
    const sizeKB = (file.size / 1024).toFixed(1);

    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(type)) {
      const url = URL.createObjectURL(file);
      lastPreviewUrl = url;
      const img = document.createElement('img');
      img.src = url;
      img.alt = file.name;
      img.onload = () => {
        previewNote.innerText = `${img.naturalWidth} × ${img.naturalHeight} px • ${sizeKB} KB • ${type.toUpperCase()} — magic-byte checked on server`;
      };
      img.onerror = () => { previewNote.innerText = `${sizeKB} KB • image preview failed`; };
      previewContent.appendChild(img);
      previewNote.innerText = `Loading… • ${sizeKB} KB`;
      return;
    }

    // Text-like preview — read first 20KB
    try {
      const slice = file.slice(0, 20000);
      const text = await slice.text();
      const truncated = file.size > 20000;
      if (type === 'json') {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headers = [...new Set(data.slice(0, 5).flatMap(r => r && typeof r === 'object' ? Object.keys(r) : []))].slice(0, 6);
            if (headers.length) {
              const tr = document.createElement('tr');
              headers.forEach(h => { const th = document.createElement('th'); th.innerText = h; tr.appendChild(th); });
              thead.appendChild(tr);
              table.appendChild(thead);
              const tbody = document.createElement('tbody');
              data.slice(0, 5).forEach(row => {
                const tr2 = document.createElement('tr');
                headers.forEach(h => { const td = document.createElement('td'); td.innerText = String(row[h] ?? ''); tr2.appendChild(td); });
                tbody.appendChild(tr2);
              });
              table.appendChild(tbody);
              previewContent.appendChild(table);
              const pre = document.createElement('pre');
              pre.innerText = JSON.stringify(data.slice(0, 2), null, 2) + (data.length > 2 ? '\n… ' + (data.length - 2) + ' more rows' : '');
              previewContent.appendChild(pre);
              previewNote.innerText = `${data.length} rows • ${headers.length} cols • ${sizeKB} KB${truncated ? ' (first 20KB shown)' : ''}`;
              return;
            }
          }
          const pre = document.createElement('pre');
          pre.innerText = JSON.stringify(data, null, 2).slice(0, 3000) + (truncated ? '\n… truncated' : '');
          previewContent.appendChild(pre);
        } catch {
          const pre = document.createElement('pre');
          pre.innerText = text.slice(0, 3000) + (truncated ? '\n… truncated' : '');
          previewContent.appendChild(pre);
        }
        previewNote.innerText = `${type.toUpperCase()} • ${sizeKB} KB${truncated ? ' (first 20KB)' : ''} • parsed client-side`;
        return;
      }
      if (type === 'csv') {
        const lines = text.split(/\r?\n/).slice(0, 6);
        const headers = lines[0] ? lines[0].split(/[,;]/).map(s => s.trim().replace(/^"|"$/g, '')) : [];
        const table = document.createElement('table');
        if (headers.length) {
          const thead = document.createElement('thead');
          const tr = document.createElement('tr');
          headers.forEach(h => { const th = document.createElement('th'); th.innerText = h; tr.appendChild(th); });
          thead.appendChild(tr);
          table.appendChild(thead);
        }
        const tbody = document.createElement('tbody');
        lines.slice(1, 6).forEach(l => {
          if (!l.trim()) return;
          const tr = document.createElement('tr');
          l.split(/[,;]/).forEach(v => { const td = document.createElement('td'); td.innerText = v.replace(/^"|"$/g, '').trim(); tr.appendChild(td); });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        previewContent.appendChild(table);
        previewNote.innerText = `${lines.length - 1} rows preview • ${headers.length} cols • ${sizeKB} KB${truncated ? ' (first 20KB)' : ''}`;
        return;
      }
      // txt/md
      const pre = document.createElement('pre');
      pre.innerText = text.slice(0, 4000) + (truncated ? '\n… truncated (first 20KB shown)' : '');
      previewContent.appendChild(pre);
      const lines = text.split('\n').length;
      previewNote.innerText = `${lines} lines • ${sizeKB} KB • ${type.toUpperCase()} — will be sanitized & converted server-side`;
    } catch {
      previewContent.innerText = 'Preview unavailable for this file.';
    }
  }

  function handleFile(file) {
    selectedFile = file;
    metaName.innerText = file.name;
    metaDetails.innerText = `${inferType(file).toUpperCase()} • ${(file.size / 1024).toFixed(1)} KB • ${file.type || 'unknown mime'}`;
    fileMeta.style.display = 'block';
    fileLabel.innerText = `Ready: ${file.name}`;
    resultPanel.style.display = 'none';
    resultPreview.style.display = 'none';
    statusMsg.innerText = '';
    filterFormats();
    renderPreview(file);
  }

  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener('click', () => {
      const hidden = previewContent.style.display === 'none';
      previewContent.style.display = hidden ? 'block' : 'none';
      previewNote.style.display = hidden ? 'block' : 'none';
      togglePreviewBtn.innerText = hidden ? 'Hide' : 'Show';
    });
  }
  if (clearFileBtn) clearFileBtn.addEventListener('click', resetFile);

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
        setTimeout(() => { location.href = 'login.html'; }, 800);
        return;
      }
      if (!response.ok) throw new Error('History request failed');
      const { jobs } = await response.json();
      historyList.replaceChildren();
      if (!jobs || jobs.length === 0) {
        historyStatus.innerText = 'No conversions yet. Try converting a file above.';
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
    const activate = (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); };
    const deactivate = (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); };
    ['dragenter', 'dragover'].forEach(n => dropZone.addEventListener(n, activate));
    ['dragleave', 'drop'].forEach(n => dropZone.addEventListener(n, deactivate));
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }});
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFile(files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
  }

  if (formatSelect) {
    formatSelect.addEventListener('change', updateExplain);
    updateExplain();
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
      statusMsg.innerText = '';
      progressWrap.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.innerText = 'Preparing upload…';
      resultPanel.style.display = 'none';
      resultPreview.style.display = 'none';
      uploadBtn.disabled = true;
      const originalLabel = uploadBtn.innerText;
      uploadBtn.innerText = 'Converting…';
      try {
        const res = await uploadForConversion(formData, progress => {
          progressBar.style.width = progress + '%';
          progressText.innerText = `Uploading… ${progress}%`;
          statusMsg.style.color = '#38bdf8';
          statusMsg.innerText = `Uploading… ${progress}%`;
        });
        progressBar.style.width = '100%';
        progressText.innerText = 'Processing…';
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
          progressText.innerText = errorMessage;
          return;
        }
        const blob = res.response;
        lastResultBlob = blob;
        lastResultExt = formatSelect.value;
        const downloadUrl = window.URL.createObjectURL(blob);
        downloadLink.href = downloadUrl;
        const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
        downloadLink.download = `${baseName}_converted.${lastResultExt}`;
        resultInfo.innerText = `${selectedFile.name} (${inferType(selectedFile).toUpperCase()}) → ${lastResultExt.toUpperCase()} • ${(blob.size / 1024).toFixed(1)} KB • ready to download (RAM-only, not stored)`;
        resultPanel.style.display = 'block';
        statusMsg.innerText = 'File converted and downloaded successfully! Preview below or click Download.';
        statusMsg.style.color = '#4ade80';
        progressText.innerText = 'Done ✓';
        // auto-download like before ? keep but also offer button — auto click
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${baseName}_converted.${lastResultExt}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // don't revoke yet — keep for preview
        setTimeout(() => loadHistory(), 300);
      } catch {
        statusMsg.innerText = `Failed to connect to ${API_BASE}. Is the server running?`;
        statusMsg.style.color = '#f87171';
        progressText.innerText = 'Connection failed';
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = originalLabel;
      }
    });
  }

  if (previewResultBtn) {
    previewResultBtn.addEventListener('click', async () => {
      if (!lastResultBlob) return;
      const ext = lastResultExt;
      resultPreview.replaceChildren();
      resultPreview.style.display = 'block';
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        const url = URL.createObjectURL(lastResultBlob);
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Converted preview';
        resultPreview.appendChild(img);
        previewResultBtn.innerText = 'Hide preview';
        // toggle
        if (resultPreview.dataset.shown === '1') {
          resultPreview.style.display = 'none';
          resultPreview.dataset.shown = '0';
          previewResultBtn.innerText = '👁 Preview result';
        } else {
          resultPreview.style.display = 'block';
          resultPreview.dataset.shown = '1';
        }
        return;
      }
      if (['html', 'txt', 'json', 'csv'].includes(ext)) {
        try {
          const text = await lastResultBlob.text();
          if (ext === 'html') {
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '240px';
            iframe.style.border = '1px solid #334155';
            iframe.style.borderRadius = '6px';
            iframe.style.background = 'white';
            iframe.srcdoc = text;
            resultPreview.appendChild(iframe);
            const pre = document.createElement('pre');
            pre.style.marginTop = '0.5rem';
            pre.innerText = text.slice(0, 2000) + (text.length > 2000 ? '\n… truncated' : '');
            resultPreview.appendChild(pre);
          } else if (ext === 'json') {
            const pre = document.createElement('pre');
            try { pre.innerText = JSON.stringify(JSON.parse(text), null, 2).slice(0, 4000); } catch { pre.innerText = text.slice(0, 4000); }
            resultPreview.appendChild(pre);
          } else {
            const pre = document.createElement('pre');
            pre.innerText = text.slice(0, 4000) + (text.length > 4000 ? '\n… truncated' : '');
            resultPreview.appendChild(pre);
          }
          // toggle logic
          if (resultPreview.dataset.shown === '1') {
            resultPreview.style.display = 'none';
            resultPreview.dataset.shown = '0';
            previewResultBtn.innerText = '👁 Preview result';
          } else {
            resultPreview.style.display = 'block';
            resultPreview.dataset.shown = '1';
            previewResultBtn.innerText = 'Hide preview';
          }
          return;
        } catch {
          resultPreview.innerText = 'Preview unavailable.';
        }
      }
      if (ext === 'pdf') {
        const url = URL.createObjectURL(lastResultBlob);
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.width = '100%';
        iframe.style.height = '360px';
        iframe.style.border = '1px solid #334155';
        iframe.style.borderRadius = '6px';
        resultPreview.appendChild(iframe);
        if (resultPreview.dataset.shown === '1') {
          resultPreview.style.display = 'none';
          resultPreview.dataset.shown = '0';
        } else {
          resultPreview.style.display = 'block';
          resultPreview.dataset.shown = '1';
        }
      }
    });
  }

  if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', loadHistory);

  if (getAccessToken()) {
    loadHistory().then(() => { if (!getAccessToken()) updateGate(); });
  } else {
    if (historyStatus) historyStatus.innerText = 'Sign in to view your history.';
  }
  window.addEventListener('storage', updateGate);
  filterFormats();
});
