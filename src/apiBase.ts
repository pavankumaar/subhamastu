// In development the Vite proxy serves /api, so this stays empty. A production build sets
// VITE_API_BASE_URL to the backend origin (e.g. https://subhamastu-api.onrender.com).
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`
}
