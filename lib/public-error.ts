// Internal error text (database messages, provider errors) must not reach the browser: it names
// tables and columns and helps an attacker map the system (OWASP A05/A09). The detail goes to the
// server log with a short reference code; users see only the code, which support can look up.
export function publicError(detail: string): string {
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[error ${ref}] ${detail}`);
  // In development the detail is shown to speed up debugging.
  return process.env.NODE_ENV === "production" ? `Código de referencia ${ref}` : detail;
}
