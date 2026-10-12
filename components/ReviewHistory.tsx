import type { ReviewEntry } from "@/services/review";

const ACTION_LABEL = { approve: "Aprobó", correct: "Marcó como corregida", escalate: "Escaló" } as const;

export function ReviewHistory({ entries, currentUserId }: { entries: ReviewEntry[]; currentUserId: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">Nadie ha tomado una decisión sobre esta diferencia todavía.</p>;
  }
  return (
    <ol className="space-y-4">
      {entries.map((e) => (
        <li key={e.id} className="border-l-2 border-line pl-4">
          <p className="text-sm">
            <span className="font-medium">{e.userId === currentUserId ? "Tú" : "Otro revisor"}</span>{" "}
            {ACTION_LABEL[e.action].toLowerCase()} ·{" "}
            <time dateTime={e.createdAt} className="text-ink-muted">
              {new Date(e.createdAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
            </time>
          </p>
          {e.comment && <p className="mt-1 text-base">{e.comment}</p>}
        </li>
      ))}
    </ol>
  );
}
