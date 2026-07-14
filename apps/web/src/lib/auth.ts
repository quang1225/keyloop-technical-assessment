import type { Advisor } from "./api";

const KEY = "scheduler.advisor";

export function loadAdvisor(): Advisor | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Advisor;
  } catch {
    return null;
  }
}

export function saveAdvisor(a: Advisor): void {
  localStorage.setItem(KEY, JSON.stringify(a));
}

export function clearAdvisor(): void {
  localStorage.removeItem(KEY);
}
