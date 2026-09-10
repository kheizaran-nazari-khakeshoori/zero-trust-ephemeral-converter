// Dictionary of common file magic bytes (binary signatures)
const FILE_SIGNATURES = {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // JPEG: FF D8 FF (recognized but not allowed for conversion — helps give better errors)
  jpg: [0xff, 0xd8, 0xff],
  // PDF: 25 50 44 46 (%PDF)
  pdf: [0x25, 0x50, 0x44, 0x46]
};

export function validateMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  for (const [type, signature] of Object.entries(FILE_SIGNATURES)) {
    if (buffer.length < signature.length) continue;
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return type;
  }

  // Quick binary check before decoding to text — reject obvious binary
  // Check first 512 bytes for null bytes without full decode
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  if (sample.includes(0x00)) return null;

  let text;
  try {
    text = buffer.toString('utf8');
  } catch {
    return null;
  }
  if (text.includes('\uFFFD')) return null;

  const trimmedText = text.replace(/^\uFEFF/, '').trim();
  if (!trimmedText) return null;

  if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedText);
      return parsed !== null && typeof parsed === 'object' ? 'json' : null;
    } catch {
      return null;
    }
  }

  // Heuristic for plain text / markdown — sample first 1k chars
  const sampleText = text.slice(0, 1024);
  const isText = [...sampleText].every(character => {
    const code = character.charCodeAt(0);
    return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20;
  });
  return isText ? 'txt' : null;
}

// This function checks if the file type is allowed for conversion