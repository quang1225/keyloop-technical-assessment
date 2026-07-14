export function formatSlotLabel(iso: string, timeZone = "Europe/London"): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function isSlotFree(slotIso: string, freeSlots: string[]): boolean {
  return freeSlots.includes(slotIso);
}
