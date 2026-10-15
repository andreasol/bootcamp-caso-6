import { z } from "zod";

// Roles a person may pick for themselves in demo mode. 'admin' is deliberately absent.
export const SELF_ROLES = ["analyst", "regional_lead", "global_manager"] as const;

export const claimInput = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  role: z.enum(SELF_ROLES, { message: "Elige un rol." }),
  countryCode: z.string().length(2).nullable(),
  regionCode: z.string().min(1).nullable(),
});
