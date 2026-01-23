/**
 * URL Protocol Whitelist
 *
 * Defines the allowed URL protocols for external link opening.
 * Used by both renderer (WebLinksAddon) and main process (IPC handler)
 * for defense-in-depth security.
 *
 * Allowed protocols:
 * - http:// - Standard HTTP URLs
 * - https:// - Secure HTTPS URLs
 *
 * Blocked protocols (security):
 * - javascript: - XSS attack vector
 * - file:// - Local filesystem access
 * - data: - Data URLs can execute scripts
 * - All other protocols
 */

const ALLOWED_PROTOCOLS = ['http://', 'https://'] as const

/**
 * Check if URL uses an allowed protocol for external opening.
 * @param url - The URL to validate
 * @returns true if URL starts with http:// or https://
 */
export function isAllowedExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return ALLOWED_PROTOCOLS.some(protocol => url.startsWith(protocol))
}
