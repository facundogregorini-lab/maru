import { createHash } from "node:crypto";
import { compareAndSetJson, getManyJson } from "../db";
import { SYNC_DOC_IDS, type StoredDoc, type SyncDoc } from "./docs";

/**
 * Datos de cada cuenta en la base. La clave usa un hash del email (no el email en claro) para que
 * un listado de claves no exponga a quién pertenece cada cosa.
 */

export const userId = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);

const keyFor = (email: string, doc: SyncDoc) => `maru:u:${userId(email)}:${doc}`;

export async function readDocs(email: string): Promise<Record<SyncDoc, StoredDoc | null>> {
  const values = await getManyJson<StoredDoc>(SYNC_DOC_IDS.map((d) => keyFor(email, d)));
  return Object.fromEntries(SYNC_DOC_IDS.map((d, i) => [d, values[i]])) as Record<SyncDoc, StoredDoc | null>;
}

export async function writeDoc(email: string, doc: SyncDoc, data: unknown, expectedVersion: number, now = Date.now()) {
  const stored: StoredDoc = { data, updatedAt: Math.max(now, expectedVersion + 1) };
  return compareAndSetJson(keyFor(email, doc), expectedVersion, stored);
}
