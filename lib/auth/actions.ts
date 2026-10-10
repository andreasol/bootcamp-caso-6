"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";

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

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await logEvent(supabase, { action: "sign_out", resource: "auth", result: "allowed" });
  await supabase.auth.signOut();
  redirect("/login");
}
