const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Advisor = { advisor_id: string; name: string };

function headers(advisorId?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (advisorId) h["X-Advisor-Id"] = advisorId;
  return h;
}

export async function demoLogin(): Promise<Advisor> {
  const res = await fetch(`${BASE}/auth/demo-login`, { method: "POST" });
  if (!res.ok) throw new Error("Demo login failed");
  return res.json();
}

export async function apiGet<T>(path: string, advisorId: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: headers(advisorId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, advisorId: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(advisorId),
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const err = new Error("conflict");
    (err as Error & { status: number }).status = 409;
    throw err;
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
