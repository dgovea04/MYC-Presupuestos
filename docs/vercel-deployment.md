# Checklist de despliegue y migraciones — producción

Esta checklist aplica al despliegue de MC Presupuestos en Vercel con PostgreSQL y Prisma. No ejecutar migraciones directamente desde una máquina local si no se está usando deliberadamente la base de datos de producción y un canal seguro para los secretos.

## 1. Identificar el release

- [ ] Confirmar el commit exacto que se desplegará y que contiene los archivos de `prisma/migrations`.
- [ ] Confirmar que el proyecto de Vercel apunta al repositorio, rama y proyecto correctos.
- [ ] Confirmar el dominio canónico y la URL de retorno de autenticación.
- [ ] Anunciar la ventana de mantenimiento si la migración puede afectar operaciones activas.
- [ ] Confirmar que existe un backup reciente de PostgreSQL y que se conoce el procedimiento de restauración.
- [ ] Confirmar quién autoriza el despliegue, la migración y un eventual rollback.

## 2. Gates locales o de CI

Ejecutar sobre el mismo commit del release:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Antes de producción, ejecutar también las pruebas E2E contra Preview o staging, nunca contra datos reales sin un plan explícito:

```bash
npm run test:e2e
```

El build no debe depender del fallback de cifrado. Si aparece el aviso de `ENCRYPTION_KEY`, detener el release y corregir la configuración.

## 3. Variables de entorno de Vercel

Configurar los valores en **Production**. Configurar valores aislados en **Preview** si se ejecutan allí migraciones, pruebas E2E o cron jobs. Nunca reutilizar una base de datos de producción en Preview.

### Obligatorias para el núcleo de la aplicación

```env
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://<dominio-canonico>
NEXT_PUBLIC_APP_URL=https://<dominio-canonico>
ENCRYPTION_KEY=
CRON_SECRET=
```

Controles:

- [ ] `DATABASE_URL` apunta exclusivamente a PostgreSQL de producción.
- [ ] `AUTH_SECRET` y `NEXTAUTH_SECRET` son secretos largos, aleatorios, estables y se conservan durante el rollback. Para evitar ambigüedad, configurar ambos con el mismo valor.
- [ ] `ENCRYPTION_KEY` es una clave dedicada y estable, distinta de los secretos de sesión. No cambiarla sin un plan de re-encriptación: las API keys cifradas con una clave anterior dejarían de poder descifrarse.
- [ ] `CRON_SECRET` es aleatorio y no aparece en URLs, logs, tickets ni capturas.
- [ ] Las URLs usan `https://` y no terminan con una ruta inesperada.

Generar secretos fuera del repositorio y del historial de comandos, por ejemplo con un gestor de secretos o un generador criptográficamente seguro. No colocar valores reales en `.env.example`, documentación ni commits.

### Correo y alertas

Necesarias para verificación de correo, recuperación de contraseña, alertas administrativas y contacto:

```env
RESEND_API_KEY=
EMAIL_FROM=
CONTACT_TO=
```

- [ ] El dominio remitente está verificado en Resend.
- [ ] `EMAIL_FROM` usa un remitente permitido por Resend.
- [ ] `CONTACT_TO` apunta al buzón operativo correcto.
- [ ] Se confirma la recepción de un correo de verificación, recuperación y alerta administrativa.

### Stripe, si la facturación está habilitada

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
```

- [ ] `STRIPE_SECRET_KEY` corresponde al modo correcto (live en producción, test en Preview).
- [ ] `STRIPE_WEBHOOK_SECRET` corresponde exactamente al endpoint desplegado.
- [ ] `STRIPE_PRICE_PRO_MONTHLY` existe en la cuenta Stripe correcta.
- [ ] El webhook está configurado para la URL de producción y sus eventos necesarios.

### Google OAuth, si está habilitado

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] El origen autorizado coincide con `NEXTAUTH_URL`.
- [ ] El redirect URI incluye `https://<dominio-canonico>/api/auth/callback/google`.
- [ ] Las credenciales son de producción y no las de desarrollo.

### IA y servicios opcionales

Configurar al menos un proveedor cloud si se ofrecerán funciones de IA en producción:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Los valores no utilizados pueden omitirse. Las funciones locales no deben intentar conectarse desde Vercel:

```env
NEXT_PUBLIC_PLATFORM_RUNTIME=web
MYC_ENABLE_LOCAL_SERVICES=false
NEXT_PUBLIC_ENABLE_LOCAL_SERVICES=false
AUTO_MIGRATE_WORKFLOWS=false
```

`AUTO_MIGRATE_WORKFLOWS=true` solo debe habilitarse de forma deliberada, con `DATABASE_URL` correcto y una ventana controlada. Como alternativa, ejecutar la sincronización de workflows manualmente una vez:

```bash
npm run migrate:workflows
```

### Pago manual con Yape, si se muestra en producción

```env
NEXT_PUBLIC_YAPE_ACCOUNT_NAME=
NEXT_PUBLIC_YAPE_PRO_AMOUNT=
NEXT_PUBLIC_YAPE_PHONE=
NEXT_PUBLIC_YAPE_QR_IMAGE_URL=
```

## 4. Preparar y aplicar migraciones Prisma

Las migraciones recientes incluyen `20260815190000_add_commercial_beta_access` y `20260816100000_add_beta_applications`. Prisma debe aplicar todas las migraciones pendientes en orden; no ejecutar `migrate dev`, `db push` ni `migrate reset` contra producción.

Antes de aplicar el esquema en staging o producción, ejecutar el preflight sin exponer secretos:

```bash
npm run check:deployment -- --target=staging
# antes de promover a producción:
npm run check:deployment -- --target=production
```

El comando debe finalizar con `Deployment readiness: READY`. Las advertencias no bloquean técnicamente el proceso, pero deben quedar revisadas por el responsable del release.

### Antes de migrar

- [ ] Verificar que la base de datos es PostgreSQL de producción y que hay conectividad desde el entorno autorizado.
- [ ] Tomar backup y comprobar que se puede localizar o restaurar.
- [ ] Revisar el SQL de las migraciones nuevas, especialmente cambios destructivos, índices y operaciones que puedan bloquear tablas.
- [ ] Confirmar que el release de aplicación es compatible con el esquema durante toda la ventana de migración.
- [ ] Pausar jobs manuales o despliegues concurrentes que puedan ejecutar otra migración.

### Aplicación

Desde un entorno seguro con las variables de producción cargadas:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

Para la campaña Beta, el smoke test posterior debe confirmar además que `beta_applications` y su índice único parcial existen, que una solicitud queda en `PENDING`, y que la aprobación crea un `BetaGrant` Pro de 60 días sin crear una `BillingSubscription`.

- [ ] `migrate deploy` finaliza sin error.
- [ ] `migrate status` confirma que no quedan migraciones pendientes.
- [ ] La tabla `_prisma_migrations` registra el último migration id esperado.
- [ ] Las tablas, índices y columnas de seguridad nuevas existen.
- [ ] Se revisan los logs de PostgreSQL y no hay errores de constraint o timeout.

En una instalación inicial, cargar solo los catálogos/base de producción y evitar los usuarios y proyectos demo:

```bash
SEED_DEMO_DATA=false npm run prisma:seed
```

Ejecutar el seed inicial únicamente con aprobación y después de verificar su idempotencia en el entorno. No ejecutar el seed demo en producción.

Crear el administrador oficial solo si todavía no existe, usando variables temporales del gestor de secretos:

```bash
ADMIN_EMAIL=admin@<dominio> \
ADMIN_PASSWORD='<secreto-temporal>' \
ADMIN_NAME='Administrador' \
ADMIN_COMPANY_NAME='<empresa>' \
npm run admin:create
```

- [ ] Confirmar que `ADMIN_EMAIL` es la identidad que debe recibir el perfil principal.
- [ ] En el código actual, solo el correo primario definido en `prisma/create-admin.ts` recibe `SUPER_ADMIN`; cualquier otro correo recibe `ADMIN`. Verificar este punto antes de crear el primer administrador.
- [ ] Eliminar las variables temporales del entorno y del gestor de ejecución después de completar la operación.
- [ ] Activar MFA del administrador principal y guardar los códigos de recuperación en un almacén seguro separado.

## 5. Desplegar la aplicación

- [ ] Aplicar primero las migraciones compatibles y después promover el deployment del commit aprobado.
- [ ] Confirmar que el build de Vercel usa Node.js 22 o superior y ejecuta `prisma generate` mediante `postinstall`.
- [ ] Confirmar que los secretos están asignados al entorno **Production**, no solo a Preview.
- [ ] Esperar a que el deployment quede `Ready` y revisar los logs de build y runtime.
- [ ] Verificar que no se publicaron archivos `.env`, backups, tokens ni claves.

## 6. Cron jobs

`vercel.json` registra ambos endpoints con horario `0 8 * * *` (08:00 UTC):

- `/api/cron/reactivate-members`
- `/api/cron/notify-deletion-reminders`

- [ ] Confirmar que el plan y proyecto de Vercel admiten Cron Jobs.
- [ ] Confirmar que `CRON_SECRET` está configurado en Production antes de activar el cron.
- [ ] Confirmar en el panel de Vercel que aparecen los dos jobs y su próximo horario.
- [ ] Confirmar en logs una ejecución exitosa de cada endpoint.
- [ ] Usar el header `Authorization: Bearer <CRON_SECRET>` para pruebas manuales; evitar el parámetro `?secret=` porque puede quedar registrado en URLs y logs.
- [ ] Verificar que los recordatorios notifican, pero no ejecutan eliminaciones permanentes automáticamente.

Prueba manual segura, sin imprimir el secreto:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio-canonico>/api/cron/reactivate-members

curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio-canonico>/api/cron/notify-deletion-reminders
```

Resultados esperados: `401` sin token o con token incorrecto, `500` si falta configuración y `200` con token válido y base de datos disponible.

## 7. Smoke tests post-despliegue

Ejecutar primero con una cuenta de prueba controlada y registrar hora, resultado y deployment id:

### Aplicación y autenticación

- [ ] La página pública y los assets cargan con HTTPS.
- [ ] Registro, verificación de correo, login y logout funcionan.
- [ ] Recuperación y cambio de contraseña funcionan.
- [ ] Login del administrador principal solicita MFA.
- [ ] Un código MFA inválido es rechazado y no aparece información sensible en logs.
- [ ] Google OAuth funciona, si está habilitado.

### Datos y funcionalidades principales

- [ ] Dashboard carga desde la base de datos de producción.
- [ ] Crear y consultar empresa, proyecto, presupuesto, partida, recurso y APU.
- [ ] Totales financieros, decimales y fórmula polinómica se muestran correctamente.
- [ ] Exportaciones PDF y Excel descargan archivos válidos.
- [ ] Colaboración, notas y cronograma cargan sin errores, si están habilitados.
- [ ] Las funciones de IA responden con el proveedor configurado y no intentan usar Ollama ni SQL Server local.

### Administración, facturación y correo

- [ ] Suspender/reactivar una cuenta y revocar sesiones invalidan el acceso esperado.
- [ ] Auditoría registra las acciones administrativas sin guardar contraseñas, tokens ni API keys.
- [ ] Solicitud y doble aprobación de eliminación funcionan con una cuenta de prueba; no ejecutar eliminación permanente sobre un usuario real durante el smoke test.
- [ ] Checkout, portal y webhook de Stripe funcionan, si la facturación está habilitada.
- [ ] Se reciben correos de verificación, recuperación y alerta.

### Cron y observabilidad

- [ ] Los dos endpoints cron responden correctamente con bearer auth.
- [ ] Vercel Runtime Logs no muestra errores 5xx inesperados, fallos de Prisma ni avisos de cifrado.
- [ ] Resend y Stripe muestran los eventos esperados.
- [ ] Se conserva el deployment id, la hora de migración y el resultado de cada smoke test.

## 8. Rollback e incidentes

### Rollback de aplicación

- [ ] Si falla el runtime pero el esquema es compatible, promover el deployment anterior desde Vercel.
- [ ] Mantener `AUTH_SECRET`, `NEXTAUTH_SECRET` y `ENCRYPTION_KEY` sin cambios durante el rollback.
- [ ] No hacer rollback ciego si el nuevo release requiere columnas que el release anterior no conoce o si una migración fue destructiva.

### Rollback de base de datos

Las migraciones Prisma aplicadas deben tratarse como forward-only:

- [ ] No ejecutar `prisma migrate reset`, `prisma db push` ni borrar filas/tablas manualmente para “deshacer” un release.
- [ ] Si una migración falla, conservar logs y el estado de `_prisma_migrations`; no marcarla como aplicada manualmente sin un plan revisado.
- [ ] Para datos dañados o cambios incompatibles, detener tráfico si es necesario, evaluar restauración del backup y coordinar una migración correctiva hacia adelante.
- [ ] Después de restaurar, ejecutar `migrate status`, revisar integridad y repetir smoke tests antes de reabrir operaciones.

### Cierre del incidente

- [ ] Revocar secretos expuestos y rotar únicamente los que no rompan sesiones o cifrado, siguiendo un plan explícito.
- [ ] Registrar causa raíz, deployment id, migration ids, usuarios afectados y acciones ejecutadas.
- [ ] Confirmar que no quedaron cron jobs duplicados ni deployments apuntando a la base de datos equivocada.
