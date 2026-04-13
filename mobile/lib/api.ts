import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://sutra.purama.dev";

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Erreur ${res.status}`);
  }

  return res.json();
}

export async function fetchWithRetry<T = unknown>(
  path: string,
  options: FetchOptions = {},
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiFetch<T>(path, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("Impossible de contacter le serveur");
}
