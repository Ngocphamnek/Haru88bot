import { Router, type Request, type Response } from "express";
import { msbDigiBankService } from "../telegram/msbDigiBankService.js";
import { requireAdmin } from "../lib/security.js";

const router = Router();


// All bank admin routes require admin auth
router.use(requireAdmin);

// ── Status ────────────────────────────────────────────────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  res.json({ success: true, ...msbDigiBankService.getStatus() });
});

// ── Đăng nhập (OAuth2 PKCE flow) ──────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { username, password, accountNumber } = req.body as Record<string, string>;
  if (!username || !password) {
    res.status(400).json({ success: false, message: "Vui lòng nhập tên đăng nhập và mật khẩu" });
    return;
  }

  const messages: string[] = [];
  const result = await msbDigiBankService.login(username, password, (msg) => messages.push(msg));

  if (result.success && accountNumber) {
    msbDigiBankService.setAccountNumber(accountNumber);
  }

  res.json({ ...result, log: messages });
});

// ── Đăng xuất ────────────────────────────────────────────────────────────────
router.post("/logout", (_req: Request, res: Response) => {
  msbDigiBankService.logout();
  res.json({ success: true, message: "Đã đăng xuất MSB DigiBank" });
});

// ── Cài tài khoản ─────────────────────────────────────────────────────────────
router.post("/set-account", (req: Request, res: Response) => {
  const { accountNumber } = req.body as Record<string, string>;
  if (!accountNumber) {
    res.status(400).json({ success: false, message: "Vui lòng nhập số tài khoản" });
    return;
  }
  msbDigiBankService.setAccountNumber(accountNumber);
  res.json({ success: true, message: `Đã cài tài khoản: ${accountNumber}` });
});

// ── Lấy lịch sử giao dịch ────────────────────────────────────────────────────
router.get("/transactions", async (req: Request, res: Response) => {
  const { accountNumber, fromDate, toDate } = req.query as Record<string, string>;
  const result = await msbDigiBankService.getTransactions(accountNumber, fromDate, toDate);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// ── Poll thủ công ─────────────────────────────────────────────────────────────
router.post("/poll", async (_req: Request, res: Response) => {
  try {
    await msbDigiBankService.poll();
    res.json({ success: true, message: "Poll MSB DigiBank hoàn thành" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Bật monitor tự động ───────────────────────────────────────────────────────
router.post("/start", async (_req: Request, res: Response) => {
  try {
    await msbDigiBankService.start();
    res.json({ success: true, message: "MSB DigiBank monitor đã khởi động" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Dừng monitor ──────────────────────────────────────────────────────────────
router.post("/stop", (_req: Request, res: Response) => {
  msbDigiBankService.stop();
  res.json({ success: true, message: "MSB DigiBank monitor đã dừng" });
});

export default router;
