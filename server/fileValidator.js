// Dictionary of common file magic bytes (binary signatures)
const FILE_SIGNATURES = {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // JPEG: FF D8 FF
  jpg: [0xff, 0xd8, 0xff],
  // PDF: 25 50 44 46 (%PDF)
  pdf: [0x25, 0x50, 0x44, 0x46]
};

export function validateMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  for (const [type, signature] of Object.entries(FILE_SIGNATURES)) {
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return type;
  }

  const text = buffer.toString('utf8');
  if (text.includes('\uFFFD') || text.includes('\u0000')) return null;

  const trimmedText = text.replace(/^\uFEFF/, '').trim();
  if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedText);
      return parsed !== null && typeof parsed === 'object' ? 'json' : null;
    } catch (error) {
      return null;
    }
  }

  const isText = [...text.slice(0, 100)].every(character => {
    const code = character.charCodeAt(0);
    return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20;
  });
  return isText ? 'txt' : null;
}