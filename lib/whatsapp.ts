export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function buildWaLink(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function ticketNo(num: number): string {
  return `T-${String(num).padStart(3, "0")}`;
}

const IST_STAMP = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function solvedMessage(t: {
  contactName: string;
  num: number;
  title: string;
  resolutionNote: string;
  solvedAt: Date;
}): string {
  const stamp = IST_STAMP.format(t.solvedAt).replace(" at ", ", ");
  return `Hi ${t.contactName}, your complaint ${ticketNo(t.num)} — ${t.title} has been resolved on ${stamp} IST. Resolution: ${t.resolutionNote}. — G-TEC Tech Team`;
}
