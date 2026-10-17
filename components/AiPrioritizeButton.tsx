"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { AI_MAX_WAIT } from "@/lib/ai/constants";
import { FALLBACK_MESSAGE } from "@/lib/ai/order";

type Outcome =
  | { kind: "idle" }
  | { kind: "ok"; count: number; seconds: number }
  | { kind: "fallback"; status: string; seconds: number }
  | { kind: "error"; message: string };

interface RunResponse {
  source?: "ai" | "rules";
  status?: string;
  insightCount?: number;
  latencyMs?: number;
  error?: string;
}

export function AiPrioritizeButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const busy = running || pending;

  async function run() {
    setRunning(true);
    setOutcome({ kind: "idle" });
    try {
      // The model can take 30-40 s; the server enforces its own timeout.
      const res = await fetch("/api/ai/prioritize", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as RunResponse;
      if (!res.ok) {
        setOutcome({ kind: "error", message: body.error ?? "No pudimos ejecutar el análisis." });
        return;
      }
      const seconds = Math.round((body.latencyMs ?? 0) / 1000);
      setOutcome(
        body.source === "ai"
          ? { kind: "ok", count: body.insightCount ?? 0, seconds }
          : { kind: "fallback", status: body.status ?? "error", seconds },
      );
      start(() => router.refresh());
    } catch {
      setOutcome({ kind: "error", message: "Se cortó la conexión mientras la IA analizaba. Intenta de nuevo." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={disabled || busy}
        className="flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Sparkles aria-hidden className="size-4" />}
        {busy ? "Analizando con IA…" : "Priorizar con IA"}
      </button>

      <div aria-live="polite" className="max-w-sm text-sm">
        {busy && <p className="text-ink-muted">Puede tardar {AI_MAX_WAIT}. La lista sigue ordenada por reglas mientras tanto.</p>}
        {outcome.kind === "ok" && (
          <p className="flex items-start gap-2 text-accent">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            Listo: la IA analizó {outcome.count} {outcome.count === 1 ? "caso" : "casos"} en {outcome.seconds} s.
          </p>
        )}
        {outcome.kind === "fallback" && (
          <p className="flex items-start gap-2 text-variance">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {FALLBACK_MESSAGE[outcome.status] ?? "La IA no pudo responder."} Se mantiene el orden por reglas.
          </p>
        )}
        {outcome.kind === "error" && (
          <p role="alert" className="flex items-start gap-2 text-variance">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {outcome.message}
          </p>
        )}
      </div>
    </div>
  );
}
