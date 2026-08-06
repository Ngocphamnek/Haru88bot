export interface BankAccountReference {
  userId?: string;
  accountNumber?: string | null;
}

export function normalizeBankAccountNumber(accountNumber: string | null | undefined): string {
  return String(accountNumber ?? "").replace(/\D/g, "");
}

export function checkBankAccountUniqueness(
  accountNumber: string | null | undefined,
  currentUserId: string,
  existingAccounts: BankAccountReference[]
): { ok: boolean; message?: string; normalized?: string } {
  const normalized = normalizeBankAccountNumber(accountNumber);
  if (!normalized) {
    return { ok: false, message: "❌ Số tài khoản không hợp lệ." };
  }

  for (const entry of existingAccounts) {
    if (!entry.userId || entry.userId === currentUserId) continue;
    if (normalizeBankAccountNumber(entry.accountNumber) === normalized) {
      return {
        ok: false,
        message: `❌ Số tài khoản <code>${normalized}</code> đã được người khác sử dụng. Vui lòng nhập số khác.`,
        normalized,
      };
    }
  }

  return { ok: true, normalized };
}
