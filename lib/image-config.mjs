// Bring-your-own-key resolution for the image service.
//
// The secret never lives in configuration: each machine stores its own key in
// the harness credential store (`$DSH_HOME/.credentials.yaml`, private to the OS
// user, hot-reloaded, never committed) under the reference GZH_IMAGE_KEY. The
// `image.apiKey` in data/settings.json is only a fallback for installs that have
// not set up their own key. A stored credential therefore wins, so whoever runs
// the app pays their own provider account.

/** Credential reference every machine's own image-service key is stored under. */
export const IMAGE_KEY_REF = 'GZH_IMAGE_KEY';
/** Credential reference the desktop GUI stores the service address under (non-secret, local). */
export const IMAGE_BASEURL_REF = 'GZH_IMAGE_BASEURL';
/** Credential reference the desktop GUI stores the model name under (non-secret, local). */
export const IMAGE_MODEL_REF = 'GZH_IMAGE_MODEL';

/**
 * Resolve the effective image-service configuration for one request.
 *
 * Re-resolved per call (never cached) so a rotated key reaches the next request
 * without a restart, matching the credential seam's own contract.
 *
 * @param credentials - the optional `ctx.get('credentials')` seam; may be absent.
 * @param base - the settings.json `image` block (baseUrl/model/apiKey).
 * @returns {{ baseUrl: string, model: string, apiKey: string, source: string, configured: boolean }}
 *   `source` is 'credential-store' when the key came from the machine's own
 *   store, 'settings' when it fell back to settings.json, or '' when unset.
 */
export async function resolveImageConfig(credentials, base = {}) {
  const resolved = {
    baseUrl: String(base.baseUrl || '').trim().replace(/\/+$/, ''),
    model: String(base.model || '').trim(),
    apiKey: String(base.apiKey || '').trim(),
    source: '',
  };
  if (resolved.apiKey) resolved.source = 'settings';

  // The machine's own stored values outrank the bundled/fallback settings block.
  if (credentials && typeof credentials.resolve === 'function') {
    const readRef = async (ref) => {
      try {
        const hit = await credentials.resolve(ref);
        return typeof hit?.value === 'string' ? hit.value.trim() : '';
      } catch { return ''; }
    };
    const baseUrl = await readRef(IMAGE_BASEURL_REF);
    if (baseUrl) resolved.baseUrl = baseUrl.replace(/\/+$/, '');
    const model = await readRef(IMAGE_MODEL_REF);
    if (model) resolved.model = model;
    const apiKey = await readRef(IMAGE_KEY_REF);
    if (apiKey) { resolved.apiKey = apiKey; resolved.source = 'credential-store'; }
  }

  resolved.configured = Boolean(resolved.apiKey && resolved.baseUrl && resolved.model);
  return resolved;
}
