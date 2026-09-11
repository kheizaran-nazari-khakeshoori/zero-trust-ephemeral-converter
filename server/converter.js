import PDFDocument from 'pdfkit';
import sharp from 'sharp';

export function convertMarkdownToHtml(markdownText) {
  if (typeof markdownText !== 'string') return null;

  const escapeHtml = value => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const inlineMarkdown = value => escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const lines = markdownText.replace(/\r\n?/g, '\n').split('\n');
  const htmlLines = [];
  let inList = false;

  for (const line of lines) {
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      htmlLines.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    if (inList) {
      htmlLines.push('</ul>');
      inList = false;
    }

    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      htmlLines.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (line.trim()) {
      htmlLines.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }

  if (inList) htmlLines.push('</ul>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted Document</title></head><body>${htmlLines.join('')}</body></html>`;
}

export function convertMarkdownToPdf(markdownText) {
  if (typeof markdownText !== 'string' || !markdownText.trim()) return null;

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 50 });
    const chunks = [];

    document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    for (const line of markdownText.replace(/\r\n?/g, '\n').split('\n')) {
      const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
      if (heading) {
        const size = { 1: 24, 2: 18, 3: 14 }[heading[1].length];
        document.fontSize(size).text(heading[2]).moveDown(0.5);
      } else if (line.trim()) {
        document.fontSize(11).text(line).moveDown(0.35);
      }
    }

    document.end();
  });
}

export async function convertPngToWebp(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) return null;
  try {
    return await sharp(imageBuffer, { failOnError: true, limitInputPixels: 25_000_000 })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return null;
  }
}

// Generic image conversion (png/jpg/jpeg/webp/gif -> png/jpg/webp)
export async function convertImage(imageBuffer, targetFormat) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) return null;
  const fmt = targetFormat.toLowerCase();
  const allowed = new Set(['png', 'jpg', 'jpeg', 'webp']);
  if (!allowed.has(fmt)) return null;
  const out = fmt === 'jpg' ? 'jpeg' : fmt;
  try {
    const pipeline = sharp(imageBuffer, { failOnError: true, limitInputPixels: 25_000_000 });
    if (out === 'jpeg') return await pipeline.jpeg({ quality: 85 }).toBuffer();
    if (out === 'png') return await pipeline.png().toBuffer();
    if (out === 'webp') return await pipeline.webp({ quality: 85 }).toBuffer();
    return null;
  } catch {
    return null;
  }
}

// Simple JSON to CSV converter in RAM
export function convertJsonToCsv(jsonBuffer) {
  try {
    const text = Buffer.isBuffer(jsonBuffer) ? jsonBuffer.toString('utf-8') : String(jsonBuffer);
    if (text.length > 2_000_000) return null;
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) return null;
    if (data.length > 10_000) return null;
    if (!data.every(row => row && typeof row === 'object' && !Array.isArray(row))) return null;
    const headers = [...new Set(data.flatMap(row => Object.keys(row)))];
    if (headers.length === 0 || headers.length > 100) return null;
    const escapeCsv = value => {
      if (value === null || value === undefined) return '';
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csvRows = [headers.map(escapeCsv).join(',')];
    for (const row of data) {
      const values = headers.map(header => escapeCsv(row[header]));
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  } catch {
    return null;
  }
}

export function convertCsvToJson(csvBuffer) {
  try {
    const text = Buffer.isBuffer(csvBuffer) ? csvBuffer.toString('utf-8') : String(csvBuffer);
    if (!text.trim()) return null;
    if (text.length > 2_000_000) return null;
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return null;
    if (lines.length > 10_001) return null;

    const parseLine = (line) => {
      const out = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if ((ch === ',' || ch === ';') && !inQuotes) {
          out.push(cur);
          cur = '';
          // keep delimiter consistent? first delimiter wins
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(v => v.trim());
    };

    // detect delimiter
    const delimComma = (lines[0].match(/,/g) || []).length;
    const delimSemi = (lines[0].match(/;/g) || []).length;
    // parse uniformly; parseLine handles both

    const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    if (headers.length === 0 || headers.length > 100) return null;
    if (headers.some(h => !h)) return null;

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      // pad
      while (vals.length < headers.length) vals.push('');
      const obj = {};
      headers.forEach((h, idx) => {
        let v = vals[idx] ?? '';
        v = v.replace(/^"|"$/g, '').replace(/""/g, '"');
        // try coerce numbers/booleans
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v !== '' && !isNaN(v) && v.trim() !== '') {
          const num = Number(v);
          if (String(num) === v.trim()) v = num;
        }
        obj[h] = v;
      });
      rows.push(obj);
    }
    return JSON.stringify(rows, null, 2);
  } catch {
    return null;
  }
}

export function convertTextToTxt(textBuffer) {
  try {
    const text = Buffer.isBuffer(textBuffer) ? textBuffer.toString('utf-8') : String(textBuffer);
    if (!text || !text.trim()) return null;
    if (text.length > 5_000_000) return null;
    return text.replace(/\r\n?/g, '\n');
  } catch {
    return null;
  }
}
