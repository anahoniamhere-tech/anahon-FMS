import React from "react";
import { SharedProps } from "./shared";

/**
 * Social platform — Postiz, framed inside the system (6 Sep 2026). The same pattern as the Live
 * editor: Postiz sits beside the FMS on every host that serves it (:3100 ↔ :4007 on the NAS,
 * 8444 ↔ 8445 over the tailnet), so the address to frame is the one the FMS is being browsed at
 * with the port swapped. Postiz keeps its own sign-in; the gate stays on the Social desk.
 */
const POSTIZ_PORT: Record<string, string> = { "3100": "4007", "8444": "8445" };
export const postizAddress = () =>
  typeof window !== "undefined" && POSTIZ_PORT[window.location.port]
    ? `${window.location.protocol}//${window.location.hostname}:${POSTIZ_PORT[window.location.port]}`
    : "";

export default function PostizTab({ t }: SharedProps) {
  const url = postizAddress();
  if (!url) return <p className="p-4 text-sm text-slate-600">{t("Postiz is reachable only from the office network or the tailnet.")}</p>;
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-slate-600">
        <span>{t("Compose here and leave posts as drafts; the Social desk releases them through the editorial gate.")}</span>
        <a href={url} target="_blank" rel="noopener" className="ms-auto text-red-700 underline">{t("Open in its own tab")} ↗</a>
      </div>
      <iframe title="Postiz" src={url} className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white" allow="clipboard-write" />
    </div>
  );
}
