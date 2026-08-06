/**
 * MSB Bank Captcha OCR
 *
 * MSB dùng captcha 4 chữ số (GIF/JPEG ~68×22px, màu đỏ #cd0707 trên nền trắng).
 *
 * Chiến lược chính: chia ảnh thành 4 phần (1 digit/phần), chạy ONNX từng phần.
 * Green channel extraction cho contrast hoàn hảo với text đỏ trên nền trắng.
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as ort from "onnxruntime-node";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MODEL_CANDIDATES = [
  // Runtime (dist/) layouts after build.mjs asset copy
  join(__dirname, "model.onnx"),
  join(__dirname, "lib/model.onnx"),
  join(__dirname, "corebank/model.onnx"),
  join(__dirname, "../model.onnx"),
  join(__dirname, "../corebank/model.onnx"),
  // Dev / source layouts
  join(process.cwd(), "model.onnx"),
  join(process.cwd(), "dist/model.onnx"),
  join(process.cwd(), "src/corebank/model.onnx"),
  join(process.cwd(), "artifacts/api-server/src/corebank/model.onnx"),
];
const MODEL_PATH = MODEL_CANDIDATES.find(p => existsSync(p)) ?? MODEL_CANDIDATES[0]!;

// Char set — giống CoreBank OCR (sorted: 0-9, A-Z, a-z)
const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
const UPPER = Array.from({length:26},(_,i)=>String.fromCharCode(65+i));
const LOWER = Array.from({length:26},(_,i)=>String.fromCharCode(97+i));
const CHARSET = [...DIGITS,...UPPER,...LOWER].sort();
// sorted: '0'=idx0,'1'=idx1,...,'9'=idx9,'A'=idx10,...

let session: ort.InferenceSession | null = null;
let sessionFailed = false;

async function getSession(): Promise<ort.InferenceSession | null> {
  if (session) return session;
  if (sessionFailed) return null;
  if (!existsSync(MODEL_PATH)) {
    logger.warn({ MODEL_PATH }, "MSB OCR: model not found");
    sessionFailed = true;
    return null;
  }
  try {
    session = await ort.InferenceSession.create(MODEL_PATH);
    logger.info({ MODEL_PATH }, "MSB OCR: ONNX model loaded");
    return session;
  } catch (err) {
    logger.warn({ err }, "MSB OCR: failed to load model");
    sessionFailed = true;
    return null;
  }
}

// ── CTC decode helper ─────────────────────────────────────────────────────────
function ctcDecode(data: Float32Array, seqLen: number, numClasses: number): string {
  let text = "";
  let prevIdx = -1;
  for (let s = 0; s < seqLen; s++) {
    let maxIdx = 0;
    let maxVal = data[s * numClasses] ?? 0;
    for (let c = 1; c < numClasses; c++) {
      const v = data[s * numClasses + c] ?? 0;
      if (v > maxVal) { maxVal = v; maxIdx = c; }
    }
    // class 0 = blank in CTC, skip repeated
    if (maxIdx > 0 && maxIdx !== prevIdx) {
      const ch = CHARSET[maxIdx - 1]; // offset by 1 (blank at 0)
      if (ch) text += ch;
    }
    prevIdx = maxIdx;
  }
  return text;
}

// Alternative decode without blank offset (try both)
function ctcDecodeNoOffset(data: Float32Array, seqLen: number, numClasses: number): string {
  let text = "";
  let prevIdx = -1;
  for (let s = 0; s < seqLen; s++) {
    let maxIdx = 0;
    let maxVal = data[s * numClasses] ?? 0;
    for (let c = 1; c < numClasses; c++) {
      const v = data[s * numClasses + c] ?? 0;
      if (v > maxVal) { maxVal = v; maxIdx = c; }
    }
    if (maxIdx > 0 && maxIdx !== prevIdx) {
      const ch = CHARSET[maxIdx]; // no offset
      if (ch) text += ch;
    }
    prevIdx = maxIdx;
  }
  return text;
}

// ── Run ONNX on raw grayscale buffer ─────────────────────────────────────────
async function runOnnx(
  sess: ort.InferenceSession,
  raw: Buffer,
  width: number,
  height: number,
): Promise<string[]> {
  const pixels = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) pixels[i] = (raw[i] ?? 0) / 255.0;
  const tensor = new ort.Tensor("float32", pixels, [1, 1, height, width]);
  const results = await sess.run({ [sess.inputNames[0]!]: tensor });
  const output = Object.values(results)[0]!;
  const data = output.data as Float32Array;
  const dims = output.dims as readonly number[];
  const seqLen = dims[1]!;
  const numClasses = dims[2]!;
  // Return both decode variants
  return [
    ctcDecode(data, seqLen, numClasses),
    ctcDecodeNoOffset(data, seqLen, numClasses),
  ];
}

// ── Extract best digit from ONNX results ─────────────────────────────────────
function extractDigit(texts: string[]): string | null {
  for (const text of texts) {
    const digits = text.replace(/[^0-9]/g, "");
    if (digits.length >= 1) return digits[0]!;
  }
  return null;
}

// ── Get single-character raw buffer from image segment ───────────────────────
async function getSegmentBuffer(
  imageBuf: Buffer,
  x0: number,
  segW: number,
  fullW: number,
  fullH: number,
  targetW: number,
  targetH: number,
  useGreen: boolean,
  invert: boolean,
): Promise<Buffer> {
  let pipe = sharp(imageBuf)
    .extract({ left: x0, top: 0, width: segW, height: fullH });
  if (useGreen) {
    pipe = pipe.extractChannel('green') as any;
  } else {
    pipe = pipe.grayscale() as any;
  }
  pipe = pipe.resize(targetW, targetH, { fit: 'fill', kernel: 'nearest' }) as any;
  if (invert) pipe = pipe.negate() as any;
  return await (pipe as any).raw().toBuffer();
}

// ── Per-digit ONNX recognition ────────────────────────────────────────────────
// Chia ảnh thành 4 phần bằng nhau, nhận diện từng phần
async function recognizePerDigit(
  imageBuf: Buffer,
  sess: ort.InferenceSession,
): Promise<string | null> {
  const meta = await sharp(imageBuf).metadata();
  const fullW = meta.width ?? 68;
  const fullH = meta.height ?? 22;
  const segW = Math.floor(fullW / 4);

  const digits: string[] = [];

  // Preprocessing variants for each segment
  const variants: Array<{ useGreen: boolean; invert: boolean; tw: number; th: number }> = [
    { useGreen: true,  invert: false, tw: 40, th: 50 },
    { useGreen: true,  invert: true,  tw: 40, th: 50 },
    { useGreen: false, invert: false, tw: 40, th: 50 },
    { useGreen: false, invert: true,  tw: 40, th: 50 },
    { useGreen: true,  invert: false, tw: 32, th: 48 },
    { useGreen: false, invert: false, tw: 48, th: 56 },
  ];

  for (let i = 0; i < 4; i++) {
    const x0 = i * segW;
    const sw = (i === 3) ? fullW - x0 : segW; // last segment gets remainder

    let recognized: string | null = null;
    const candidates: { digit: string; score: number }[] = [];

    for (const v of variants) {
      try {
        const raw = await getSegmentBuffer(imageBuf, x0, sw, fullW, fullH, v.tw, v.th, v.useGreen, v.invert);
        const texts = await runOnnx(sess, raw, v.tw, v.th);
        for (const text of texts) {
          const d = text.replace(/[^0-9]/g, "");
          if (d.length >= 1) {
            candidates.push({ digit: d[0]!, score: 1 });
          }
        }
      } catch {
        continue;
      }
    }

    if (candidates.length > 0) {
      // Take majority vote
      const votes: Record<string, number> = {};
      for (const c of candidates) {
        votes[c.digit] = (votes[c.digit] ?? 0) + 1;
      }
      recognized = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }

    if (!recognized) {
      logger.debug({ segIndex: i, x0, sw, candidates }, "MSB OCR: could not recognize digit segment");
      return null; // Can't recognize all 4
    }
    digits.push(recognized);
  }

  const result = digits.join("");
  logger.info({ result, digits }, "MSB OCR: per-digit ONNX result");
  return result;
}

// ── Full image ONNX recognition ───────────────────────────────────────────────
async function recognizeFullImage(
  imageBuf: Buffer,
  sess: ort.InferenceSession,
): Promise<string | null> {
  const preprocessings: Array<{ name: string; tw: number; th: number; useGreen: boolean; invert: boolean }> = [
    { name: "green-160x50",       tw: 160, th: 50, useGreen: true,  invert: false },
    { name: "green-inv-160x50",   tw: 160, th: 50, useGreen: true,  invert: true  },
    { name: "gray-thresh-160x50", tw: 160, th: 50, useGreen: false, invert: false },
    { name: "gray-inv-160x50",    tw: 160, th: 50, useGreen: false, invert: true  },
    { name: "green-200x60",       tw: 200, th: 60, useGreen: true,  invert: false },
    { name: "green-inv-200x60",   tw: 200, th: 60, useGreen: true,  invert: true  },
  ];

  for (const p of preprocessings) {
    try {
      let pipe = sharp(imageBuf);
      if (p.useGreen) {
        pipe = pipe.extractChannel('green') as any;
      } else {
        pipe = pipe.grayscale() as any;
      }
      pipe = pipe.resize(p.tw, p.th, { fit: 'fill' }) as any;
      if (p.invert) pipe = pipe.negate() as any;
      const raw = await (pipe as any).raw().toBuffer();

      const texts = await runOnnx(sess, raw, p.tw, p.th);
      for (const text of texts) {
        const digits = text.replace(/[^0-9]/g, "");
        if (digits.length >= 4) {
          logger.info({ name: p.name, text, result: digits.slice(0,4) }, "MSB OCR full-image: 4+ digits");
          return digits.slice(0, 4);
        }
      }
    } catch { continue; }
  }
  return null;
}

// ── Pixel-based structural recognition ───────────────────────────────────────
// Fallback khi ONNX không nhận diện được
async function pixelBasedOcr(imageBuf: Buffer): Promise<string | null> {
  try {
    const meta = await sharp(imageBuf).metadata();
    const w = meta.width ?? 68;
    const h = meta.height ?? 22;

    // Green channel: text đỏ = 7, nền trắng = 255
    const raw = await (sharp(imageBuf).extractChannel('green') as any).raw().toBuffer();

    const binary = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      binary[i] = (raw[i] ?? 255) < 100 ? 1 : 0;
    }

    const segW = Math.floor(w / 4);
    const digits: string[] = [];

    for (let d = 0; d < 4; d++) {
      const x0 = d * segW;
      const x1 = d === 3 ? w : x0 + segW;
      const sw = x1 - x0;

      const seg = new Uint8Array(sw * h);
      for (let y = 0; y < h; y++) {
        for (let x = x0; x < x1; x++) {
          seg[y * sw + (x - x0)] = binary[y * w + x]!;
        }
      }

      const total = sw * h;
      const darkCount = seg.reduce((a, b) => a + b, 0);
      const density = darkCount / total;

      // Compute zone features
      const topH = Math.floor(h * 0.33);
      const botH = h - Math.floor(h * 0.66);
      const midH = h - topH - botH;
      const lw = Math.floor(sw * 0.5);
      const rw = sw - lw;

      let topD = 0, midD = 0, botD = 0, lD = 0, rD = 0;
      let tlD = 0, trD = 0, blD = 0, brD = 0;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < sw; x++) {
          const v = seg[y * sw + x]!;
          const isTop = y < topH;
          const isBot = y >= h - botH;
          const isMid = !isTop && !isBot;
          const isL = x < lw;
          if (isTop) { topD += v; if (isL) tlD += v; else trD += v; }
          else if (isBot) { botD += v; if (isL) blD += v; else brD += v; }
          else midD += v;
          if (isL) lD += v; else rD += v;
        }
      }

      const topA = topH * sw, midA = midH * sw, botA = botH * sw;
      const hA = Math.ceil(h / 2) * sw;
      const qA = topH * lw;

      const td = topA > 0 ? topD / topA : 0;
      const md = midA > 0 ? midD / midA : 0;
      const bd = botA > 0 ? botD / botA : 0;
      const ld = hA > 0 ? lD / hA : 0;
      const rd = hA > 0 ? rD / hA : 0;
      const tld = qA > 0 ? tlD / qA : 0;
      const trd = (topH * rw) > 0 ? trD / (topH * rw) : 0;
      const bld = (botH * lw) > 0 ? blD / (botH * lw) : 0;
      const brd = (botH * rw) > 0 ? brD / (botH * rw) : 0;

      // Midrow and edges
      const midRow = Math.floor(h / 2);
      let midRowD = 0, topRowD = 0, botRowD = 0, leD = 0, reD = 0;
      for (let x = 0; x < sw; x++) {
        midRowD += seg[midRow * sw + x]!;
        topRowD += seg[1 * sw + x] ?? 0;
        botRowD += seg[(h - 2) * sw + x] ?? 0;
      }
      for (let y = 0; y < h; y++) {
        leD += seg[y * sw + 1] ?? 0;
        reD += seg[y * sw + (sw - 2)] ?? 0;
      }
      const mrd = sw > 0 ? midRowD / sw : 0;
      const trd2 = sw > 0 ? topRowD / sw : 0;
      const brd2 = sw > 0 ? botRowD / sw : 0;
      const led = h > 0 ? leD / h : 0;
      const red = h > 0 ? reD / h : 0;

      let digit: string | null = null;
      if (density < 0.10) digit = '1';
      else if (density < 0.15 && rd > ld * 1.5) digit = '1';
      else if (td > 0.5 && bld < 0.15 && led < 0.25) digit = '7';
      else if (mrd > 0.55 && tld < 0.25 && brd > 0.35 && ld < 0.38) digit = '4';
      else if (trd > tld * 1.4 && bld > brd * 1.4 && md > 0.12) digit = '2';
      else if (rd > ld * 1.3 && td > 0.25 && bd > 0.25 && mrd < 0.5) digit = '3';
      else if (tld > trd * 1.1 && bld > brd * 0.75 && mrd > 0.28) digit = '5';
      else if (bd > td * 1.15 && led > 0.38 && brd > 0.25 && trd < 0.38) digit = '6';
      else if (td > bd * 1.05 && red > 0.38 && tld > 0.25 && bld < 0.38) digit = '9';
      else if (led > 0.45 && red > 0.45 && trd2 > 0.25 && brd2 > 0.25 && density < 0.45) digit = '0';
      else if (density > 0.38 && led > 0.38 && red > 0.38) digit = '8';
      else if (density < 0.22) digit = '7';
      else if (density > 0.42) digit = '8';
      else digit = null;

      if (!digit) return null;
      digits.push(digit);
    }

    const result = digits.join("");
    logger.info({ result }, "MSB OCR: pixel-based result");
    return /^\d{4}$/.test(result) ? result : null;
  } catch (err) {
    logger.debug({ err }, "MSB OCR: pixel-based error");
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function recognizeMsbCaptcha(
  imageBuffer: Buffer,
): Promise<string | null> {
  try {
    const sess = await getSession();

    // Strategy 1: Per-digit ONNX (best approach — 1 digit per inference)
    if (sess) {
      const perDigitResult = await recognizePerDigit(imageBuffer, sess);
      if (perDigitResult && /^\d{4}$/.test(perDigitResult)) {
        logger.info({ result: perDigitResult, strategy: "per-digit-onnx" }, "MSB captcha recognized");
        return perDigitResult;
      }
    }

    // Strategy 2: Full image ONNX (original approach)
    if (sess) {
      const fullResult = await recognizeFullImage(imageBuffer, sess);
      if (fullResult && /^\d{4}$/.test(fullResult)) {
        logger.info({ result: fullResult, strategy: "full-image-onnx" }, "MSB captcha recognized");
        return fullResult;
      }
    }

    // Strategy 3: Pixel-based structural recognition
    const pixelResult = await pixelBasedOcr(imageBuffer);
    if (pixelResult && /^\d{4}$/.test(pixelResult)) {
      logger.info({ result: pixelResult, strategy: "pixel-based" }, "MSB captcha recognized");
      return pixelResult;
    }

    // Strategy 4: Best-effort — combine partial results from all methods
    const partials: string[] = [];
    if (sess) {
      try {
        const raw = await (sharp(imageBuffer).extractChannel('green') as any)
          .resize(160, 50, { fit: 'fill' }).raw().toBuffer();
        const texts = await runOnnx(sess, raw as Buffer, 160, 50);
        for (const t of texts) partials.push(t.replace(/[^0-9]/g, ""));
      } catch { /* ignore */ }
    }
    if (pixelResult) partials.push(pixelResult.replace(/[^0-9]/g, ""));

    const bestPartial = partials.sort((a, b) => b.length - a.length)[0] ?? "";
    if (bestPartial.length >= 3) {
      const padded = (bestPartial + "0000").slice(0, 4);
      logger.warn({ bestPartial, padded }, "MSB OCR: best-effort padded result (≥3 digits)");
      return padded;
    }

    logger.warn({ partials }, "MSB captcha OCR: all strategies failed");
    return null;
  } catch (err) {
    logger.error({ err }, "MSB captcha OCR error");
    return null;
  }
}
