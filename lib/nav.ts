// A link is active on its own path or any child path, never on a path that merely starts with the
// same letters (/faq must not light up /faq-admin).
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
