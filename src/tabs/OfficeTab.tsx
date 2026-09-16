import { SharedProps } from "./shared";

/**
 * The Virtual Office — the village (~/AnaHon/agent-village, built into public/village) running
 * on the real FMS. Everyone may open it: staff see their own cards and colleagues as a state,
 * directors see every card (GET /api/office/board decides, server-side).
 *
 * The frame is same-origin, so the village reads the board through this page's fetch, which
 * carries the signed-in session — the village itself holds no credentials. It is read-only:
 * a card opens its item here, in the FMS. scripts/check-office.ts pins both halves.
 */
export default function OfficeTab(_: SharedProps) {
  return (
    <iframe
      src="/village/"
      title="Virtual Office"
      className="office-frame block w-full rounded-lg border-0"
      style={{ minHeight: 480 }}
    />
  );
}
