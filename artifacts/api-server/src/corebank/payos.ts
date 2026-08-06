/**
 * PayOS Payment Service
 *
 * Tích hợp PayOS API để tạo link thanh toán và xác thực webhook.
 * Docs: https://payos.vn/docs
 */

import { createHmac } from "node:crypto";
import { getSettings } from "./settings.js";

const PAYOS_API = "https://api-merchant.payos.vn";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaymentLink {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
}

export interface CreatePaymentParams {
  amount: number;
  description: string;
  orderCode?: number;
  cancelUrl?: string;
  returnUrl?: string;
  expiredAt?: number;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
}

export interface PayOSWebhookData {
  orderCode: number;
  amount: number;
  description: string;
  accountNumber: string;
  reference: string;
  transactionDateTime: string;
  currency: string;
  paymentLinkId: string;
  code: string;
  desc: string;
  counterAccountBankId?: string;
  counterAccountBankName?: string;
  counterAccountName?: string;
  counterAccountNumber?: string;
  virtualAccountName?: string;
  virtualAccountNumber?: string;
}

// ─── Signature ───────────────────────────────────────────────────────────────

/**
 * Tạo HMAC_SHA256 signature từ object data (sort theo alphabet key).
 */
function createSignature(data: Record<string, unknown>, checksumKey: string): string {
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys.map(k => `${k}=${data[k]}`).join("&");
  return createHmac("sha256", checksumKey).update(queryString).digest("hex");
}

/**
 * Xác thực chữ ký webhook từ PayOS.
 * @returns true nếu chữ ký hợp lệ
 */
export function verifyWebhookSignature(
  data: Record<string, unknown>,
  receivedSignature: string
): boolean {
  const settings = getSettings();
  const checksumKey = settings.payos?.checksumKey;
  if (!checksumKey) {
    console.warn("PayOS checksumKey not configured — skip signature verification");
    return false;
  }

  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys.map(k => `${k}=${data[k]}`).join("&");
  const expected = createHmac("sha256", checksumKey).update(queryString).digest("hex");
  return expected === receivedSignature;
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Tạo link thanh toán PayOS.
 */
export async function createPaymentLink(
  params: CreatePaymentParams
): Promise<{ success: boolean; data?: PaymentLink; message?: string; orderCode?: number }> {
  const settings = getSettings();
  const payos = settings.payos;

  if (!payos?.enabled) {
    return { success: false, message: "PayOS chưa được kích hoạt trong Settings" };
  }
  if (!payos.clientId || !payos.apiKey || !payos.checksumKey) {
    return { success: false, message: "Thiếu cấu hình PayOS (clientId, apiKey, checksumKey)" };
  }

  const cancelUrl = params.cancelUrl || payos.cancelUrl || "https://payos.vn";
  const returnUrl = params.returnUrl || payos.returnUrl || "https://payos.vn";
  const orderCode = params.orderCode ?? (Date.now() % 2_147_483_647);

  // Signature theo spec PayOS: sort alphabet
  const sigData: Record<string, unknown> = {
    amount: params.amount,
    cancelUrl,
    description: params.description,
    orderCode,
    returnUrl,
  };
  const signature = createSignature(sigData, payos.checksumKey);

  const body: Record<string, unknown> = {
    orderCode,
    amount: params.amount,
    description: params.description,
    cancelUrl,
    returnUrl,
    signature,
  };

  if (params.expiredAt) body.expiredAt = params.expiredAt;
  if (params.buyerName) body.buyerName = params.buyerName;
  if (params.buyerPhone) body.buyerPhone = params.buyerPhone;
  if (params.buyerEmail) body.buyerEmail = params.buyerEmail;

  try {
    const res = await fetch(`${PAYOS_API}/v2/payment-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": payos.clientId,
        "x-api-key": payos.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await res.json()) as any;
    console.log(`📦 PayOS createPayment response: code=${json.code}`);

    if (json.code === "00" && json.data) {
      return { success: true, data: json.data, orderCode };
    }

    return { success: false, message: json.desc || "PayOS API error", orderCode };
  } catch (err: any) {
    return { success: false, message: `PayOS request failed: ${err.message}`, orderCode };
  }
}

/**
 * Lấy thông tin link thanh toán theo orderCode hoặc paymentLinkId.
 */
export async function getPaymentInfo(id: number | string): Promise<any> {
  const settings = getSettings();
  const payos = settings.payos;

  if (!payos?.clientId || !payos?.apiKey) return null;

  try {
    const res = await fetch(`${PAYOS_API}/v2/payment-requests/${id}`, {
      headers: {
        "x-client-id": payos.clientId,
        "x-api-key": payos.apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as any;
    return json.code === "00" ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Huỷ link thanh toán.
 */
export async function cancelPaymentLink(
  orderCode: number,
  reason = "Cancelled"
): Promise<{ success: boolean; message?: string }> {
  const settings = getSettings();
  const payos = settings.payos;

  if (!payos?.clientId || !payos?.apiKey) {
    return { success: false, message: "PayOS not configured" };
  }

  try {
    const res = await fetch(`${PAYOS_API}/v2/payment-requests/${orderCode}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": payos.clientId,
        "x-api-key": payos.apiKey,
      },
      body: JSON.stringify({ cancellationReason: reason }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as any;
    return { success: json.code === "00", message: json.desc };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Xác thực và đăng ký webhook URL với PayOS.
 */
export async function confirmWebhookUrl(webhookUrl: string): Promise<{ success: boolean; message?: string; data?: any }> {
  const settings = getSettings();
  const payos = settings.payos;

  if (!payos?.clientId || !payos?.apiKey) {
    return { success: false, message: "PayOS not configured" };
  }

  try {
    const res = await fetch(`${PAYOS_API}/confirm-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": payos.clientId,
        "x-api-key": payos.apiKey,
      },
      body: JSON.stringify({ webhookUrl }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as any;
    return { success: json.code === "00", message: json.desc, data: json.data };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
