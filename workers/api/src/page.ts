/** The small, locked-down HTML page behind the signed links in Dan's emails. */
import { escapeHtml } from "./text.ts";

export function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#2b1d14;background:#efe3c8}.note{white-space:pre-wrap;padding:14px;background:#fff6b8;border:2px solid #2b1d14;border-radius:4px;box-shadow:3px 3px 0 #2b1d14}button{font:inherit;font-weight:700;padding:10px 16px;border:3px solid #2b1d14;border-radius:6px;background:#bfe3d6;cursor:pointer}.muted{color:#7a6a5a;font-size:14px}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}
