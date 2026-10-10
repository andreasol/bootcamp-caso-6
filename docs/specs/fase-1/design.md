# Fase 1: diseño

## Flujo de datos

```mermaid
flowchart LR
  CSV[CSV locales<br/>formato viejo] -->|scripts/seed.ts<br/>service_role, local| RAW[local_*_raw<br/>texto tal cual]
  GEN[Generador global] --> GLB[global_payroll<br/>global_leave]
  RAW --> ADP{Adaptador TS<br/>determinista}
  MAP[(employee_id_map<br/>status_code_map<br/>concept_map)] --> ADP
  ADP -->|mapeable| NR[normalized_records]
  ADP -->|no mapeable| Q[quarantine<br/>solo admin]
  GLB --> NR
  NR --> DET{Motor de<br/>discrepancias TS}
  EXP[expected_sources<br/>source_batches] --> DET
  TH[thresholds] --> DET
  DET --> D[discrepancies<br/>+ rule_priority]
  D -->|RLS con JWT del usuario| UI[Cola en Next.js]
  UI -->|rpc review_discrepancy| D
```

## Decisiones

- **Período**: `date` con día 1 (`2026-09-01`). Restricción `check` en cada tabla.
- **Normalización de leave**: un saldo de vacaciones es un `normalized_record` con `concept = 'leave_balance'` y `unit = 'days'`, así payroll y leave comparten el mismo motor.
- **Scope helpers**: funciones `SECURITY DEFINER` en el esquema `private` (no expuesto por la API). Las políticas las llaman como `(select private.visible_country_ids())::uuid[]` para que se evalúen una vez por consulta.
- **Deny by default**: RLS activo en todas las tablas; sin política = sin acceso. Además se revocan los privilegios de tabla a `anon` y de escritura a `authenticated`, también para tablas futuras (`alter default privileges`).
- **Estados**: solo cambian vía `review_discrepancy`. Transiciones: `open` o `escalated` → `approved`, `corrected` o `escalated`. `approved` y `corrected` son finales. `correct` y `escalate` exigen comentario.
- **Auditoría**: `audit_log` es append-only (trigger). `log_event` pone `user_id` y `role` desde el JWT.

## Prioridad por reglas (`rule_priority`)

1 = alta, 2 = media, 3 = baja. Se calcula en TypeScript (`lib/discrepancies/priority.ts`):

| Condición | Prioridad |
|---|---|
| `missing_file` | 1 |
| Varianza ≥ 3× el umbral, o `missing_in_global` de pago | 1 |
| `amount_mismatch` bajo 3× el umbral, o `missing_in_local` | 2 |
| `leave_balance_mismatch` bajo 3× el umbral (no bloquea el pago) | 3 |

`rule_reason` guarda en español la regla que se aplicó.

## Umbral

Una diferencia es discrepancia si `|local − global| > abs_threshold` **o** `|local − global| / |global| > pct_threshold`. Se usa el umbral del país si existe; si no, el default (`country_id` nulo).
