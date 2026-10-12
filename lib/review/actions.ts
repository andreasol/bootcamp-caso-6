"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reviewDiscrepancy } from "@/services/review";

export interface ReviewFormState {
  error: string | null;
  savedStatus: string | null;
}

const input = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["approve", "correct", "escalate"]),
    comment: z.string().trim().max(1000),
  })
  .refine((v) => v.action === "approve" || v.comment.length > 0, {
    message: "Escribe un comentario: es obligatorio para corregir o escalar.",
  });

// A person decides the status; this only validates shape. Scope is re-checked in the database.
export async function reviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const parsed = input.safeParse({
    id: formData.get("id"),
    action: formData.get("action"),
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", savedStatus: null };

  const supabase = await createClient();
  const { data, error } = await reviewDiscrepancy(supabase, {
    id: parsed.data.id,
    action: parsed.data.action,
    comment: parsed.data.comment || null,
  });
  if (error) return { error: "No pudimos guardar la decisión. Intenta de nuevo.", savedStatus: null };
  if (!data) {
    return { error: "No se guardó: la discrepancia ya está cerrada o no está en tu alcance.", savedStatus: null };
  }

  revalidatePath(`/queue/${parsed.data.id}`);
  revalidatePath("/queue");
  return { error: null, savedStatus: data.status };
}
