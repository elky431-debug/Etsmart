/**
 * Etsy listing descriptions are plain text; Markdown (e.g. **) is shown literally.
 * Strip common LLM Markdown so copy-paste is clean for sellers.
 */
export function sanitizeEtsyDescriptionPlainText(raw: string): string {
  if (!raw) return '';
  let s = raw;
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\*([^*\n]+)\*/g, '$1');
  s = s.replace(/__([^_\n]+)__/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/\*\*/g, '');
  return s.trim();
}
