# Matriz de acceso

Quién puede leer qué. Lo impone Row Level Security (RLS) en Postgres, no el frontend ni el prompt del modelo. Fuente: `supabase/migrations/001`–`004`.

## Alcance por rol

| Rol | Países visibles |
|---|---|
| `analyst` | Solo su `country_id` |
| `regional_lead` | Todos los países de su `region_id` |
| `global_manager` | Todos |
| `admin` | Todos, más registros sin país (cuarentena), datos crudos y auditoría |
| Sin perfil / anónimo | Ninguno |

El alcance se calcula una sola vez por consulta con `private.visible_country_ids()`. Ese esquema `private` no está expuesto por la API.

## Lectura por tabla

✔ = filas de su alcance · ★ = todas las filas · ✘ = nada

| Tabla | analyst | regional_lead | global_manager | admin | anon |
|---|---|---|---|---|---|
| regions | ✔ (la suya) | ✔ (la suya) | ★ | ★ | ✘ |
| countries | ✔ | ✔ | ★ | ★ | ✘ |
| profiles | solo el propio | solo el propio | solo el propio | ★ | ✘ |
| source_systems | globales + locales de su alcance | idem | ★ | ★ | ✘ |
| expected_sources | ✔ | ✔ | ★ | ★ | ✘ |
| source_batches | ✔ | ✔ | ★ | ★ | ✘ |
| local_payroll_raw / local_leave_raw | ✘ | ✘ | ✘ | ★ | ✘ |
| global_payroll / global_leave | ✔ | ✔ | ★ | ★ | ✘ |
| employees | ✔ | ✔ | ★ | ★ | ✘ |
| employee_id_map / status_code_map / concept_map | ✘ | ✘ | ✘ | ★ | ✘ |
| normalized_records | ✔ | ✔ | ★ | ★ | ✘ |
| quarantine | ✘ | ✘ | ✘ | ★ | ✘ |
| thresholds | default + su alcance | idem | ★ | ★ | ✘ |
| discrepancies | ✔ | ✔ | ★ | ★ | ✘ |
| review_actions | de discrepancias visibles | idem | ★ | ★ | ✘ |
| audit_log | ✘ | ✘ | ✘ | ★ | ✘ |

Los conteos (`count`) y agregados pasan por las mismas políticas, así que tampoco revelan filas ajenas.

## Escritura

Ningún usuario escribe tablas directamente: `insert/update/delete` están revocados para `authenticated` y todo está revocado para `anon`.

| Operación | Cómo | Control |
|---|---|---|
| Cambiar estado de una discrepancia | `rpc review_discrepancy(id, action, comment)` | Revisa el alcance en la función; un ID ajeno se comporta igual que uno inexistente (devuelve `null`) y queda registrado como `denied`. |
| Listar cuentas | `rpc admin_list_users()` | Solo admin; un no-admin recibe lista vacía y queda `denied` en auditoría. |
| Asignar o cambiar rol y alcance | `rpc admin_assign_role(user, name, role, country, region)` | Solo admin; nadie puede cambiar su propio rol; valida país para analista y región para líder. |
| Quitar acceso | `rpc admin_revoke_role(user)` | Solo admin; borra el perfil y la cuenta vuelve a no ver nada. |
| Registrar auditoría | `rpc log_event(...)` | `user_id` y `role` los pone la función, no quien la llama. |
| Seed, carga de CSV, adaptador, generación de discrepancias | Scripts locales con `service_role` | Nunca en Vercel ni en el navegador (supuesto A2). |
| Editar o borrar `audit_log` | Imposible | Un trigger lo bloquea para todos, incluido `service_role`. |

## Por qué los mapeos y los datos crudos son solo de admin

Antes de pasar por el adaptador, un registro crudo no tiene un país confiable. Las tablas de mapeo listan códigos de todos los países. Mostrarlas a un analista revelaría, por ejemplo, cuántos empleados tiene otro país.

## Alta de cuentas

Cualquiera puede crear una cuenta en `/signup`, pero nace **sin perfil**: puede iniciar sesión y no ve ningún dato (deny by default). Solo un `admin` le asigna rol y alcance desde **Usuarios**. Los jefes (`regional_lead`, `global_manager`) no asignan roles: una sola puerta de entrada, fácil de auditar.

## Modo de revisión (auto-asignación de rol)

Mientras `app_settings.demo_self_assign` esté en `true` (migración 007), una cuenta **sin rol** puede elegir el suyo con `rpc claim_demo_role`: analista (con país), líder regional (con región) o gerente global. **Nunca `admin`**, solo si la cuenta no tiene perfil, con alcance validado y cada intento en `audit_log`. Desactivarlo:

```sql
update public.app_settings set enabled = false where key = 'demo_self_assign';
```

Con el interruptor apagado, el alta vuelve a ser: registro abierto sin datos y rol asignado solo por un admin.
