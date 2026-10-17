# Limitaciones y qué cambiaría con datos reales

Este es un prototipo académico con datos 100% sintéticos. Este documento dice con honestidad qué no cubre.

> **No es asesoría legal.** La sección de protección de datos es un análisis técnico del equipo, no una opinión jurídica. Con datos reales debe revisarla un abogado especialista y, si corresponde, el delegado de protección de datos.

## 1. Alcance del prototipo

- Todas las personas, montos, IDs y la empresa «Grupo Altamar» son inventados. Los países son reales solo para que los ejemplos se entiendan.
- No se conecta a ningún sistema real de planilla. Los CSV locales y los datos globales se generan con una semilla fija.
- Una sola organización, 5 países y 2 períodos. No se probó con volúmenes de miles de empleados.

## 2. Protección de datos personales en Chile (Ley 21.719)

La Ley 21.719 reemplaza a la Ley 19.628, se inspira en el Reglamento General de Protección de Datos (GDPR) europeo y crea la Agencia de Protección de Datos Personales. Según las fuentes consultadas, rige desde el **1 de diciembre de 2026**; existe además un proyecto de ley en trámite que propone aplazarla un año, así que conviene confirmar la fecha vigente ([Diario Constitucional](https://www.diarioconstitucional.cl/2026/06/12/la-ley-21-719-entra-en-vigor-el-1-de-diciembre-y-expone-vacios-en-regulacion-de-pequenas-empresas/), [Academia Judicial](https://academiajudicial.cl/recursos/actualizaciones-normativas/ley-21-719-que-regula-la-proteccion-y-el-tratamiento-de-los-datos-personales-y-crea-la-agencia-de-proteccion-de-datos-personales/)).

**Hoy no aplica de forma práctica**, porque no se trata ningún dato de personas reales. **Con datos reales de planilla (nombres, sueldos, saldos de vacaciones) sí aplicaría**, y el prototipo no se puede declarar conforme sin cerrar lo siguiente.

| Tema | Qué hace hoy el prototipo | Qué faltaría con datos reales |
|---|---|---|
| Base de licitud y finalidad | No aplica (datos ficticios) | Definir y documentar la base que legitima cada tratamiento (por ejemplo, la relación laboral o una obligación legal) y limitarlo a la finalidad de cierre de planilla |
| Información a los titulares | No existe aviso de privacidad | Aviso claro sobre qué se trata, para qué, quién lo recibe y cuánto tiempo se guarda |
| Minimización | Cada rol ve solo su país o región (RLS en la base de datos). A la IA no se le envían nombres: solo alias por consulta, montos y varianzas | Revisar campo por campo qué es realmente necesario; evaluar seudonimizar también en pantalla |
| Derechos de los titulares (acceso, rectificación, supresión, oposición, portabilidad, bloqueo) | No hay un procedimiento. La herramienta solo lee y compara; no edita los datos de personas | Un canal y un proceso con plazos para atender cada derecho, y que la herramienta pueda localizar y entregar los datos de una persona |
| Decisiones automatizadas y perfilado | La IA solo sugiere; la decisión es siempre de una persona y queda con comentario e historial. Las cifras las calcula código, no el modelo | Confirmar con un abogado si la priorización con IA cuenta como tratamiento automatizado, y garantizar explicación e intervención humana documentadas |
| Seguridad | Seguridad por filas en la base de datos, auditoría que no se puede editar, HTTPS, sin claves en el repositorio, límite de uso de la IA, cabeceras de seguridad | Inicio de sesión corporativo (SSO) con doble factor, cifrado a nivel de columna para sueldos, gestión de secretos, pruebas de penetración y monitoreo |
| Brechas de seguridad | No hay procedimiento | Plan de respuesta y de aviso a la Agencia y a los titulares afectados dentro de los plazos legales |
| Transferencias internacionales | Los datos viajan a servidores en EE. UU.: Supabase (us-east-1), Vercel y el proveedor de IA (NVIDIA). Hoy son ficticios | Evaluar la base legal de cada transferencia, contratos con garantías adecuadas y, si fuera necesario, elegir regiones o proveedores en un país con nivel adecuado |
| Encargados de tratamiento | No hay contratos | Contratos de encargo con Supabase, Vercel y el proveedor de IA que fijen finalidad, seguridad y subencargados |
| Conservación y supresión | No hay política de retención | Plazos de conservación y borrado. Ojo: la auditoría es inmutable a propósito, lo que choca con el derecho de supresión; habría que seudonimizar ese registro |
| Evaluación de impacto, registro de actividades y delegado | No existen | Evaluación de impacto del tratamiento, registro de las actividades y, si corresponde, un delegado o modelo de prevención |
| Datos sensibles | No se maneja ninguno | Las licencias médicas son datos de salud y tendrían un trato reforzado; hoy el prototipo solo maneja saldos de vacaciones, no ausencias por salud |

## 3. Seguridad: lo que se revisó y lo que queda

Revisión contra OWASP Top 10 (2021) del 2026-10-17:

- **Sin hallazgos:** claves en el código o en el historial de git, patrones de inyección de código en la app, uso de `service_role` fuera de los scripts locales y dependencias con vulnerabilidades conocidas (`npm audit` sin hallazgos en producción).
- **Corregidos:** falta de cabeceras de seguridad, sin límite de uso en la ruta de la IA y mensajes internos de la base de datos visibles para el usuario.
- **Pendientes y aceptados en el prototipo:**
  - El **modo de revisión** deja que cada cuenta nueva elija su rol (nunca administrador). Debe apagarse al terminar la revisión; ver `docs/access-matrix.md`.
  - Los 5 usuarios de prueba comparten una contraseña conocida por el equipo.
  - Los intentos fallidos de inicio de sesión no quedan en la auditoría propia (solo en los registros de Supabase Auth).
  - No hay una política de contenido (CSP) completa para scripts; requiere identificadores únicos por solicitud.

## 4. Otras limitaciones técnicas

- La IA usa un modelo de terceros: puede equivocarse y tarda 30 a 40 segundos con una cola completa. Sus respuestas se validan, pero una sugerencia válida puede ser mala.
- La lista carga como máximo 200 casos por pantalla.
- Las sugerencias de IA se vuelven a calcular completas en cada corrida; no hay análisis incremental.
