import { Router, type Request, type Response } from "express";
import { techcombankService } from "../telegram/techcombankService.js";
import { getCredential, setCredentials } from "../lib/bankCredStore.js";
import { requireAdmin } from "../lib/security.js";

const router = Router();


// All bank admin routes require admin auth
router.use(requireAdmin);

router.get("/status", (_req: Request, res: Response) => {
  const status = techcombankService.getStatus();
  const username = getCredential("tcb_username");
  const accountNumber = getCredential("tcb_account_number");
  res.json({
    success: true,
    loggedIn: status.loggedIn,
    running: status.running,
    username: status.username || username || null,
    accountNumber: accountNumber || null,
    pendingConfirmation: status.pendingConfirmation,
  });
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password, accountNumber } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, message: "Thiếu tên đăng nhập hoặc mật khẩu" });
      return;
    }
    setCredentials({
      tcb_username: username,
      tcb_password: password,
      ...(accountNumber ? { tcb_account_number: accountNumber } : {}),
    });

    const result = await techcombankService.restart();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/cancel-pending", (_req: Request, res: Response) => {
  techcombankService.cancelPending();
  res.json({ success: true, message: "Đã huỷ xác nhận đang chờ" });
});

router.post("/logout", (_req: Request, res: Response) => {
  techcombankService.logout();
  res.json({ success: true });
});

router.post("/start", async (_req: Request, res: Response) => {
  try {
    await techcombankService.start();
    res.json({ success: true, message: "Techcombank monitor đã khởi động" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/stop", (_req: Request, res: Response) => {
  techcombankService.stop();
  res.json({ success: true, message: "Techcombank monitor đã dừng" });
});

router.get("/accounts", async (_req: Request, res: Response) => {
  try {
    const accounts = await techcombankService.getAccounts();
    res.json({ success: true, data: accounts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/debug-probe", async (_req: Request, res: Response) => {
  try {
    const results = await techcombankService.probeApiEndpoints();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/transactions", async (req: Request, res: Response) => {
  try {
    const { accountNumber, fromDate, toDate } = req.body;
    if (!accountNumber || !fromDate || !toDate) {
      res.status(400).json({ success: false, message: "Thiếu accountNumber, fromDate, toDate" });
      return;
    }
    const txs = await techcombankService.getTransactions(accountNumber, fromDate, toDate);
    res.json({ success: true, data: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
