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

// Simple JSON to CSV converter in RAM
export function convertJsonToCsv(jsonBuffer) {
  try {
    const text = Buffer.isBuffer(jsonBuffer) ? jsonBuffer.toString('utf-8') : String(jsonBuffer);
    // Guard against huge payloads — already limited to 10MB upload but be explicit
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