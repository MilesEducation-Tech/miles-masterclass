/**
 * Generate a unique UUID using native crypto API.
 * Works in both browser and Node.js environments.
 * @returns A unique UUID string (v4 format)
 */
export function generateUUID(): string {
  // crypto.randomUUID is available in modern browsers and Node.js 19+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate a UUID v4 string.
 * @param id - The ID to validate
 * @returns True if valid UUID v4 format, false otherwise
 */
export function isValidUUID(id: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(id);
}
