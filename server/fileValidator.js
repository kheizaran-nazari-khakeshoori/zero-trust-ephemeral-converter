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
  if (!buffer || buffer.length < 8) return null;

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

  // Return plain text if valid ASCII range, otherwise null for unknown binary
  const isAscii = buffer.slice(0, 100).every(byte => byte >= 0x09 && byte <= 0x7e);
  return isAscii ? 'txt' : null;
}