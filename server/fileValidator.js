// Dictionary of common file magic bytes (binary signatures)
const FILE_SIGNATURES = {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // JPEG: FF D8 FF
  jpg: [0xff, 0xd8, 0xff],
  // PDF: 25 50 44 46 (%PDF)
  pdf: [0x25, 0x50, 0x44, 0x46],
  // GIF: 47 49 46 38
  gif: [0x47, 0x49, 0x46, 0x38]
};

function isWebP(buffer) {
  // RIFF....WEBP  -> bytes 0-3 = RIFF, 8-11 = WEBP
  if (buffer.length < 12) return false;
  return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
      && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
}

export function validateMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  if (isWebP(buffer)) return 'webp';

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

  // Try JSON first
  if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedText);
      return parsed !== null && typeof parsed === 'object' ? 'json' : null;
    } catch {
      return null;
    }
  }

  // CSV heuristic: contains comma or semicolon and newlines, and not markdown
  // Require at least one comma/semicolon and consistent line structure
  const firstNewline = trimmedText.indexOf('\n');
  if (firstNewline !== -1 || trimmedText.includes(',')) {
    const lines = trimmedText.split('\n').slice(0, 5);
    const hasDelimiter = lines.some(l => l.includes(',') || l.includes(';'));
    // If file ends with .csv extension fallback handled elsewhere, but heuristic:
    if (hasDelimiter) {
      const firstCols = (lines[0].match(/[,;]/g) || []).length;
      // Simple CSV detection: header line with delimiters and next lines similar count
      if (firstCols >= 1 && lines.length >= 2) {
        // Check not obviously markdown/html
        const looksText = !trimmedText.startsWith('<') || lines[0].includes(',');
        if (looksText) {
          // Additional check: if all lines have similar delimiter count, treat as csv
          // but keep as txt if ambiguous; prefer csv when file passed csv extension check may be ambiguous
          // We return csv only if strong signal
          const counts = lines.map(l => (l.match(/[,;]/g) || []).length);
          const consistent = counts.every(c => Math.abs(c - firstCols) <= 1);
          if (consistent && firstCols >= 1) {
            // Distinguish csv vs plain txt: if lines contain commas, return csv unless it looks like sentences
            // If commas are inside sentences (prose), don't misclassify — require at least 2 lines with delimiters
            const csvLines = counts.filter(c => c >= 1).length;
            if (csvLines >= 2) return 'csv';
          }
        }
      }
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
