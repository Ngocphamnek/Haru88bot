import { Router, type Request, type Response } from "express";
import { CoreBankService } from "../corebank/core-bank.js";
import { warmup } from "../corebank/wasm-engine.js";
import { getSettings, saveSettings } from "../corebank/settings.js";
import { triggerTestNotification } from "../corebank/notifier.js";
import { TransactionMonitor } from "../corebank/monitor.js";
import { pendingDepositService } from "../corebank/pending-deposits.js";
import {
  createPaymentLink,
  verifyWebhookSignature,
  cancelPaymentLink,
  getPaymentInfo,
  confirmWebhookUrl,
} from "../corebank/payos.js";
import { requireAdmin } from "../lib/security.js";

const router = Router();

// Tất cả các route /corebank/* yêu cầu xác thực admin (trừ webhook PayOS)
router.use((req, res, next) => {
  // PayOS webhook không dùng admin token — dùng signature riêng
  if (req.path === "/payment/webhook") return next();
  requireAdmin(req, res, next);
});
export const coreBankService = new CoreBankService();
const txMonitor = new TransactionMonitor(coreBankService);

interface PendingPayment {
  callbackUrl: string;
  secret?: string;
  amount: number;
  description: string;
  createdAt: number;
  checkoutUrl: string;
  qrCode: string;
  paymentLinkId: string;
}
const pendingPayments = new Map<number, PendingPayment>();

router.get("/status", (req: Request, res: Response) => {
  const session = coreBankService.getSession();
  const base = "/api/corebank";
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const publicApiUrl = replitDomain
    ? `https://${replitDomain}${base}`
    : `${req.protocol}://${req.get("host")}${base}`;

  res.json({
    status: "ok",
    loggedIn: !!session?.sessionId,
    username: session?.username || null,
    sessionAge: session ? Math.floor((Date.now() - session.createdAt) / 1000) : null,
    publicApiUrl,
    pendingDeposits: pendingDepositService.size,
    monitorRunning: txMonitor.isRunning(),
  });
});

router.post("/warmup", async (_req: Request, res: Response) => {
  try {
    await warmup();
    res.json({ success: true, message: "WASM engine ready" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/captcha", async (_req: Request, res: Response) => {
  try {
    const captcha = await coreBankService.getCaptcha();
    res.json({ success: true, ...captcha });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, message: "Missing username or password" });
      return;
    }
    const result = await coreBankService.autoLogin(username, password);

    // Auto-start transaction monitor after successful login (no third-party needed)
    if (result.success) {
      txMonitor.start();
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  txMonitor.stop();
  coreBankService.logout();
  // Persist monitor as stopped
  const s = getSettings();
  s.monitor.running = false;
  saveSettings(s);
  res.json({ success: true });
});

router.post("/balance", async (_req: Request, res: Response) => {
  try {
    const balance = await coreBankService.getBalance();
    res.json({ success: true, data: balance });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/transactions", async (req: Request, res: Response) => {
  try {
    const { accountNumber, fromDate, toDate } = req.body;
    if (!accountNumber || !fromDate || !toDate) {
      res.status(400).json({ success: false, message: "Missing accountNumber, fromDate, or toDate" });
      return;
    }
    const transactions = await coreBankService.getTransactions(accountNumber, fromDate, toDate);
    res.json({ success: true, data: transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/settings", (_req: Request, res: Response) => {
  const settings = getSettings();
  const safe = { ...settings };
  res.json({ success: true, data: safe });
});

router.post("/settings", (req: Request, res: Response) => {
  try {
    saveSettings(req.body);
    const s = getSettings();
    if (s.monitor.running) txMonitor.start();
    else txMonitor.stop();
    res.json({ success: true, message: "Settings saved" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/monitor/test", async (_req: Request, res: Response) => {
  try {
    const result = await triggerTestNotification();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/pending-deposit", (req: Request, res: Response) => {
  const { code, amount, callbackUrl, secret } = req.body;
  if (!code || !amount || !callbackUrl) {
    res.status(400).json({ success: false, message: "Missing code, amount, or callbackUrl" });
    return;
  }
  pendingDepositService.register(String(code), Number(amount), String(callbackUrl), secret);
  res.json({ success: true, message: `Pending deposit registered: ${code}` });
});

router.get("/pending-deposit", (_req: Request, res: Response) => {
  res.json({ success: true, data: pendingDepositService.list(), total: pendingDepositService.size });
});

router.post("/payment/create", async (req: Request, res: Response) => {
  const { amount, description, callbackUrl, secret, expiredAt, buyerName, buyerPhone } = req.body;
  if (!amount || !description || !callbackUrl) {
    res.status(400).json({ success: false, message: "Thiếu amount, description hoặc callbackUrl" });
    return;
  }
  const result = await createPaymentLink({ amount: Number(amount), description: String(description), expiredAt, buyerName, buyerPhone });
  if (result.success && result.data) {
    pendingPayments.set(result.data.orderCode, {
      callbackUrl: String(callbackUrl),
      secret,
      amount: Number(amount),
      description: String(description),
      createdAt: Date.now(),
      checkoutUrl: result.data.checkoutUrl,
      qrCode: result.data.qrCode,
      paymentLinkId: result.data.paymentLinkId,
    });
    res.json({ success: true, data: result.data });
  } else {
    res.status(500).json({ success: false, message: result.message });
  }
});

router.post("/payment/webhook", async (req: Request, res: Response) => {
  const { data, signature, code, success: isSuccess } = req.body;
  if (!data || !signature) { res.status(400).json({ success: false, message: "Missing data or signature" }); return; }
  if (!verifyWebhookSignature(data, signature)) { res.status(400).json({ success: false, message: "Invalid signature" }); return; }
  res.json({ success: true });

  const orderCode = data.orderCode as number | undefined;
  if (code === "00" && isSuccess && orderCode) {
    const pending = pendingPayments.get(orderCode);
    if (pending) {
      pendingPayments.delete(orderCode);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (pending.secret) headers["X-Webhook-Secret"] = pending.secret;
        await fetch(pending.callbackUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ status: "success", orderCode, amount: data.amount, description: data.description, transactionDateTime: data.transactionDateTime, reference: data.reference, accountNumber: data.accountNumber }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err: any) {
        console.error(`❌ Bot callback failed: ${err.message}`);
      }
    }
  }
});

router.get("/payment/pending", (_req: Request, res: Response) => {
  const list = [...pendingPayments.entries()].map(([orderCode, p]) => ({
    orderCode, amount: p.amount, description: p.description, callbackUrl: p.callbackUrl,
    checkoutUrl: p.checkoutUrl, ageSeconds: Math.floor((Date.now() - p.createdAt) / 1000),
  }));
  res.json({ success: true, data: list, total: list.length });
});

router.delete("/payment/:orderCode", async (req: Request, res: Response) => {
  const orderCode = Number(req.params.orderCode);
  if (isNaN(orderCode)) { res.status(400).json({ success: false, message: "Invalid orderCode" }); return; }
  pendingPayments.delete(orderCode);
  const result = await cancelPaymentLink(orderCode, "Cancelled via Admin");
  res.json(result);
});

router.get("/payment/:orderCode", async (req: Request, res: Response) => {
  const info = await getPaymentInfo(req.params.orderCode as string);
  if (info) res.json({ success: true, data: info });
  else res.status(404).json({ success: false, message: "Payment not found" });
});

router.post("/payment/register-webhook", async (req: Request, res: Response) => {
  const { webhookUrl } = req.body;
  let url = webhookUrl;
  if (!url) {
    const host = req.headers.host || "localhost";
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    url = `${proto}://${host}/api/corebank/payment/webhook`;
  }
  const result = await confirmWebhookUrl(url);
  if (result.success) res.json({ success: true, webhookUrl: url, data: result.data });
  else res.status(400).json({ success: false, message: result.message });
});

export default router;
