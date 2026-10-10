# Supuestos

Decisiones tomadas sin confirmación explícita. Cada una se puede revisar; si cambia, se actualiza aquí.

| # | Fecha | Supuesto | Motivo |
|---|---|---|---|
| A1 | 2026-10-10 | Stack Next.js 16 (App Router) + TypeScript, en lugar de React + Vite + JavaScript que pide `claude.md`. | El prompt del desafío lo pide y la llamada al LLM debe ocurrir en servidor (route handlers). |
| A2 | 2026-10-10 | `SUPABASE_SERVICE_ROLE_KEY` solo vive en `.env.local` y la usan únicamente `scripts/seed.ts`, `scripts/pipeline.ts` y `scripts/create-test-users.ts`. No se carga en Vercel. | Cumple el prompt (seed/admin) y minimiza la exposición que prohíbe `claude.md`. Las pruebas de seguridad de la vista admin inician sesión con usuarios de prueba, no con `service_role`. |
| A3 | 2026-10-10 | Sin shadcn/ui; Tailwind puro. | `claude.md` lo prohíbe salvo pedido; el prompt lo deja opcional. |
| A4 | 2026-10-10 | Código, tablas y comentarios en inglés; documentación e interfaz en español. | El prompt lo pide; contradice a `claude.md` en comentarios, gana el prompt. |
| A5 | 2026-10-10 | Login mínimo: email/contraseña con los usuarios de prueba del seed. Sin registro público ni recuperación de contraseña. | RLS necesita identidad; el resto no está en el alcance. |
| A6 | 2026-10-10 | Países con nombres reales (Chile, Perú, México, Costa Rica, España) en 3 regiones; empresa, personas, IDs y montos ficticios. | Los países no son datos personales y hacen la demo legible. |
| A7 | 2026-10-10 | `@types/node` subido a ^24 (create-next-app trae ^20). | Vitest 5 lo exige y el entorno usa Node 24. |
| A8 | 2026-10-10 | Proveedor LLM por defecto: Anthropic API (Fase 2), salvo indicación contraria. | Quedó sin definir en el prompt. |
| A9 | 2026-10-10 | RLS no devuelve error ante filas ajenas, devuelve vacío. Para dejar evidencia de intentos denegados, el servidor compara además el `country_id` pedido con el alcance del perfil y registra `denied` en `audit_log`. RLS sigue siendo el límite real. | Requisito de auditar intentos denegados. |
