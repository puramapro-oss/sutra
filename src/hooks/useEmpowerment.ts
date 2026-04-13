"use client";

import { useMemo } from "react";
import { getSpiritualMessage, getRandomQuote } from "@/lib/awakening";

export function useEmpowerment() {
  const quote = useMemo(() => getRandomQuote(), []);

  const getMessage = (
    context: "loading" | "error" | "empty" | "welcome" | "logout" | "success"
  ) => {
    return getSpiritualMessage(context);
  };

  return { quote, getMessage };
}
