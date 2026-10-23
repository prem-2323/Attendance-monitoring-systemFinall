/**
 * Central API configuration.
 *
 * Local development:
 *   Leave VITE_API_BASE_URL empty. Vite proxies /api/* to http://127.0.0.1:8000.
 *
 * Production (Vercel):
 *   Set VITE_API_BASE_URL to the Render service origin, e.g.
 *   https://attendance-api.onrender.com
 *
 * The value may optionally include a trailing "/api"; it is normalised below.
 */
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_ORIGIN = rawBaseUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

if (import.meta.env.PROD && !API_ORIGIN) {
  // This is intentionally loud: without it every request would hit the
  // Vercel domain (/api/...) and return 404.
  console.error(
    '[API] VITE_API_BASE_URL is not configured. Set it in Vercel to your Render backend URL.'
  );
}

export function apiUrl(path: string): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalisedPath}`;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}
