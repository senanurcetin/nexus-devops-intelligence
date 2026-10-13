/**
 * Accept only a short, integer HTTP Retry-After delta in seconds.
 *
 * GitHub and edge firewalls can send arbitrary header values. We intentionally
 * reject HTTP dates, signs, huge numbers and malformed values instead of
 * forwarding them to clients or scheduling background retries.
 */
export function safeRetryAfterSeconds(value: string | null | undefined): number | null {
  if (!value || !/^[0-9]{1,4}$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : null;
}
