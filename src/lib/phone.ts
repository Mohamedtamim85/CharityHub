/// Phone helpers (pure, so they run in the browser too).

/** Digits only, Egyptian local numbers without the leading 0 (so 0100… and +20100… match). */
export function mobileKey(mobile: string | null | undefined): string | null {
  let d = (mobile ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.length >= 7 ? d : null;
}

/**
 * Phone number in the digits-only international form wa.me needs, or null.
 * Egyptian local numbers ("010 1234 5678") get the 20 country code.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^0\d{10}$/.test(d)) d = `20${d.slice(1)}`;
  d = d.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function whatsappUrl(text: string, phone?: string | null): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}
