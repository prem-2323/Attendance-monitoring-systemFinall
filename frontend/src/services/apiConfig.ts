/**
 * Central API configuration.
 *
 * Local development:
 *   If VITE_API_BASE_URL is empty in DEV, Vite proxies /api/* to http://127.0.0.1:8000.
 *
 * Production (Vercel):
 *   Uses VITE_API_BASE_URL if configured, and gracefully falls back to the live Render backend:
 *   https://attendance-monitoring-systemfinall.onrender.com
 */
const DEFAULT_API_ORIGIN = 'https://attendance-monitoring-systemfinall.onrender.com';

const rawBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '' : DEFAULT_API_ORIGIN)
).trim();

export const API_ORIGIN = (rawBaseUrl || (import.meta.env.DEV ? '' : DEFAULT_API_ORIGIN))
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

export function apiUrl(path: string): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalisedPath}`;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}
