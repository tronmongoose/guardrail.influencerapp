export function isDebugUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.DEBUG_CREATOR_EMAILS;
  if (!raw) return false;
  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}
