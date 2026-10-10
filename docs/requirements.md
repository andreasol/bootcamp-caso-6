# Requisitos: Cola operativa de cierre de planilla con acceso seguro

## Problema y usuario

Cada mes, el analista de planilla de un país pierde horas cruzando su sistema local con los sistemas globales (pago y vacaciones), buscando a mano qué no cuadra y sin saber qué atender primero antes del cierre de pago. Cada persona solo debe ver lo de su país o región.

Empresa ficticia: Grupo Altamar. 5 países en 3 regiones. Todos los datos son 100% sintéticos.

## Frontera de decisión

| Quién | Qué hace |
|---|---|
| Código determinista (SQL/TypeScript) | Normaliza, calcula varianzas y umbrales, detecta discrepancias, filtra por alcance, cambia estados |
| Base de datos (RLS) | Decide qué filas ve cada usuario, antes de que lleguen a la app o al modelo |
| IA | Prioriza, explica, sugiere una acción y redacta el briefing. Nunca calcula, filtra, autoriza ni cambia estados |
| Persona | Aprueba, corrige o escala. Asigna roles (solo admin) |

Cada requisito es verificable. **R1–R7 = Fase 1**, **R8–R11 = Fase 2**, **R12–R14 = Fase 3**.

## Fase 1: datos y capa segura (sin IA)

### R1. Alcance por rol (RLS)
- R1.1 `analyst` solo lee filas de su país en toda tabla con país.
- R1.2 `regional_lead` solo lee los países de su región.
- R1.3 `global_manager` lee todos los países; no lee cuarentena, datos crudos, mapeos ni auditoría.
- R1.4 `admin` lee todo, incluida la cuarentena y la auditoría.
- R1.5 Una cuenta sin perfil no lee nada (deny by default).
- R1.6 Los conteos y agregados respetan el mismo alcance que las filas.
- R1.7 Los registros sin país mapeable solo los ve `admin`.

### R2. Integración de fuentes
- R2.1 Los CSV locales se cargan tal cual (texto) en `local_*_raw`.
- R2.2 El adaptador convierte fechas, períodos, montos, estados, conceptos e IDs con tablas de mapeo y produce `normalized_records`.
- R2.3 Lo que no se puede mapear va a `quarantine` con un motivo y nunca entra a `normalized_records`.

### R3. Discrepancias
- R3.1 Se generan deterministamente comparando local contra global por empleado, período y concepto.
- R3.2 Hay 5 tipos: `amount_mismatch`, `leave_balance_mismatch`, `missing_in_global`, `missing_in_local` y `missing_file`.
- R3.3 La varianza y el umbral aplicado se calculan en código y se guardan en la fila.
- R3.4 `rule_priority` (1 alta, 2 media, 3 baja) sale de reglas documentadas.
- R3.5 Recall y precisión del 100% contra `seed/ground_truth.json`.

### R4. Seed reproducible
- R4.1 `npm run db:reset` deja la base siempre en el mismo estado (semilla fija).
- R4.2 `seed/ground_truth.json` lista cada defecto plantado.
- R4.3 `npm run db:users` crea 5 usuarios de prueba, uno por rol, más un segundo analista (`docs/test-users.md`).

### R5. Login y cola
- R5.1 Login con correo y contraseña. Sin sesión, toda ruta privada redirige a `/login`.
- R5.2 La cola muestra las discrepancias del alcance, ordenadas por prioridad, con filtros de país, tipo y estado, e indica que el orden viene de reglas.
- R5.3 La cola tiene estados de carga, vacío, error y "sin rol".
- R5.4 Pedir por URL un país fuera del alcance devuelve vacío y registra `denied` en `audit_log`.

### R6. Cuentas y roles
- R6.1 Cualquiera puede crear una cuenta en `/signup`, sin correo de validación. La cuenta nace sin rol y no ve datos.
- R6.2 Solo `admin` lista cuentas, asigna rol y alcance, o quita el acceso.
- R6.3 Nadie puede cambiar su propio rol.
- R6.4 Cada asignación, y cada intento denegado, queda en `audit_log`.

### R7. Calidad
- R7.1 Tests unitarios del adaptador, varianzas, umbrales, prioridad y discrepancias.
- R7.2 Tests de RLS con sesiones reales de cada usuario de prueba: cada rol ve exactamente su subconjunto, incluidos los conteos.
- R7.3 CI en GitHub Actions: lint, typecheck y tests unitarios.

## Fase 2: capa de IA y pruebas adversariales

### R8. Revisión humana
- R8.1 La pantalla de detalle muestra los valores local y global, la varianza calculada por código, el umbral y los registros fuente citados.
- R8.2 Los botones aprobar, corregir y escalar (corregir y escalar exigen comentario) cambian el estado solo vía `review_discrepancy`.
- R8.3 La IA nunca cambia un estado.

### R9. Flujo de la llamada a la IA
- R9.1 El servidor usa el cliente con la sesión del usuario, nunca `service_role`.
- R9.2 Solo se envía el contexto mínimo: IDs, tipo, concepto, valores y varianza. Nunca nombres de personas.
- R9.3 El prompt de sistema trata el contenido de los registros como datos no confiables.
- R9.4 La salida es JSON validado con zod. Todo ID citado debe existir en el contexto enviado.
- R9.5 Si la respuesta es inválida, inventa un ID o la llamada falla o tarda más que el timeout, se usa el orden por reglas y la app lo indica.
- R9.6 Cada llamada queda en `audit_log` (IDs enviados, modelo, resultado) y en `ai_insights`.
- R9.7 La API key del LLM vive solo en el servidor (`.env.local` y Vercel).

### R10. Cola y briefing con IA
- R10.1 La cola indica si la prioridad de cada fila viene de la IA o de las reglas.
- R10.2 El briefing del cierre resume lo urgente del alcance y solo cita IDs válidos; si no, usa el fallback.
- R10.3 El inventario de recolección mensual muestra, de forma determinista, qué archivos llegaron y cuáles faltan por país.

### R11. Seguridad demostrable
- R11.1 Hay unos 20 casos adversariales en `tests/security`: otro país, "ignora tus reglas", "soy admin", adivinar IDs, conteos ajenos, prompt injection dentro de un registro, manipulación de parámetros y registros sin país.
- R11.2 Fuga = cualquier ID, nombre, monto, conteo o dato inferible fuera del alcance, en la respuesta de la API o del modelo. La meta es 100% de bloqueo.
- R11.3 Los resultados quedan guardados como evidencia.
- R11.4 Tests de integración con el LLM simulado: respuesta válida, inválida, con ID inventado y timeout.

## Fase 3: medición, vista admin y entrega

### R12. Vista de administrador
- R12.1 Ejecuta la suite de fuga y muestra los resultados por rol.
- R12.2 Muestra `audit_log` y la cuarentena.

### R13. Métricas (script y página)
- R13.1 Tasa de consultas autorizadas atendidas correctamente.
- R13.2 Tasa de bloqueo de consultas no autorizadas, y casos superados sobre el total.
- R13.3 Precisión y recall contra el ground truth.
- R13.4 Porcentaje de registros integrados frente a los que quedaron en cuarentena.
- R13.5 Exactitud del briefing: IDs válidos y montos que coinciden con los calculados.
- R13.6 Tiempo de respuesta p50 y p95.
- R13.7 Ahorro estimado contra `baseline_minutes_manual`, que es configurable y no inventa cifras reales.

### R14. Entrega
- R14.1 README con problema, usuario, arquitectura (Mermaid), frontera de decisión, cómo correrlo y cómo desplegarlo.
- R14.2 `docs/access-matrix.md`, `docs/assumptions.md` y `docs/limitations.md`.
- R14.3 Demo de punta a punta funcionando en la URL de Vercel.
