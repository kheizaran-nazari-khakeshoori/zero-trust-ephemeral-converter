// Simple Markdown to HTML converter in RAM
export function convertMarkdownToHtml(markdownText) {
  let html = markdownText
    // Headers
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    // Bold & Italic
    .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*)\*/gim, '<i>$1</i>')
    // Paragraphs
    .replace(/\n$/gim, '<br />');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted Document</title></head><body>${html.trim()}</body></html>`;
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