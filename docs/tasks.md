# Tareas

Se ejecutan de a una. Al terminar cada tarea: commit en español, indicar qué verificar y detenerse.
Una tarea se marca `[x]` **solo cuando el usuario confirma que funciona**.

Estado posible: _por confirmar_ = construida y verificada por el agente, falta la confirmación del usuario.

## Fase 1: datos y capa segura (sin IA)

- [ ] **T1. Base del proyecto y despliegue.** Next.js + TypeScript + Tailwind + Vitest, repo en GitHub, Vercel conectado. _Por confirmar._
  Verificar: https://bootcamp-caso-6.vercel.app carga.
- [ ] **T2. Esquema, RLS y auditoría** (migraciones 001–004, `docs/access-matrix.md`). _Por confirmar._
  Verificar: en Supabase > Table Editor existen las tablas y cada una muestra "RLS enabled".
- [ ] **T3. Seed, ground truth, adaptador, cuarentena y motor de discrepancias.** _Por confirmar._
  Verificar: `npm run db:reset` termina con "Precisión 100.0% · Recall 100.0%"; `npm test` pasa.
- [ ] **T4. Login y cola priorizada por reglas.** _Por confirmar._
  Verificar: `analista.cl` ve 7 filas solo de Chile; con `?country=MX` ve la cola vacía.
- [ ] **T5. Registro de cuentas y asignación de roles por admin** (migración 005). _Por confirmar._ Incluye modo de revisión con auto-asignación de rol (migración 007).
  Verificar: una cuenta nueva en `/signup` ve "sin rol"; el admin le asigna un rol en Usuarios y la cuenta pasa a ver su alcance.
- [ ] **T6. Tests automáticos de RLS por rol** (`tests/rls`, sesiones reales con los usuarios de prueba, incluidos conteos, cuarentena, funciones de admin e intentos de escritura).
  Verificar: `npm run test:rls` pasa y muestra la tabla de resultados por rol. _Por confirmar._
- [ ] **T7. CI en GitHub Actions** (lint, typecheck, tests unitarios).
  Verificar: el último commit en GitHub muestra el check en verde.

## Fase 2: capa de IA y pruebas adversariales

- [ ] **T8. Detalle de discrepancia y revisión humana.** Valores, varianza, umbral, registros fuente; botones aprobar, corregir y escalar con comentario. _Por confirmar._
- [ ] **T8b. Resumen tipo dashboard arriba de la cola** (pedido del usuario): totales del alcance por prioridad, tipo, estado y país, calculados por código; la lista debajo.
- [ ] **T9. Cliente LLM en servidor** (OpenRouter, zod, validación de IDs citados, timeout, fallback) + migración `ai_insights` + auditoría de cada llamada. _Por confirmar._ Probada con NVIDIA NIM real (7 discrepancias, respuesta válida).
- [ ] **T10. IA en la cola y en el detalle.** Prioridad sugerida con indicador IA/reglas, explicación, acción sugerida y confianza. _Por confirmar._
- [ ] **T11. Briefing del cierre mensual** con validación de IDs y montos citados.
- [ ] **T12. Inventario de recolección mensual** (determinista): archivos recibidos y faltantes por país.
- [ ] **T13. Tests de integración del flujo de IA con LLM simulado** (válida, inválida, ID inventado, timeout).
- [ ] **T14. Suite adversarial** (~20 casos en `tests/security`, incluido un registro con texto de prompt injection) con resultados guardados como evidencia.

## Fase 3: medición, vista admin y entrega

- [ ] **T15. Vista de administrador:** ejecutar la suite de fuga, ver resultados por rol, `audit_log` y cuarentena.
- [ ] **T16. Métricas:** script y página (§R13).
- [ ] **T17. Documentación:** README con diagrama, `docs/limitations.md`, pulido de UI.
- [ ] **T18. Demo de punta a punta** verificada en producción.
