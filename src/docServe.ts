/**
 * How a stored upload is sent back to a browser (11 Oct 2026).
 *
 * The type comes from the file's extension, never from the type the uploader declared, and
 * the browser is told not to second-guess it (nosniff). Anything that can act as a page —
 * HTML, SVG, text — is served under a sandbox that switches scripts off entirely, so it
 * renders as a static page whether it is opened in the viewer or on its own. The sandbox
 * keeps the document's own origin and allows the print dialog, because the viewer's Print
 * button prints the frame directly. Everything not on the short inline list is a download.
 *
 * The 182 stored HTML documents (reconstructed vouchers) carry no scripts, no external
 * styles and only data: images, so this policy renders them exactly as before.
 */
const INLINE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  webm: "audio/webm", m4a: "audio/mp4", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4",
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8", json: "text/plain; charset=utf-8",
};
const SANDBOXED = new Set(["html", "htm", "svg", "txt", "md", "csv", "json"]);
export const DOC_SANDBOX = "sandbox allow-same-origin allow-modals; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

export type DocHeaders = { type: string; disposition: "inline" | "attachment"; csp?: string };

export function docHeaders(filename: string, declaredType = ""): DocHeaders {
  const ext = (String(filename || "").match(/\.([A-Za-z0-9]{1,5})$/) || [, ""])[1]!.toLowerCase();
  const declared = String(declaredType || "").toLowerCase();
  const type = INLINE[ext];
  if (!type) return { type: "application/octet-stream", disposition: "attachment" };
  // A recording keeps its declared audio/video type: some were saved with a .webm name but an
  // m4a body, and a media type can never run as a page.
  const media = /^(audio|video)\//.test(declared) && /^(audio|video)\//.test(type) ? declaredType : type;
  return { type: media, disposition: "inline", ...(SANDBOXED.has(ext) ? { csp: DOC_SANDBOX } : {}) };
}

/** Sets the headers on an Express response. `downloadName` is the name the browser offers. */
export function setDocHeaders(res: any, filename: string, declaredType: string, downloadName = filename) {
  const h = docHeaders(filename, declaredType);
  res.setHeader("Content-Type", h.type);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `${h.disposition}; filename="${encodeURIComponent(downloadName)}"`);
  if (h.csp) res.setHeader("Content-Security-Policy", h.csp);
}
