"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assignRole, revokeRole } from "@/services/users";

export interface RoleFormState {
  error: string | null;
  saved: boolean;
}

const roleInput = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Escribe el nombre de la persona.").max(120),
  role: z.enum(["analyst", "regional_lead", "global_manager", "admin"]),
  countryCode: z.string().length(2).nullable(),
  regionCode: z.string().min(1).nullable(),
});

const orNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v !== "" ? v : null);

// Permission is checked again inside the database function; this only validates shape.
export async function assignRoleAction(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const parsed = roleInput.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    countryCode: orNull(formData.get("countryCode")),
    regionCode: orNull(formData.get("regionCode")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", saved: false };

  const { role, countryCode, regionCode } = parsed.data;
  const supabase = await createClient();
  const { error } = await assignRole(supabase, {
    ...parsed.data,
    countryCode: role === "analyst" ? countryCode : null,
    regionCode: role === "regional_lead" ? regionCode : null,
  });
  if (error) return { error, saved: false };

  revalidatePath("/admin/users");
  return { error: null, saved: true };
}

export async function revokeRoleAction(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Cuenta inválida.", saved: false };

  const supabase = await createClient();
  const { error } = await revokeRole(supabase, userId.data);
  if (error) return { error, saved: false };

  revalidatePath("/admin/users");
  return { error: null, saved: true };
}
