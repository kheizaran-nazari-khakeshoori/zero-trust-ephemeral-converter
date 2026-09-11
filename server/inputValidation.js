export const ALLOWED_TARGET_FORMATS = new Set(['html', 'pdf', 'csv', 'json', 'txt', 'webp', 'png', 'jpg', 'jpeg']);

export function validateTargetFormat(targetFormat) {
  return typeof targetFormat === 'string'
    && ALLOWED_TARGET_FORMATS.has(targetFormat.trim().toLowerCase());
}

export function validateOriginalFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 255) return false;
  if (filename.includes('\0')) return false;
  // Block path traversal and directory separators
  if (filename.includes('/') || filename.includes('\\')) return false;
  if (filename.includes('..')) return false;
  // Must not be only dots/spaces and should contain at least one alphanumeric
  if (!/[a-zA-Z0-9]/.test(filename)) return false;
  // No control characters
  if (/[\x00-\x1F\x7F]/.test(filename)) return false;
  return true;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email.trim());
}

export function validatePassword(password) {
  // At least 8 chars, at least one letter and one number or symbol for minimal strength
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

export function validateTotpCode(code) {
  return typeof code === 'string' && /^\d{6}$/.test(code.trim());
}


// This function checks if the file type is allowed for conversion

//i need both inputvalidation and also filevalidator to prevent the attacker to be able to send valid file name with malicious bytes or valid bytes with malicious filename 
