import { Router } from "express";
import { db } from "@workspace/db";
import {
  webUsersTable,
  botUsersTable,
  transactionsTable,
  cardSubmissionsTable,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { getWebUser } from "./webAuth";
import { getSetting } from "../lib/settings";
import { balanceSyncService } from "../lib/balanceSyncService";
import { randomBytes } from "crypto";

const router = Router();

router.get("/web/wallet", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }

    let balance = "0";
    let telegramBalance = null as string | null;

    if (user.telegramId) {
      const [botUser] = await db
        .select()
        .from(botUsersTable)
        .where(eq(botUsersTable.id, user.telegramId))
        .limit(1);
      if (botUser) {
        balance = botUser.balance;
        telegramBalance = botUser.balance;
      }
    }

    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, user.telegramId ?? String(user.id)))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(20);

    res.json({ balance, telegramBalance, transactions });
  } catch (err) {
    req.log.error({ err }, "web/wallet error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.get("/web/wallet/balance", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) { res.status(401).json({ error: "Chưa đăng nhập" }); return; }
    let balance = "0";
    if (user.telegramId) {
      const [botUser] = await db.select().from(botUsersTable).where(eq(botUsersTable.id, user.telegramId)).limit(1);
      if (botUser) balance = botUser.balance;
    }
    res.json({ balance });
  } catch (err) {
    req.log.error({ err }, "web/wallet/balance error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.get("/web/wallet/bank-info", async (req, res) => {
  try {
    const bankAccountNumber = await getSetting("bank_account_number");
    const bankAccountName = await getSetting("bank_account_name");
    const bankName = await getSetting("bank_name");
    const bankBin = await getSetting("bank_bin");
    res.json({ bankAccountNumber, bankAccountName, bankName, bankBin });
  } catch (err) {
    req.log.error({ err }, "web/wallet/bank-info error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.post("/web/wallet/deposit/card", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }
    if (!user.telegramId) {
      res.status(400).json({ error: "Cần liên kết Telegram trước khi nạp thẻ" });
      return;
    }

    const { telco, code, serial, amount } = req.body as {
      telco?: string;
      code?: string;
      serial?: string;
      amount?: number;
    };

    if (!telco || !code || !serial || !amount) {
      res.status(400).json({ error: "Thiếu thông tin thẻ" });
      return;
    }

    const tsrApiKey = await getSetting("tsr_api_key");
    const tsrPartnerId = await getSetting("tsr_partner_id");

    if (!tsrApiKey || !tsrPartnerId) {
      res.status(503).json({ error: "Chức năng nạp thẻ chưa được cấu hình" });
      return;
    }

    const requestId = randomBytes(8).toString("hex");
    await db.insert(cardSubmissionsTable).values({
      requestId,
      userId: user.telegramId,
      telco,
      code,
      serial,
      declaredAmount: amount,
      chatId: user.telegramId,
    });

    const tsrRes = await fetch("https://thesieure.com/chargingws/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telco, code, serial, amount, request_id: requestId, partner_id: tsrPartnerId, sign: "" }),
    });
    const tsrData = await tsrRes.json();

    res.json({ ok: true, requestId, tsrStatus: tsrData });
  } catch (err) {
    req.log.error({ err }, "web/wallet/deposit/card error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── SSE: real-time balance stream ────────────────────────────────────────────
// Web clients connect here; bot balance changes push events automatically.
// Auth via ?token=<JWT> query param (EventSource cannot set headers).
router.get("/web/wallet/sse", async (req, res) => {
  const token = (req.query["token"] as string) ?? "";
  // Reuse getWebUser but inject the token via Authorization
  const fakeReq = { ...req, headers: { ...req.headers, authorization: `Bearer ${token}` } } as import("express").Request;
  const user = await getWebUser(fakeReq);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send current balance immediately on connect
  const userId = user.telegramId ?? String(user.id);
  let initialBalance = "0";
  if (user.telegramId) {
    const [botUser] = await db.select().from(botUsersTable).where(eq(botUsersTable.id, user.telegramId)).limit(1);
    if (botUser) initialBalance = botUser.balance;
  }
  res.write(`event: balance_update\ndata: ${JSON.stringify({ balance: initialBalance, ts: Date.now() })}\n\n`);

  // Heartbeat every 25 s to keep connection alive through proxies
  const hb = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { cleanup(); }
  }, 25_000);

  const cleanup = balanceSyncService.register(userId, res);

  req.on("close", () => {
    clearInterval(hb);
    cleanup();
  });
});

// ─── Atomic web-game bet ──────────────────────────────────────────────────────
// Called by all web mini-games. Deducts amount from DB, applies multiplier,
// returns { ok, payout, newBalance }. Never trusts client balance.
router.post("/web/game/bet", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) { res.status(401).json({ error: "Chưa đăng nhập" }); return; }

    if (!user.telegramId) {
      res.status(400).json({ error: "Cần liên kết Telegram để chơi" });
      return;
    }

    const { amount, winMultiplier, game } = req.body as {
      amount?: number;
      winMultiplier?: number;
      game?: string;
    };

    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      res.status(400).json({ error: "Số tiền không hợp lệ" }); return;
    }
    if (winMultiplier === undefined || !Number.isFinite(winMultiplier) || winMultiplier < 0) {
      res.status(400).json({ error: "Multiplier không hợp lệ" }); return;
    }
    // Sanity cap: no single web game bet can return more than 1000x
    if (winMultiplier > 1000) {
      res.status(400).json({ error: "Multiplier quá lớn" }); return;
    }

    // Read current balance from DB (authoritative source)
    const [botUser] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.id, user.telegramId))
      .limit(1);

    if (!botUser) {
      res.status(404).json({ error: "Tài khoản Telegram chưa tồn tại" }); return;
    }

    const payout = Math.floor(amount * winMultiplier);

    // Atomic check-and-update — single SQL statement.
    // If balance < amount the WHERE fails → 0 rows returned → no double-deduct race.
    const betResult = await db.execute(sql`
      UPDATE bot_users
      SET balance    = ROUND(CAST(balance AS NUMERIC) - ${amount} + ${payout}, 0)::TEXT,
          updated_at = NOW()
      WHERE id        = ${user.telegramId}
        AND CAST(balance AS NUMERIC) >= ${amount}
      RETURNING balance
    `);

    if (!betResult.rows?.length) {
      // Re-fetch to distinguish "user missing" from "insufficient balance"
      const [refreshed] = await db
        .select({ balance: botUsersTable.balance })
        .from(botUsersTable)
        .where(eq(botUsersTable.id, user.telegramId))
        .limit(1);
      if (!refreshed) {
        res.status(404).json({ error: "Tài khoản không tồn tại" });
        return;
      }
      const cur = Math.floor(parseFloat(refreshed.balance ?? "0"));
      res.status(400).json({ error: `Số dư không đủ (hiện có ${cur.toLocaleString("vi-VN")}đ)` });
      return;
    }

    const newBal = (betResult.rows[0] as { balance: string }).balance;

    // Invalidate Redis balance cache after mutation
    try {
      const { invalidateUserCache } = await import("../lib/cache.js");
      await invalidateUserCache(user.telegramId);
    } catch { /* ignore */ }

    // Push real-time balance to any connected web SSE clients
    balanceSyncService.push(user.telegramId, newBal);

    req.log.info({
      userId: user.telegramId,
      game: game ?? "unknown",
      amount,
      winMultiplier,
      payout,
      newBalance: newBal,
    }, "web game bet settled");

    res.json({ ok: true, payout, newBalance: newBal });
  } catch (err) {
    req.log.error({ err }, "web/game/bet error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
