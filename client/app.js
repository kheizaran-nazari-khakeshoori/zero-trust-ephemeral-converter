const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const uploadBtn = document.getElementById('uploadBtn');
const statusDiv = document.getElementById('status');

let selectedFile = null;

// Open file selector on click
dropZone.addEventListener('click', () => fileInput.click());

// Handle file select
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    fileLabel.innerText = `Selected: ${selectedFile.name}`;
    uploadBtn.disabled = false;
  }
});

// Drag and drop handlers
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

// Submit file to API server
uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  statusDiv.style.color = '#93c5fd';
  statusDiv.innerText = 'Uploading to memory...';

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const response = await fetch('http://localhost:5000/api/convert', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      statusDiv.style.color = '#4ade80';
      statusDiv.innerText = `Success: ${result.message}`;
    } else {
      statusDiv.style.color = '#f87171';
      statusDiv.innerText = `Error: ${result.error}`;
    }
  } catch (err) {
    statusDiv.style.color = '#f87171';
    statusDiv.innerText = 'Server connection failed.';
  }
});