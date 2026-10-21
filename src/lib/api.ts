import { API_URL } from '../config';

export class ApiError extends Error { code?: string; constructor(msg: string, code?: string) { super(msg); this.code = code; } }

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } }
};

export type Role = 'admin' | 'sup';
const TOKEN_KEY = (role: Role) => `diuot.trial.${role}.token`;
const EMAIL_KEY = (role: Role) => `diuot.trial.${role}.email`;

export const session = {
  token: (role: Role) => store.get(TOKEN_KEY(role)),
  email: (role: Role) => store.get(EMAIL_KEY(role)) || '',
  save(role: Role, token: string, email: string) { store.set(TOKEN_KEY(role), token); store.set(EMAIL_KEY(role), email); },
  clear(role: Role) { store.set(TOKEN_KEY(role), null); }
};

let apiUrlOverride = '';
export function setApiUrl(u: string) { apiUrlOverride = u; }
export function apiUrl() { return apiUrlOverride || API_URL || store.get('diuot.trial.apiUrl') || ''; }
export function rememberApiUrl(u: string) { store.set('diuot.trial.apiUrl', u.trim()); }

/** Calls one backend action. Throws ApiError with a readable message. */
export async function call<T = any>(action: string, params: Record<string, any> = {}, role?: Role): Promise<T> {
  const url = apiUrl();
  if (!url) throw new ApiError('The portal is not connected to its backend yet (API address missing).', 'CONFIG');
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body: JSON.stringify({ action, token: role ? session.token(role) : undefined, ...params }), redirect: 'follow' });
  } catch {
    throw new ApiError('Could not reach the server. Check your internet connection and try again.', 'NETWORK');
  }
  let body: any;
  try { body = await res.json(); } catch { throw new ApiError('The server sent an unexpected reply. Please try again in a minute.', 'BAD_REPLY'); }
  if (!body.ok) {
    if (body.code === 'AUTH' && role) session.clear(role);
    throw new ApiError(body.error || 'Something went wrong.', body.code);
  }
  return body.data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}
