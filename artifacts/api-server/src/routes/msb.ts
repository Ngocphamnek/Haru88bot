import { Router, type Request, type Response } from "express";
import { msbService } from "../telegram/msbService.js";
import { setCredentials } from "../lib/bankCredStore.js";
import { db } from "@workspace/db";
import { bankTransactionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import * as xlsx from "xlsx";
import { requireAdmin } from "../lib/security.js";

const router = Router();


// All bank admin routes require admin auth
router.use(requireAdmin);

// ── Status ───────────────────────────────────────────────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  res.json({ success: true, ...msbService.getStatus() });
});

// ── Lấy trang đăng nhập + captcha image (base64) ─────────────────────────────
router.get("/captcha", async (_req: Request, res: Response) => {
  try {
    const { captchaBase64, captchaContentType } = await msbService.fetchLoginPage();
    res.json({ success: true, captchaBase64, captchaContentType });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Không lấy được captcha: ${err.message}` });
  }
});

// ── Làm mới captcha (không load lại trang) ───────────────────────────────────
router.post("/captcha/refresh", async (_req: Request, res: Response) => {
  try {
    const { captchaBase64, captchaContentType } = await msbService.refreshCaptcha();
    res.json({ success: true, captchaBase64, captchaContentType });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── OCR tự động giải captcha hiện tại ────────────────────────────────────────
router.post("/captcha/solve", async (_req: Request, res: Response) => {
  try {
    const result = await msbService.solveCaptcha();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Đăng nhập trực tiếp với username/password/captcha ────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const { username, password, captchaCode, accountNumber } = req.body;
  if (!username || !password || !captchaCode) {
    res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ: tên đăng nhập, mật khẩu và mã xác nhận" });
    return;
  }
  try {
    const result = await msbService.login(username, password, captchaCode, accountNumber);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Set session từ browser cookie (giữ để backwards-compat) ──────────────────
// ── Load captcha từ browser cookies (bypass F5 WAF) ─────────────────────────
router.post("/captcha/browser-session", async (req: Request, res: Response) => {
  const { cookieString, loginUrl } = req.body;
  if (!cookieString || typeof cookieString !== "string") {
    res.status(400).json({ success: false, message: "Vui lòng dán cookies từ browser" });
    return;
  }
  try {
    const result = await msbService.fetchLoginPageWithBrowserCookies(cookieString.trim(), loginUrl?.trim());
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/set-session", (req: Request, res: Response) => {
  const { jsessionId, dseSessionId, accountNumber } = req.body;
  if (!jsessionId) {
    res.status(400).json({ success: false, message: "Vui lòng nhập JSESSIONID" });
    return;
  }
  const result = msbService.setSession(jsessionId, dseSessionId || "", accountNumber);
  if (result.success && accountNumber) {
    setCredentials({ msb_account_number: accountNumber });
  }
  res.json(result);
});

// ── Tự động đăng nhập (OCR captcha giống MB Bank) ────────────────────────────
router.post("/auto-login", async (req: Request, res: Response) => {
  const { username, password, accountNumber } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, message: "Vui lòng nhập tên đăng nhập và mật khẩu" });
    return;
  }
  try {
    // Lưu credentials và bật auto mode
    const { setCredentials } = await import("../lib/bankCredStore.js");
    setCredentials({
      msb_username: username,
      msb_password: password,
      msb_auto_mode: "1",
      ...(accountNumber ? { msb_account_number: accountNumber } : {}),
    });

    // Chạy auto-login và trả về kết quả ngay (không async-fire-and-forget)
    const result = await msbService.autoLogin(username, password, accountNumber);
    res.json({ ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, attempts: 0 });
  }
});

// ── Import session từ browser đã đăng nhập (không cần captcha) ──────────────
router.post("/import-session", async (req: Request, res: Response) => {
  const { cookieString, accountNumber } = req.body;
  if (!cookieString || typeof cookieString !== "string") {
    res.status(400).json({ success: false, message: "Vui lòng dán Cookie header từ browser" });
    return;
  }
  try {
    const result = await msbService.importBrowserSession(cookieString.trim(), accountNumber?.trim());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Đăng xuất ────────────────────────────────────────────────────────────────
router.post("/logout", (_req: Request, res: Response) => {
  msbService.logout();
  res.json({ success: true });
});

// ── Bật monitor ──────────────────────────────────────────────────────────────
router.post("/start", async (_req: Request, res: Response) => {
  try {
    await msbService.start();
    res.json({ success: true, message: "MSB Bank monitor đã khởi động" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Tắt monitor ──────────────────────────────────────────────────────────────
router.post("/stop", (_req: Request, res: Response) => {
  msbService.stop();
  res.json({ success: true, message: "MSB Bank monitor đã dừng" });
});

// ── Lịch sử giao dịch MSB từ DB ──────────────────────────────────────────────
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const rows = await db
      .select()
      .from(bankTransactionsTable)
      .orderBy(desc(bankTransactionsTable.createdAt))
      .limit(limit);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Chuyển khoản đơn ─────────────────────────────────────────────────────────
router.post("/transfer", async (req: Request, res: Response) => {
  const { fromAccount, toAccount, toName, amount, description, type, bankCode } = req.body;
  if (!fromAccount || !toAccount || !toName || !amount || !description || !type) {
    res.status(400).json({ success: false, message: "Thiếu thông tin chuyển khoản" });
    return;
  }
  try {
    const result = await msbService.transfer({
      fromAccount: String(fromAccount),
      toAccount: String(toAccount),
      toName: String(toName),
      amount: Number(amount),
      description: String(description),
      type: type === "interbank" ? "interbank" : "internal",
      bankCode: bankCode ? String(bankCode) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Xác nhận OTP chuyển khoản ─────────────────────────────────────────────────
router.post("/transfer/confirm-otp", async (req: Request, res: Response) => {
  const { otpCode, transactionId } = req.body;
  if (!otpCode) {
    res.status(400).json({ success: false, message: "Vui lòng nhập mã OTP" });
    return;
  }
  try {
    const result = await msbService.confirmTransferOTP(String(otpCode), transactionId ? String(transactionId) : undefined);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Parse file XLS chuyển khoản theo lô ──────────────────────────────────────
router.post("/transfer/parse-xls", async (req: Request, res: Response) => {
  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) {
      res.status(400).json({ success: false, message: "Thiếu dữ liệu file" });
      return;
    }
    const buf = Buffer.from(fileBase64, "base64");
    const wb = xlsx.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0]!;
    const ws = wb.Sheets[sheetName]!;
    const rows: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });

    // Skip header row, parse data rows
    const transfers = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const stt = row[0];
      if (!stt || stt === "") continue;
      const typeRaw = String(row[1] || "").toLowerCase();
      const type = typeRaw.includes("liên ngân hàng") || typeRaw.includes("2.") ? "interbank" : "internal";
      transfers.push({
        stt: String(stt),
        type,
        fromAccount: String(row[2] || ""),
        toAccount: String(row[3] || ""),
        toName: String(row[4] || ""),
        bankCode: String(row[5] || ""),
        amount: Number(String(row[6] || "0").replace(/[^0-9]/g, "")),
        description: String(row[7] || ""),
        status: "pending",
        message: "",
      });
    }
    res.json({ success: true, data: transfers, total: transfers.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Không đọc được file: ${err.message}` });
  }
});

// ── Danh sách tài khoản và số dư ─────────────────────────────────────────────
// ?refresh=1 → bắt buộc crawl lại MSB để lấy số dư mới nhất
// Mặc định: trả về cached ngay lập tức, đồng thời trigger refresh nền
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query["refresh"] === "1";
    let accounts;
    if (forceRefresh) {
      accounts = await msbService.fetchAccounts();
    } else {
      // Trả về cache ngay (nhanh), trigger refresh nền nếu chưa đang fetch
      accounts = msbService.getCachedAccounts();
      // Refresh nền không block response
      msbService.fetchAccounts().catch(() => {});
    }
    const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
    res.json({ success: true, data: accounts, totalBalance });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Trigger poll thủ công ─────────────────────────────────────────────────────
router.post("/poll", async (_req: Request, res: Response) => {
  try {
    await msbService.poll();
    res.json({ success: true, message: "Poll MSB Bank hoàn thành" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG ENDPOINTS — Xem HTML thật từ MSB để kiểm tra/viết parser đúng
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/msb/debug/login-page
 * Bước qua toàn bộ redirect chain của /IBSRetail/ và trả về HTML thật
 * tại MỖI hop. Không cần session — tạo session mới từ đầu.
 *
 * Dùng để:
 *  - Xác minh tên field (_userName, _msbPassword, _verifyCode, v.v.)
 *  - Kiểm tra redirect chain (số bước JS redirect)
 *  - Xem hidden fields thực tế trong form login
 */
router.get("/debug/login-page", async (_req: Request, res: Response) => {
  try {
    const result = await msbService.debugLoginPage();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/msb/debug/dashboard
 * Dùng session hiện tại, thử các operationName khác nhau và trả về HTML thô.
 *
 * Cần đăng nhập trước. Dùng để:
 *  - Xem HTML dashboard sau khi login (có tài khoản nào không?)
 *  - Tìm đúng operationName + pageId cho account list
 *  - Kiểm tra parser parseAccountsFromHtml có extract đúng không
 */
router.get("/debug/dashboard", async (_req: Request, res: Response) => {
  try {
    const result = await msbService.debugDashboard();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/msb/debug/transactions?account=xxx[&pageIds=3,4,5,10]
 * POST retailAccountHistoryProc với nhiều dse_pageId khác nhau,
 * trả về HTML thô từ mỗi attempt.
 *
 * Cần đăng nhập trước. Dùng để:
 *  - Tìm đúng dse_pageId cho transaction history
 *  - Xem HTML thật để viết parser chính xác
 *  - Kiểm tra parseTransactionsFromHtml có đọc đúng không
 *
 * Ví dụ: GET /api/msb/debug/transactions?account=0909123456&pageIds=3,10,15
 */
router.get("/debug/transactions", async (req: Request, res: Response) => {
  const accountNumber = req.query["account"] as string;
  if (!accountNumber) {
    res.status(400).json({ success: false, message: "Cần truyền ?account=SỐ_TÀI_KHOẢN" });
    return;
  }
  const pageIdsParam = req.query["pageIds"] as string | undefined;
  const pageIds = pageIdsParam
    ? pageIdsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
    : undefined;

  try {
    const result = await msbService.debugTransactions(accountNumber, pageIds);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
