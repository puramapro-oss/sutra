import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../lib/store";
import type { WalletTransaction } from "../types/database";

export function useWallet() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        balance: number;
        transactions: WalletTransaction[];
      }>("/api/wallet");
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const requestWithdrawal = async (amount: number, iban: string) => {
    await apiFetch("/api/wallet", {
      method: "POST",
      body: { action: "withdraw", amount, iban },
    });
    await fetchWallet();
  };

  return { balance, transactions, isLoading, refreshWallet: fetchWallet, requestWithdrawal };
}
