"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimDemoRole } from "@/services/demo";
import { claimInput } from "./claim-schema";

export interface ClaimState {
  error: string | null;
}

const orNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v !== "" ? v : null);

// Demo mode only: the database function re-checks the flag, the role and the scope.
export async function claimRoleAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const parsed = claimInput.safeParse({
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    countryCode: orNull(formData.get("countryCode")),
    regionCode: orNull(formData.get("regionCode")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const { role, countryCode, regionCode } = parsed.data;
  const supabase = await createClient();
  const { error } = await claimDemoRole(supabase, {
    fullName: parsed.data.fullName,
    role,
    countryCode: role === "analyst" ? countryCode : null,
    regionCode: role === "regional_lead" ? regionCode : null,
  });
  if (error) return { error };
  redirect("/queue");
}
