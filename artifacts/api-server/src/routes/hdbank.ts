import { Router, type Request, type Response } from "express";
import { hdBankService } from "../telegram/hdBankService.js";
import { getCredential, setCredentials } from "../lib/bankCredStore.js";
import { requireAdmin } from "../lib/security.js";

const router = Router();


// All bank admin routes require admin auth
router.use(requireAdmin);

router.get("/status", (_req: Request, res: Response) => {
  const status = hdBankService.getStatus();
  const username = getCredential("hdbank_username");
  const accountNumber = getCredential("hdbank_account_number");
  res.json({
    success: true,
    loggedIn: status.loggedIn,
    running: status.running,
    username: username || null,
    accountNumber: accountNumber || null,
    lastError: status.lastError || null,
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
      hdbank_username: username,
      hdbank_password: password,
      ...(accountNumber ? { hdbank_account_number: accountNumber } : {}),
    });

    const result = await hdBankService.restart();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  hdBankService.stop();
  res.json({ success: true });
});

router.post("/start", async (_req: Request, res: Response) => {
  try {
    await hdBankService.start();
    res.json({ success: true, message: "HD Bank monitor đã khởi động" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/stop", (_req: Request, res: Response) => {
  hdBankService.stop();
  res.json({ success: true, message: "HD Bank monitor đã dừng" });
});

export default router;
