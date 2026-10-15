"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";
import { claimDemoRole, isDemoSelfAssignEnabled } from "@/services/demo";
import { claimInput } from "./claim-schema";

export interface SignInState {
  error: string | null;
  email: string;
}

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Escribe un correo válido y tu contraseña.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for unknown email and wrong password: do not confirm which accounts exist.
    return { error: "Correo o contraseña incorrectos.", email };
  }

  await logEvent(supabase, { action: "sign_in", resource: "auth", result: "allowed" });
  redirect("/queue");
}

export interface SignUpState {
  error: string | null;
  email: string;
  fullName: string;
  pendingConfirmation: boolean;
}

const orNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v !== "" ? v : null);

const signUpInput = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  email: z.string().trim().email("Escribe un correo válido."),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres."),
});

// New accounts get no profile: they can sign in but see nothing until an admin assigns a role.
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const parsed = signUpInput.safeParse({ fullName, email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", email, fullName, pendingConfirmation: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return {
      error: taken ? "Ya existe una cuenta con ese correo. Inicia sesión." : "No pudimos crear la cuenta. Intenta de nuevo.",
      email,
      fullName,
      pendingConfirmation: false,
    };
  }
  // Only happens if email confirmation is enabled in Supabase Auth settings.
  if (!data.session) return { error: null, email, fullName, pendingConfirmation: true };

  await logEvent(supabase, { action: "sign_up", resource: "auth", result: "allowed" });

  // Demo mode: the person picks a role right here. Without the flag the account stays role-less.
  if (await isDemoSelfAssignEnabled(supabase)) {
    const pick = claimInput.safeParse({
      fullName: parsed.data.fullName,
      role: formData.get("role"),
      countryCode: orNull(formData.get("countryCode")),
      regionCode: orNull(formData.get("regionCode")),
    });
    // The account already exists: if the pick is invalid, /queue offers the same choice again.
    if (!pick.success) redirect("/queue");
    const { role, countryCode, regionCode } = pick.data;
    const claim = await claimDemoRole(supabase, {
      fullName: pick.data.fullName,
      role,
      countryCode: role === "analyst" ? countryCode : null,
      regionCode: role === "regional_lead" ? regionCode : null,
    });
    if (claim.error) redirect("/queue");
  }
  redirect("/queue");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await logEvent(supabase, { action: "sign_out", resource: "auth", result: "allowed" });
  await supabase.auth.signOut();
  redirect("/login");
}
