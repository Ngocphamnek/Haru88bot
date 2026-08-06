import { Router, type Request, type Response } from "express";
import { supportBotService } from "../telegram/supportBot";
import { requireAdmin } from "./admin";

const router = Router();

// Get all support requests (pending + active)
router.get("/requests", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const requests = supportBotService.getAllRequests().map(r => ({
      userId: r.userId,
      username: r.username,
      firstName: r.firstName,
      content: r.content,
      status: r.status,
      requestedAt: new Date(r.requestedAt).toISOString(),
      isConnected: supportBotService.isConnected(r.userId)
    }));
    res.json(requests);
  } catch {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Connect admin to player
router.post("/connect/:userId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await supportBotService.adminConnect(userId);
  res.json({ success: result.ok, message: result.message });
});

// Disconnect admin from player
router.post("/disconnect/:userId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await supportBotService.adminDisconnect(userId);
  res.json({ success: result.ok, message: result.message });
});

// Reject support request
router.post("/reject/:userId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await supportBotService.adminReject(userId);
  res.json({ success: result.ok, message: result.message });
});

export default router;
