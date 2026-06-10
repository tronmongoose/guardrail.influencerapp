export function isPlatformFeeExempt(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.PLATFORM_FEE_EXEMPT_EMAILS;
  if (!raw) return false;
  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}
