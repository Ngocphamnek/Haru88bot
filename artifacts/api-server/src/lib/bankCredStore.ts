/**
 * Encrypted file-based credential store for bank integrations.
 * Saves to data/bank-creds.json (AES-256-GCM). Works without DATABASE_URL.
 * Legacy plaintext values are still readable and re-encrypted on next write.
 */
import fs from "node:fs";
import path from "node:path";
import { encryptSecret, decryptSecret } from "./security.js";

const CREDS_PATH = path.join(process.cwd(), "data", "bank-creds.json");

// Keys that contain secrets and must be encrypted at rest
const SENSITIVE_KEY_RE = /(password|passwd|secret|token|pin|private|key)$/i;

function isSensitive(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

function readAllRaw(): Record<string, string> {
  try {
    if (!fs.existsSync(CREDS_PATH)) return {};
    return JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAllRaw(data: Record<string, string>): void {
  const dir = path.dirname(CREDS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Restrictive permissions where supported
  fs.writeFileSync(CREDS_PATH, JSON.stringify(data, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function getCredential(key: string): string {
  const raw = readAllRaw()[key];
  if (raw != null && raw !== "") {
    return isSensitive(key) ? decryptSecret(raw) : raw;
  }
  return process.env[key.toUpperCase()] ?? "";
}

export function setCredential(key: string, value: string): void {
  const all = readAllRaw();
  all[key] = isSensitive(key) ? encryptSecret(value) : value;
  writeAllRaw(all);
}

export function setCredentials(entries: Record<string, string>): void {
  const all = readAllRaw();
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === null) continue;
    if (v === "") {
      delete all[k];
      continue;
    }
    all[k] = isSensitive(k) ? encryptSecret(v) : v;
  }
  writeAllRaw(all);
}

/** Migrate any leftover plaintext sensitive values to encrypted form. */
export function migratePlaintextCredentials(): number {
  const all = readAllRaw();
  let changed = 0;
  for (const [k, v] of Object.entries(all)) {
    if (!isSensitive(k) || !v || v.startsWith("enc:v1:")) continue;
    all[k] = encryptSecret(v);
    changed++;
  }
  if (changed > 0) writeAllRaw(all);
  return changed;
}
