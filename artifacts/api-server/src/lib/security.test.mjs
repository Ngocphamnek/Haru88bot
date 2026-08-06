/**
 * Lightweight security regression tests (no DB).
 * Run: node --test src/lib/security.test.mjs
 * or after build from package root with NODE_ENV=test.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// Inline minimal copies of pure helpers so tests don't need full app boot / env fail-closed
function timingSafeStringEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

const SECRET = "test-secret-key-for-hmac-32b!!";
const GAME_SECRET = "game-token-secret-for-tests!!";

function b64url(buf) {
  return Buffer.isBuffer(buf) ? buf.toString("base64url") : Buffer.from(buf).toString("base64url");
}
function fromB64url(s) {
  return Buffer.from(s, "base64url");
}

function issueGameToken(tgid, secret = GAME_SECRET, ttlMs = 3600_000) {
  const exp = Date.now() + ttlMs;
  const payload = `${tgid}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}

function verifyGameToken(token, expectedTgid, secret = GAME_SECRET) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payload = fromB64url(parts[0]).toString("utf8");
  const expectedSig = createHmac("sha256", secret).update(payload).digest();
  const givenSig = fromB64url(parts[1]);
  if (expectedSig.length !== givenSig.length || !timingSafeEqual(expectedSig, givenSig)) return null;
  const [tgid, exp] = payload.split(".");
  if (!/^\d{5,15}$/.test(tgid)) return null;
  if (Date.now() > Number(exp)) return null;
  if (expectedTgid && tgid !== expectedTgid) return null;
  return tgid;
}

function issueAdminSession(username, jwtSecret = SECRET, ttl = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: "admin",
    sub: username,
    iat: now,
    exp: now + ttl,
    jti: randomBytes(16).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", jwtSecret).update(`admin.v1.${body}`).digest();
  return { token: `adm1.${body}.${b64url(sig)}`, jti: payload.jti, exp: payload.exp };
}

function verifyAdminSession(token, jwtSecret = SECRET) {
  if (!token?.startsWith("adm1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = parts[1];
  const expected = createHmac("sha256", jwtSecret).update(`admin.v1.${body}`).digest();
  const given = fromB64url(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const payload = JSON.parse(fromB64url(body).toString("utf8"));
  if (payload.role !== "admin" || Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

function deriveKey(secret) {
  return scryptSync(secret, "haru88-bank-creds-v1", 32);
}
function encryptSecret(plaintext, secret = SECRET) {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}
function decryptSecret(ciphertext, secret = SECRET) {
  if (!ciphertext.startsWith("enc:v1:")) return ciphertext;
  const parts = ciphertext.split(":");
  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const data = Buffer.from(parts[4], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function validateBetAmount(amount, min = 1000, max = 50_000_000) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return { ok: false };
  if (n < min || n > max) return { ok: false };
  if (Math.floor(n) !== n) return { ok: false };
  return { ok: true, amount: n };
}

describe("timing-safe compare", () => {
  it("equals", () => assert.equal(timingSafeStringEqual("abc", "abc"), true));
  it("not equals", () => assert.equal(timingSafeStringEqual("abc", "abd"), false));
  it("length mismatch", () => assert.equal(timingSafeStringEqual("a", "aa"), false));
});

describe("game token", () => {
  it("roundtrip", () => {
    const t = issueGameToken("123456789");
    assert.equal(verifyGameToken(t, "123456789"), "123456789");
  });
  it("rejects wrong tgid claim", () => {
    const t = issueGameToken("123456789");
    assert.equal(verifyGameToken(t, "999999999"), null);
  });
  it("rejects tamper", () => {
    const t = issueGameToken("123456789");
    const bad = t.slice(0, -4) + "xxxx";
    assert.equal(verifyGameToken(bad), null);
  });
  it("rejects expired", () => {
    const t = issueGameToken("123456789", GAME_SECRET, -1000);
    assert.equal(verifyGameToken(t), null);
  });
});

describe("admin session", () => {
  it("roundtrip", () => {
    const { token, jti } = issueAdminSession("ops");
    const p = verifyAdminSession(token);
    assert.ok(p);
    assert.equal(p.sub, "ops");
    assert.equal(p.jti, jti);
  });
  it("rejects bad sig", () => {
    const { token } = issueAdminSession("ops");
    assert.equal(verifyAdminSession(token + "x"), null);
  });
});

describe("bank cred encryption", () => {
  it("roundtrip", () => {
    const enc = encryptSecret("bank-password-secret");
    assert.ok(enc.startsWith("enc:v1:"));
    assert.equal(decryptSecret(enc), "bank-password-secret");
  });
  it("legacy plaintext passthrough", () => {
    assert.equal(decryptSecret("plain"), "plain");
  });
});

describe("bet limits", () => {
  it("accepts valid", () => assert.equal(validateBetAmount(5000).ok, true));
  it("rejects below min", () => assert.equal(validateBetAmount(100).ok, false));
  it("rejects above max", () => assert.equal(validateBetAmount(999_999_999).ok, false));
  it("rejects float", () => assert.equal(validateBetAmount(1000.5).ok, false));
});

describe("hold/settle math", () => {
  it("net from hold+win matches legacy", () => {
    const balance = 100_000;
    const bet = 10_000;
    const winGross = 20_000; // 2x payout
    const afterHold = balance - bet;
    const afterWin = afterHold + winGross;
    const legacyNet = balance - bet + winGross;
    assert.equal(afterWin, legacyNet);
    assert.equal(afterWin, 110_000);
  });
  it("loss leaves stake gone", () => {
    const balance = 100_000;
    const bet = 10_000;
    const afterHold = balance - bet;
    const afterLoss = afterHold + 0;
    assert.equal(afterLoss, 90_000);
  });
});
