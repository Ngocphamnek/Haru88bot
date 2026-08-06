import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGetAdminSettings, useSaveAdminSettings, useTriggerMaintenance,
  useCheckBankBalanceNow, getGetAdminSettingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Wrench, RefreshCw, LogIn, CheckCircle2, Clock, Wallet, LogOut } from "lucide-react";

// ── Helper field component ──────────────────────────────────────────────────
function Field({ label, fieldKey, formData, setFormData, type = "text", placeholder = "" }: {
  label: string; fieldKey: string;
  formData: Record<string, string>; setFormData: (d: Record<string, string>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={formData[fieldKey] || ""}
        onChange={(e) => setFormData({ ...formData, [fieldKey]: e.target.value })}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : undefined}
      />
    </div>
  );
}

// ── Mask số tài khoản: hiện 3 đầu + 4 cuối, giữa là ****
function maskAccountNumber(raw: string): string {
  if (!raw) return raw;
  const clean = raw.replace(/\s/g, "");
  if (clean.length <= 7) return "*".repeat(clean.length);
  const head = clean.slice(0, 3);
  const tail = clean.slice(-4);
  const mid = "*".repeat(Math.min(clean.length - 7, 4));
  return `${head}${mid}${tail}`;
}

// ── Accounts panel (dùng chung cho MSB, TCB, MB sau khi login) ──────────────
function AccountsPanel({ accounts, onRefresh, loading }: {
  accounts: Array<{ accountNumber: string; accountName: string; balance?: number | null; currency?: string }>;
  onRefresh: () => void;
  loading: boolean;
}) {
  if (!accounts.length) return null;
  return (
    <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold text-green-500">Đã đăng nhập — {accounts.length} tài khoản</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="space-y-2">
        {accounts.map((acc) => (
          <div key={acc.accountNumber} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border border-border/60">
            <div>
              <p className="text-sm font-mono font-semibold">{maskAccountNumber(acc.accountNumber)}</p>
              {acc.accountName && <p className="text-xs text-muted-foreground">{acc.accountName}</p>}
            </div>
            <div className="text-right">
              {acc.balance != null ? (
                <p className="text-sm font-semibold text-green-400">
                  {acc.balance.toLocaleString("vi-VN")} {acc.currency || "đ"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Không có số dư</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MB Bank section ─────────────────────────────────────────────────────────
function MBBankSection({ formData, setFormData }: { formData: Record<string, string>; setFormData: (d: Record<string, string>) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<{ loggedIn: boolean; running: boolean; accountNumber?: string | null; accountHolder?: string | null } | null>(null);
  const [accounts, setAccounts] = useState<Array<{ accountNumber: string; accountName: string; balance?: number | null; currency?: string }>>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMBAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/bank/accounts");
      const data = await res.json();
      if (data.success && data.data) {
        setAccounts(data.data);
      } else {
        setAccounts([]);
      }
    } catch {}
    finally { setAccountsLoading(false); }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bank/status");
      const data = await res.json();
      setStatus(data);
      if (data.loggedIn) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
      return data;
    } catch { return null; }
  }, []);

  // Check status on mount + always try fetching accounts + poll while not logged in
  useEffect(() => {
    checkStatus().then(data => {
      if (data && !data.loggedIn) {
        pollRef.current = setInterval(() => {
          checkStatus();
        }, 5000);
      }
    });
    // Always try to fetch accounts (external API may have active session regardless of service state)
    fetchMBAccounts();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [checkStatus, fetchMBAccounts]);

  const handleLogin = async () => {
    const username = formData["bank_username"] || "";
    const password = formData["bank_password"] || "";
    if (!username || !password) {
      toast({ variant: "destructive", title: "Vui lòng nhập tên đăng nhập và mật khẩu" });
      return;
    }
    setLoading(true);
    setAttempts(0);
    setAccounts([]);
    try {
      const saveKeys = ["bank_username", "bank_password", "bank_account_number", "bank_account_holder"];
      const settings = saveKeys.filter(k => formData[k]).map(k => ({ key: k, value: formData[k] }));
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      });

      const res = await fetch("/api/admin/bank-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.attempts) setAttempts(data.attempts);

      if (data.success) {
        toast({ title: "✅ Đăng nhập MB Bank thành công", description: data.customerName || undefined });
        await checkStatus();
      } else {
        toast({ variant: "destructive", title: "Đăng nhập thất bại", description: data.message });
        checkStatus();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi kết nối", description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 border rounded-md p-4 bg-muted/30">
      <p className="text-sm font-semibold text-muted-foreground">Thông tin đăng nhập MB Bank</p>

      {/* Live status badge */}
      {status && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${status.loggedIn ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-muted border border-border text-muted-foreground"}`}>
          {status.loggedIn
            ? <><CheckCircle2 className="h-4 w-4 shrink-0" /> <span>Đã đăng nhập{status.accountNumber ? ` — STK: ${maskAccountNumber(status.accountNumber)}` : ""}{status.accountHolder ? ` (${status.accountHolder})` : ""}</span></>
            : status.running
              ? <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> <span>Đang tự đăng nhập lại (auto-login)...</span></>
              : <><LogOut className="h-4 w-4 shrink-0" /> <span>Chưa đăng nhập</span></>
          }
        </div>
      )}

      <Field label="Tên đăng nhập" fieldKey="bank_username" formData={formData} setFormData={setFormData} placeholder="Username Internet Banking" />
      <Field label="Mật khẩu" fieldKey="bank_password" formData={formData} setFormData={setFormData} type="password" placeholder="Mật khẩu Internet Banking" />
      <Field label="Số tài khoản" fieldKey="bank_account_number" formData={formData} setFormData={setFormData} placeholder="VD: 0123456789" />
      <Field label="Tên chủ tài khoản" fieldKey="bank_account_holder" formData={formData} setFormData={setFormData} placeholder="NGUYEN VAN A" />

      <Button onClick={handleLogin} disabled={loading} variant="secondary" className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
        {loading ? "Đang giải captcha tự động..." : "Đăng nhập MB Bank"}
      </Button>

      {loading && attempts > 0 && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang thử lần {attempts}... (bypass captcha tự động)
        </p>
      )}

      {/* Tài khoản thực */}
      {accounts.length > 0 && (
        <AccountsPanel accounts={accounts} onRefresh={fetchMBAccounts} loading={accountsLoading} />
      )}
    </div>
  );
}


// ── MSB section ──────────────────────────────────────────────────────────────
function MSBSection({ formData, setFormData }: { formData: Record<string, string>; setFormData: (d: Record<string, string>) => void }) {
  const { toast } = useToast();
  const [captchaSrc, setCaptchaSrc] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [status, setStatus] = useState<{ loggedIn: boolean; running: boolean; username?: string | null; accountNumber?: string | null; autoLoginRunning?: boolean; lastError?: string | null } | null>(null);
  const [accounts, setAccounts] = useState<Array<{ accountNumber: string; accountName: string; balance?: number | null; currency?: string }>>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCaptcha = useCallback(async (refresh = false) => {
    setCaptchaLoading(true);
    try {
      const url = refresh ? "/api/msb/captcha/refresh" : "/api/msb/captcha";
      const res = await fetch(url, { method: refresh ? "POST" : "GET" });
      const data = await res.json();
      if (data.success && data.captchaBase64) {
        setCaptchaSrc(`data:${data.captchaContentType || "image/png"};base64,${data.captchaBase64}`);
        setCaptchaCode("");
      }
    } catch {}
    finally { setCaptchaLoading(false); }
  }, []);

  const fetchMSBAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/msb/accounts");
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setAccounts(data.data.map((a: any) => ({
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          balance: a.balance ?? null,
          currency: a.currency,
        })));
      }
    } catch {}
    finally { setAccountsLoading(false); }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/msb/status");
      const data = await res.json();
      setStatus(data);
      if (data.loggedIn) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        // Ưu tiên dùng accounts từ status (cache server) nếu có — không cần request thêm
        if (data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts.map((a: any) => ({
            accountNumber: a.accountNumber,
            accountName: a.accountName,
            balance: a.balance ?? null,
            currency: a.currency,
          })));
        } else {
          await fetchMSBAccounts();
        }
      }
      return data;
    } catch { return null; }
  }, [fetchMSBAccounts]);

  // Check status on mount + poll while autoLoginRunning or not logged in
  useEffect(() => {
    checkStatus().then(data => {
      if (data && !data.loggedIn) {
        pollRef.current = setInterval(() => { checkStatus(); }, 4000);
      }
    });
    // Load captcha for manual fallback
    fetchCaptcha(false);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [checkStatus, fetchCaptcha]);

  const handleAutoLogin = async () => {
    const username = formData["msb_username"] || "";
    const password = formData["msb_password"] || "";
    if (!username || !password) {
      toast({ variant: "destructive", title: "Vui lòng nhập username và mật khẩu" });
      return;
    }
    setAutoLoading(true);
    setAccounts([]);
    try {
      const res = await fetch("/api/msb/auto-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, accountNumber: formData["msb_account_number"] || undefined })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ MSB: Đăng nhập thành công", description: `Sau ${data.attempts || 1} lần giải captcha` });
        await checkStatus();
        // Server đang fetchAccounts ở nền (2s delay) → thử lại sau 4s và 8s để bắt kịp
        setTimeout(() => checkStatus(), 4000);
        setTimeout(() => checkStatus(), 8000);
      } else {
        toast({ variant: "destructive", title: "Đăng nhập thất bại", description: data.message });
        fetchCaptcha(true);
        checkStatus();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi kết nối", description: e.message });
    } finally { setAutoLoading(false); }
  };

  const handleLogin = async () => {
    const username = formData["msb_username"] || "";
    const password = formData["msb_password"] || "";
    if (!username || !password || !captchaCode) {
      toast({ variant: "destructive", title: "Vui lòng nhập đầy đủ username, mật khẩu và mã xác nhận" });
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch("/api/msb/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaCode, accountNumber: formData["msb_account_number"] || undefined })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ Đăng nhập MSB thành công" });
        setCaptchaCode("");
        await checkStatus();
        // Server fetchAccounts chạy nền 2s → retry để bắt kịp số dư thực
        setTimeout(() => checkStatus(), 4000);
        setTimeout(() => checkStatus(), 8000);
      } else {
        toast({ variant: "destructive", title: "Đăng nhập thất bại", description: data.message });
        fetchCaptcha(true);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi kết nối", description: e.message });
    } finally { setLoginLoading(false); }
  };

  return (
    <div className="space-y-3 border rounded-md p-4 bg-muted/30">
      <p className="text-sm font-semibold text-muted-foreground">Thông tin đăng nhập MSB</p>

      {/* Live status badge */}
      {status && (
        <div className={`flex flex-col gap-1 rounded-md px-3 py-2 text-sm ${status.loggedIn ? "bg-green-500/10 border border-green-500/30" : status.autoLoginRunning ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted border border-border"}`}>
          <div className="flex items-center gap-2">
            {status.loggedIn
              ? <><CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /><span className="text-green-400 font-medium">Đã đăng nhập{status.username ? ` — ${status.username}` : ""}</span></>
              : status.autoLoginRunning
                ? <><Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" /><span className="text-amber-400">Đang tự đăng nhập lại (OCR captcha)...</span></>
                : <><LogOut className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-muted-foreground">Chưa đăng nhập</span></>
            }
          </div>
          {status.lastError && !status.loggedIn && (
            <p className="text-xs text-destructive ml-6">{status.lastError}</p>
          )}
        </div>
      )}

      <Field label="Tên đăng nhập" fieldKey="msb_username" formData={formData} setFormData={setFormData} placeholder="Username Internet Banking" />
      <Field label="Mật khẩu" fieldKey="msb_password" formData={formData} setFormData={setFormData} type="password" placeholder="Mật khẩu Internet Banking" />
      <Field label="Số tài khoản MSB" fieldKey="msb_account_number" formData={formData} setFormData={setFormData} placeholder="VD: 0123456789" />

      <Button onClick={handleAutoLogin} disabled={autoLoading || loginLoading} className="w-full">
        {autoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
        {autoLoading ? "Đang tự động giải captcha..." : "Đăng nhập tự động (OCR captcha)"}
      </Button>

      {/* Manual captcha fallback */}
      <details className="group">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
          Đăng nhập thủ công (nhập captcha tay)
        </summary>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-14 rounded-md border bg-background flex items-center justify-center overflow-hidden">
              {captchaLoading
                ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                : captchaSrc
                  ? <img src={captchaSrc} alt="captcha" className="h-full object-contain" />
                  : <span className="text-xs text-muted-foreground">Chưa tải captcha</span>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => fetchCaptcha(true)} disabled={captchaLoading}>
              <RefreshCw className={`h-4 w-4 ${captchaLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <Input
            placeholder="Nhập mã captcha trong ảnh"
            value={captchaCode}
            onChange={(e) => setCaptchaCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Button onClick={handleLogin} disabled={loginLoading || autoLoading} variant="secondary" className="w-full">
            {loginLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            Đăng nhập (nhập captcha thủ công)
          </Button>
        </div>
      </details>


      {/* Tài khoản thực sau khi đăng nhập */}
      {accounts.length > 0 && (
        <AccountsPanel accounts={accounts} onRefresh={fetchMSBAccounts} loading={accountsLoading} />
      )}
    </div>
  );
}

// ── Techcombank section ─────────────────────────────────────────────────────
function TCBSection({ formData, setFormData }: { formData: Record<string, string>; setFormData: (d: Record<string, string>) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ accountNumber: string; accountName: string; balance?: number | null; currency?: string }>>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const fetchTCBAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch("/api/techcombank/accounts");
      const data = await res.json();
      if (data.success && data.data) {
        setAccounts(data.data.map((a: any) => ({
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          balance: a.balance ?? null,
          currency: a.currency,
        })));
      }
    } catch {}
    finally { setAccountsLoading(false); }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setElapsedSec(0);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setElapsedSec(s => s + 1);
    }, 1000);

    // Poll status every 3s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/techcombank/status");
        const data = await res.json();
        if (data.loggedIn && !data.pendingConfirmation) {
          stopPolling();
          setPendingConfirmation(false);
          setLoggedIn(true);
          toast({ title: "✅ Techcombank: Xác nhận thành công!", description: "Đã đăng nhập và lấy tài khoản" });
          await fetchTCBAccounts();
        } else if (!data.loggedIn && !data.pendingConfirmation) {
          // Login failed / cancelled
          stopPolling();
          setPendingConfirmation(false);
          toast({ variant: "destructive", title: "Xác nhận thất bại hoặc đã huỷ" });
        }
      } catch {}
    }, 3000);
  }, [stopPolling, toast, fetchTCBAccounts]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Check status on mount
  useEffect(() => {
    fetch("/api/techcombank/status").then(r => r.json()).then(data => {
      if (data.loggedIn) {
        setLoggedIn(true);
        fetchTCBAccounts();
      } else if (data.pendingConfirmation) {
        setPendingConfirmation(true);
        startPolling();
      }
    }).catch(() => {});
  }, [fetchTCBAccounts, startPolling]);

  const handleLogin = async () => {
    const username = formData["tcb_username"] || "";
    const password = formData["tcb_password"] || "";
    if (!username || !password) {
      toast({ variant: "destructive", title: "Vui lòng nhập tên đăng nhập và mật khẩu" });
      return;
    }
    setLoading(true);
    setLoggedIn(false);
    setAccounts([]);
    try {
      const res = await fetch("/api/techcombank/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, accountNumber: formData["tcb_account_number"] || undefined })
      });
      const data = await res.json();

      if (data.pendingConfirmation) {
        setPendingConfirmation(true);
        startPolling();
        toast({ title: "📱 Mở app TCB và xác nhận đăng nhập", description: "Đang chờ xác nhận tự động..." });
      } else if (data.success) {
        setLoggedIn(true);
        toast({ title: "✅ Đăng nhập Techcombank thành công" });
        await fetchTCBAccounts();
      } else {
        toast({ variant: "destructive", title: "Đăng nhập thất bại", description: data.message });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi kết nối", description: e.message });
    } finally { setLoading(false); }
  };

  const handleCancelPending = async () => {
    await fetch("/api/techcombank/cancel-pending", { method: "POST" });
    stopPolling();
    setPendingConfirmation(false);
    toast({ title: "Đã huỷ xác nhận" });
  };

  const handleLogout = async () => {
    await fetch("/api/techcombank/logout", { method: "POST" });
    setLoggedIn(false);
    setAccounts([]);
    toast({ title: "Đã đăng xuất Techcombank" });
  };

  return (
    <div className="space-y-3 border rounded-md p-4 bg-muted/30">
      <p className="text-sm font-semibold text-muted-foreground">Thông tin đăng nhập Techcombank</p>
      <Field label="Tên đăng nhập" fieldKey="tcb_username" formData={formData} setFormData={setFormData} placeholder="Username Internet Banking" />
      <Field label="Mật khẩu" fieldKey="tcb_password" formData={formData} setFormData={setFormData} type="password" placeholder="Mật khẩu Internet Banking" />
      <Field label="Số tài khoản TCB" fieldKey="tcb_account_number" formData={formData} setFormData={setFormData} placeholder="VD: 19034567890" />

      {/* Chờ xác nhận từ app */}
      {pendingConfirmation && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-400">Đang chờ xác nhận từ app TCB...</span>
          </div>
          <p className="text-xs text-amber-300/80">
            Mở app Techcombank → Thông báo → Xác nhận đăng nhập
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Đã chờ: {elapsedSec}s</span>
            <Button variant="outline" size="sm" className="text-amber-400 border-amber-500/40 hover:bg-amber-500/10" onClick={handleCancelPending}>
              Huỷ
            </Button>
          </div>
        </div>
      )}

      {!pendingConfirmation && (
        <div className="flex gap-2">
          <Button onClick={handleLogin} disabled={loading} variant="secondary" className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            {loading ? "Đang kết nối..." : "Đăng nhập Techcombank"}
          </Button>
          {loggedIn && (
            <Button variant="outline" size="icon" onClick={handleLogout} title="Đăng xuất">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Techcombank yêu cầu xác nhận qua app — hệ thống sẽ tự động phát hiện khi bạn xác nhận.
      </p>

      {/* Tài khoản thực sau khi đăng nhập */}
      {accounts.length > 0 && (
        <AccountsPanel accounts={accounts} onRefresh={fetchTCBAccounts} loading={accountsLoading} />
      )}
    </div>
  );
}

// ── Main Settings page ──────────────────────────────────────────────────────
export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetAdminSettings();
  const saveMutation = useSaveAdminSettings();
  const maintenanceMutation = useTriggerMaintenance();
  const checkBalanceMutation = useCheckBankBalanceNow();

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [bankType, setBankType] = useState("mb");

  useEffect(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      settings.forEach((s) => { initial[s.key] = s.value; });
      setFormData(initial);
    }
  }, [settings]);

  const handleSave = () => {
    const settingsArray = Object.keys(formData).map((key) => ({ key, value: formData[key] }));
    saveMutation.mutate({ data: { settings: settingsArray } }, {
      onSuccess: () => {
        toast({ title: "Đã lưu cấu hình thành công" });
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Lưu thất bại", description: err.message })
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Cấu hình hệ thống</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 border-amber-500/20"
            onClick={() => maintenanceMutation.mutate(undefined, { onSuccess: () => toast({ title: "Đã bật/tắt bảo trì" }) })}
            disabled={maintenanceMutation.isPending}>
            <Wrench className="w-4 h-4 mr-2" /> Bật/Tắt bảo trì
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Lưu tất cả
          </Button>
        </div>
      </div>

      {/* Bot Tokens */}
      <Card>
        <CardHeader>
          <CardTitle>Token Bot Telegram</CardTitle>
          <CardDescription>Lưu token → bot tự khởi động ngay, không cần restart server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Bot chính (bot_token)" fieldKey="bot_token" formData={formData} setFormData={setFormData} type="password" placeholder="123456789:AAF..." />
          <Field label="Bot phụ / Bot2 (bot2_token)" fieldKey="bot2_token" formData={formData} setFormData={setFormData} type="password" placeholder="123456789:AAF..." />
          <Field label="Bot hỗ trợ / Support Bot (support_bot_token)" fieldKey="support_bot_token" formData={formData} setFormData={setFormData} type="password" placeholder="123456789:AAF..." />
          <p className="text-xs text-muted-foreground">Nhập token rồi nhấn <strong>Lưu tất cả</strong> — bot sẽ tự khởi động trong vài giây.</p>
        </CardContent>
      </Card>

      {/* Banking */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ngân hàng & Thanh toán</CardTitle>
              <CardDescription>Tài khoản nạp/rút tự động</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => checkBalanceMutation.mutate(undefined, { onSuccess: () => toast({ title: "Đã đồng bộ số dư" }) })} disabled={checkBalanceMutation.isPending}>
              <Wallet className={`w-4 h-4 mr-2 ${checkBalanceMutation.isPending ? "animate-spin" : ""}`} />
              Đồng bộ số dư
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bank selector */}
          <div className="space-y-2">
            <Label>Chọn ngân hàng</Label>
            <Select value={bankType} onValueChange={setBankType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mb">MB Bank (Auto captcha bypass)</SelectItem>
                <SelectItem value="msb">MSB (OCR captcha tự động)</SelectItem>
                <SelectItem value="tcb">Techcombank (Xác nhận qua app)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {bankType === "mb"  && <MBBankSection  formData={formData} setFormData={setFormData} />}
          {bankType === "msb" && <MSBSection     formData={formData} setFormData={setFormData} />}
          {bankType === "tcb" && <TCBSection     formData={formData} setFormData={setFormData} />}

          {/* Display info */}
          <div className="space-y-3 pt-3 border-t">
            <p className="text-sm font-medium text-muted-foreground">Thông tin hiển thị cho người dùng</p>
            <Field label="Tên ngân hàng hiển thị" fieldKey="BANK_NAME" formData={formData} setFormData={setFormData} placeholder="MB Bank" />
            <Field label="Số tài khoản hiển thị" fieldKey="BANK_ACCOUNT" formData={formData} setFormData={setFormData} />
            <Field label="Tên chủ tài khoản hiển thị" fieldKey="BANK_OWNER" formData={formData} setFormData={setFormData} />
          </div>
        </CardContent>
      </Card>

      {/* Game Config */}
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình trò chơi</CardTitle>
          <CardDescription>Các tham số gameplay và ngưỡng giới hạn</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Nạp tối thiểu (VND)" fieldKey="MIN_DEPOSIT" formData={formData} setFormData={setFormData} placeholder="50000" />
          <Field label="Rút tối thiểu (VND)" fieldKey="MIN_WITHDRAWAL" formData={formData} setFormData={setFormData} placeholder="100000" />
          <Field label="Tỷ lệ thắng mục tiêu toàn cục (%)" fieldKey="TARGET_WIN_RATE" formData={formData} setFormData={setFormData} placeholder="45" />
        </CardContent>
      </Card>
    </div>
  );
}
