# Usuarios de prueba (solo desarrollo)

Se crean con `npm run db:users`. Ya quedan confirmados y no se envía correo de validación. El script es idempotente: si se vuelve a correr, los recrea.

La contraseña **no está en el repositorio**. Es la misma para los 5 usuarios y vive en `.env.local`, en la variable `SEED_TEST_PASSWORD`.

| Correo | Rol | Alcance | Qué debería ver |
|---|---|---|---|
| analista.cl@altamar-demo.com | analyst | Chile | 7 discrepancias, 60 empleados |
| analista.mx@altamar-demo.com | analyst | México | 3 discrepancias, 55 empleados |
| lider.andina@altamar-demo.com | regional_lead | Región Andina (Chile, Perú) | 10 discrepancias, 105 empleados |
| gerente.global@altamar-demo.com | global_manager | Todos | 13 discrepancias, 220 empleados, sin cuarentena |
| admin@altamar-demo.com | admin | Todos + cuarentena + auditoría | 13 discrepancias, 7 en cuarentena |

Los conteos corresponden al seed con semilla fija (`npm run db:reset`) y quedaron verificados iniciando sesión con cada usuario contra RLS.

Con datos reales, estas cuentas no existirían: el alta sería con SSO corporativo (ver `docs/limitations.md`).
