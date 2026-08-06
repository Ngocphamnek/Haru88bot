import { logger } from "./logger";

const QR_FETCH_TIMEOUT_MS = 7000;

/**
 * Fetches a clean QR-only image from VietQR (no logo overlay).
 * Throws if VietQR doesn't respond within QR_FETCH_TIMEOUT_MS.
 */
export async function generateBankQR(
  bankCode: string,
  accountNumber: string,
  amount: number,
  addInfo: string,
  accountName: string,
): Promise<Buffer> {
  const url =
    `https://img.vietqr.io/image/${bankCode}-${accountNumber}-qr_only.png` +
    `?amount=${amount}` +
    `&addInfo=${encodeURIComponent(addInfo)}` +
    `&accountName=${encodeURIComponent(accountName)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`VietQR responded ${response.status}`);
  }

  const qrBuf = Buffer.from(await response.arrayBuffer());
  logger.debug({ bankCode, accountNumber, amount }, "🖼️ QR generated");
  return qrBuf;
}
