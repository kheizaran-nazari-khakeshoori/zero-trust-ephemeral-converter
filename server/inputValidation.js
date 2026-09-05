export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
export const ALLOWED_TARGET_FORMATS = new Set(['html', 'pdf', 'csv', 'webp']);

export function validateTargetFormat(targetFormat) {
  return typeof targetFormat === 'string'
    && ALLOWED_TARGET_FORMATS.has(targetFormat.trim().toLowerCase());
}

export function validateOriginalFilename(filename) {
  return typeof filename === 'string'
    && filename.length > 0
    && filename.length <= 255
    && !filename.includes('\0');
}