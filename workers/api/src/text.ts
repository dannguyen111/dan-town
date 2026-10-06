/** Drops control characters (keeps newlines and tabs) and trims. */
export const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
export const looksLikeEmail = (s: string) => EMAIL.test(s);

export const clientIp = (request: Request) => request.headers.get("CF-Connecting-IP") ?? "anon";
