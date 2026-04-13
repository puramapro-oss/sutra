import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../lib/store";
import type { PointTransaction, ShopItem } from "../types/database";

export function usePoints() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPoints = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        balance: number;
        lifetime_earned: number;
        transactions: PointTransaction[];
      }>("/api/points");
      setBalance(data.balance);
      setLifetime(data.lifetime_earned);
      setTransactions(data.transactions);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return { balance, lifetime, transactions, isLoading, refreshPoints: fetchPoints };
}

export function useBoutique() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ items: ShopItem[] }>("/api/boutique");
        setItems(data.items);
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const purchase = async (itemId: string) => {
    await apiFetch("/api/boutique", { method: "POST", body: { item_id: itemId } });
  };

  return { items, isLoading, purchase };
}
