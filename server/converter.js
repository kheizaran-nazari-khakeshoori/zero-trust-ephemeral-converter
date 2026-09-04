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

// Simple JSON to CSV converter in RAM
export function convertJsonToCsv(jsonBuffer) {
  try {
    const data = JSON.parse(jsonBuffer.toString('utf-8'));
    if (!Array.isArray(data) || data.length === 0) return null;

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  } catch (err) {
    return null;
  }
}