import { createHash } from "node:crypto";

/** Hash corto y estable (sólo servidor/scripts). */
export function sha(s: string, len = 16): string {
  return createHash("sha256").update(s).digest("hex").slice(0, len);
}
