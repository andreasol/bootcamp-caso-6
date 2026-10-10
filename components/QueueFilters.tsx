// Plain GET form: filters live in the URL, so they work without client JavaScript and can be
// shared. The server re-validates every value; a country outside the scope returns nothing.
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import { DISCREPANCY_STATUSES, DISCREPANCY_TYPES } from "@/services/discrepancies";
import type { VisibleCountry } from "@/services/countries";

const selectClass =
  "mt-1 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-ink-muted " +
  "focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

interface Props {
  countries: VisibleCountry[];
  selected: { country?: string; type?: string; status?: string };
}

export function QueueFilters({ countries, selected }: Props) {
  return (
    <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
      {countries.length > 1 && (
        <label className="text-sm font-medium">
          País
          <select name="country" defaultValue={selected.country ?? ""} className={selectClass}>
            <option value="">Todos los de mi alcance</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-medium">
        Tipo
        <select name="type" defaultValue={selected.type ?? ""} className={selectClass}>
          <option value="">Todos los tipos</option>
          {DISCREPANCY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Estado
        <select name="status" defaultValue={selected.status ?? "open"} className={selectClass}>
          <option value="all">Todos los estados</option>
          {DISCREPANCY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-sm border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Aplicar filtros
      </button>
    </form>
  );
}
