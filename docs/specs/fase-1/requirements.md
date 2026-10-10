# Fase 1: requisitos

Datos y capa segura, sin IA. Cada criterio es verificable.

## R1. Alcance por rol (RLS)
- R1.1 `analyst` solo lee filas de su `country_id` en todas las tablas con país.
- R1.2 `regional_lead` solo lee filas de países de su región.
- R1.3 `global_manager` lee todos los países; no lee `quarantine` ni `audit_log` completo.
- R1.4 `admin` lee todo, incluida `quarantine` y `audit_log`.
- R1.5 Un usuario sin perfil, o con perfil incompleto, no lee nada (deny by default).
- R1.6 Los conteos (`count`) respetan el mismo alcance que las filas.
- R1.7 Filas con `country_id` nulo solo son visibles para `admin`.

## R2. Integración de fuentes
- R2.1 Los CSV locales se cargan tal cual (texto) en `local_*_raw`.
- R2.2 El adaptador convierte fechas `DD/MM/YYYY`, códigos de estado y IDs locales usando tablas de mapeo, y produce `normalized_records`.
- R2.3 Todo registro que no se pueda mapear (ID, país, fecha o código inválido) va a `quarantine` con motivo, y no entra a `normalized_records`.

## R3. Discrepancias
- R3.1 Se generan deterministamente comparando local vs global por empleado, periodo y concepto.
- R3.2 Tipos: `amount_mismatch`, `leave_balance_mismatch`, `missing_in_global`, `missing_in_local`, `missing_file`.
- R3.3 La varianza y el umbral aplicado se calculan en código y se guardan en la fila.
- R3.4 `rule_priority` (1 alta, 2 media, 3 baja) se calcula con reglas documentadas.
- R3.5 Recall 100% contra `seed/ground_truth.json` y 0 falsos positivos en el seed.

## R4. Seed reproducible
- R4.1 Un comando (`npm run db:reset`) deja la base en el mismo estado siempre (semilla fija).
- R4.2 `seed/ground_truth.json` lista cada defecto plantado.
- R4.3 Se crean 5 usuarios de prueba documentados en `docs/test-users.md`.

## R5. Interfaz
- R5.1 Login con email y contraseña; sin sesión, toda ruta privada redirige a `/login`.
- R5.2 La cola muestra las discrepancias del alcance, ordenadas por `rule_priority`, con filtros por país, tipo y estado, e indica que la prioridad viene de reglas.
- R5.3 La cola tiene estados cargando, vacío y error.
- R5.4 Pedir por URL un `country_id` fuera de alcance devuelve vacío y registra `denied` en `audit_log`.

## R6. Calidad
- R6.1 Tests unitarios del adaptador, varianzas, umbrales y discrepancias.
- R6.2 Tests de RLS con sesiones reales de cada usuario de prueba.
- R6.3 CI en GitHub Actions: lint, typecheck, tests unitarios.
