// URL-safe anchor from a Spanish title: "Uso diario" -> "uso-diario", "Cuentas y roles" -> "cuentas-y-roles".
export function slug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
