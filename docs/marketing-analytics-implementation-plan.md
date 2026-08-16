# Plan de implementación de Marketing Analytics — MC Presupuestos

> **Nota:** el archivo `plan-marketing-MC-Presupuestos.md` indicado en el plan original no está disponible dentro del repositorio actual. Este documento contiene el bloque técnico listo para incorporarlo allí cuando el archivo esté disponible.

## 1. Objetivo

Implementar medición confiable para el funnel:

```text
Visitantes → Signup → Activated → WAU/WAB → Pro
```

La instrumentación debe permitir responder semanalmente:

1. ¿De qué canales llegan los visitantes?
2. ¿Qué porcentaje inicia y completa el registro?
3. ¿Qué acciones producen activación?
4. ¿Qué usuarios regresan y trabajan con un presupuesto?
5. ¿Qué comportamiento precede a una conversión a Pro?
6. ¿Qué campañas generan usuarios activados y clientes, no solamente tráfico?

Google Analytics 4 será la capa de comportamiento web y adquisición. Los datos de facturación y suscripción confirmada seguirán teniendo como fuente de verdad la base de datos y Stripe/webhooks.

---

## 2. Estado actual del repositorio

Antes de implementar:

- `lib/analytics/events.ts` ya define eventos de onboarding, pero `trackServerEvent` es actualmente un no-op.
- Ya existen integraciones de eventos en:
  - creación del proyecto demo;
  - creación del primer proyecto no demo;
  - exportación de un proyecto demo.
- Las rutas de proyectos y exportaciones ya protegen la operación principal para que un error de analytics no provoque un error al usuario.
- No existe una integración de Google Analytics 4.
- No se debe instalar una librería adicional para GA4 inicialmente. Se usará `next/script`, que ya forma parte de Next.js.

La implementación debe extender el helper existente, no crear un segundo sistema de tracking paralelo.

---

## 3. Arquitectura propuesta

### 3.1 Capas

| Capa | Responsabilidad | Ubicación propuesta |
|---|---|---|
| Google Analytics bootstrap | Cargar GA4 y configurar consentimiento | `components/analytics/google-analytics.tsx` |
| Tracking cliente | Enviar eventos de navegación e interacción | `lib/analytics/client.ts` |
| Atribución | Leer y conservar UTMs | `lib/analytics/utm.ts` |
| Contrato de eventos | Nombres, payloads y versión | `lib/analytics/events.ts` |
| Tracking servidor | Eventos confirmados por API/webhook | `lib/analytics/events.ts` o adapter separado |
| Pruebas | Verificar nombre, payload y ausencia de duplicados | Tests junto a cada módulo |

### 3.2 Flujo de datos

```text
URL con UTM
   ↓
Captura first-touch y last-touch
   ↓
GA4 recibe landing_view y eventos de interacción
   ↓
Usuario se registra
   ↓
Se asigna user_id opaco, nunca email ni nombre
   ↓
Eventos de producto desde UI/API
   ↓
Eventos de pago confirmados desde Stripe/webhook
   ↓
GA4 DebugView + reportes semanales + fuente de verdad de facturación
```

### 3.3 Variables de entorno

Agregar a `.env.example` y configurar en los entornos correspondientes:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
GA_API_SECRET=""
# Opcionales para reportes server-side en /admin
GA4_PROPERTY_ID=""
GA4_SERVICE_ACCOUNT_EMAIL=""
GA4_SERVICE_ACCOUNT_PRIVATE_KEY=""
```

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: puede exponerse al navegador.
- `GA_API_SECRET`: solo servidor; nunca debe aparecer en componentes cliente, logs ni respuestas HTTP.
- En desarrollo y tests, si no existe el Measurement ID, el helper debe ser un no-op silencioso.

`GA_API_SECRET` solo es necesario para eventos servidor que deban llegar directamente a GA4 mediante Measurement Protocol. No se debe usar desde el navegador.

`GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_EMAIL` y `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` habilitan la lectura server-side de reportes GA4 en `/admin`. El Property ID es numérico y la cuenta de servicio debe tener permiso Viewer sobre la propiedad. La clave privada nunca se envía al navegador.

`STRIPE_PRO_MONTHLY_AMOUNT_PEN_CENTIMOS` es opcional y, para el precio anual actual, debe configurarse con el equivalente mensual verificado del plan Pro en centimos de PEN (precio anual dividido entre 12). Si no existe, el panel muestra MRR como no disponible en lugar de estimarlo desde `stripePriceId`.

---

## 4. Contrato común de eventos

Todos los eventos deben cumplir estas reglas:

- nombres en `snake_case`;
- versión explícita: `event_version: "1"`;
- emisión únicamente después de que la acción haya sido exitosa;
- no enviar datos personales ni contenido técnico del presupuesto;
- no bloquear la operación principal si GA4 no está disponible;
- evitar duplicados cuando una pantalla se renderiza nuevamente;
- incluir atribución cuando exista.

### 4.1 Parámetros comunes

Enviar solo los parámetros necesarios para no saturar los límites de GA4:

| Parámetro | Uso |
|---|---|
| `event_version` | Evolución compatible del contrato |
| `page_path` | Página donde se produjo el evento |
| `plan` | `starter`, `pro`, `empresa` o `unknown` |
| `is_demo` | Distinguir onboarding demo de trabajo real |
| `utm_source` | Fuente de adquisición |
| `utm_medium` | Medio de adquisición |
| `utm_campaign` | Campaña |
| `utm_content` | Variante creativa |
| `attribution_scope` | `first_touch` o `last_touch` |

No enviar a GA4:

- email;
- nombre de usuario o empresa;
- RUC;
- nombre de proyecto;
- montos, costos o precios de partidas;
- contenido de APU, metrados o fórmulas;
- prompts o respuestas de Khipu;
- API keys, tokens o identificadores de pago sensibles.

El `user_id` de GA4 puede ser un identificador interno opaco, siempre que no contenga email, teléfono, nombre ni otro dato personal directo.

---

## 5. Diccionario de eventos

### 5.1 Adquisición y registro

| Evento | Momento exacto | Parámetros específicos | Fuente |
|---|---|---|---|
| `landing_view` | Primera carga de una landing pública, una vez por visita/página | `landing_path`, `landing_variant` | Cliente |
| `signup_started` | Usuario hace clic en CTA de registro o enfoca/inicia el formulario | `cta_location`, `landing_path` | Cliente |
| `signup_completed` | Registro creado correctamente y API devuelve éxito | `registration_method`, `demo_status` | Servidor; la UI no lo reemite |
| `pricing_viewed` | Sección de precios visible al menos 50% durante 1 segundo | `pricing_variant`, `plan_highlighted` | Cliente |
| `upgrade_clicked` | Clic en CTA que lleva a `/account` o checkout | `source_location`, `target_plan` | Cliente |

**Regla de registro:** `signup_completed` no significa activación. Solo confirma creación de cuenta. Debe emitirse una sola vez desde el resultado exitoso de la API; la UI puede usar la respuesta para redirigir, pero no debe duplicar el evento.

### 5.2 Activación y uso del producto

| Evento | Momento exacto | Parámetros específicos | Fuente |
|---|---|---|---|
| `project_created` | Proyecto creado y persistido | `is_demo`, `creation_source` | API |
| `budget_created` | Presupuesto creado y persistido | `budget_kind`, `is_demo` | API |
| `budget_imported` | Importación finalizada sin error | `import_source`, `format`, `is_demo` | API |
| `excel_paste_used` | Pegado de datos desde Excel procesado con al menos una fila válida | `row_count_bucket`, `is_demo` | Cliente/API |
| `apu_created` | APU creado o guardado por primera vez | `is_demo`, `creation_source` | API |
| `formula_created` | Fórmula polinómica generada/guardada correctamente | `is_demo`, `source` | API |
| `khipu_used` | Solicitud de Khipu completada con respuesta válida | `action_type`, `provider`, `is_demo` | API |
| `export_completed` | Archivo generado y respuesta de exportación exitosa | `export_target`, `format`, `is_demo` | API |

No contar como `created` una apertura, edición sin guardado o una operación fallida. Para acciones repetibles, registrar el evento de producto, pero calcular activación por usuario único y ventana de tiempo.

### 5.3 Monetización

| Evento | Momento exacto | Parámetros específicos | Fuente |
|---|---|---|---|
| `checkout_started` | Se crea correctamente una sesión de checkout | `provider`, `target_plan`, `billing_period` | Servidor |
| `subscription_created` | Webhook confirma una suscripción nueva y se sincroniza localmente | `provider`, `target_plan`, `subscription_status` | Webhook |

`subscription_created` no debe dispararse únicamente porque el usuario volvió de Stripe. El webhook es la fuente confiable. Si el pago se confirma por otro proveedor, se conserva el mismo evento con `provider` diferente.

### 5.4 Eventos existentes que se deben conservar

Los eventos actuales de onboarding no se reemplazan:

- `demo_project_created`;
- `demo_project_creation_failed`;
- `demo_project_already_exists`;
- `demo_project_opened`;
- `demo_budget_opened`;
- `demo_apu_opened`;
- `demo_formula_opened`;
- `demo_export_completed`;
- `first_non_demo_project_created`.

Se recomienda mantenerlos como eventos internos detallados y usar los eventos generales (`project_created`, `export_completed`, etc.) para el funnel de marketing.

---

## 6. Captura y persistencia de UTMs

### 6.1 Parámetros aceptados

```text
utm_source
utm_medium
utm_campaign
utm_content
```

Opcionalmente se puede conservar `utm_term` para Google Ads, pero no es requisito de la primera fase.

### 6.2 Reglas de atribución

1. En la primera landing, leer los parámetros de la URL.
2. Guardar una copia **first-touch** durante 90 días.
3. Actualizar una copia **last-touch** cada vez que llegue una nueva campaña.
4. Asociar ambas copias a los eventos posteriores.
5. No sobrescribir first-touch con tráfico directo sin UTM.
6. Limitar el valor de cada parámetro a una longitud razonable y eliminar caracteres de control.
7. No guardar UTMs en el perfil visible del usuario.

Implementación sugerida:

- cookie propia `mc_attribution` con `SameSite=Lax`, `Secure` en producción y expiración de 90 días;
- fallback en memoria/localStorage solo para datos no sensibles si las cookies no están disponibles;
- helper puro y testeable para parsear, validar y combinar first-touch/last-touch;
- al autenticarse, enviar las atribuciones al backend si se necesita asociarlas al usuario para reportes internos.

GA4 ya interpreta UTMs para adquisición, pero conservarlas explícitamente permite unir el funnel con registros, activación y suscripciones que ocurren en servidor.

---

## 7. Implementación de Google Analytics 4

### Fase A — Bootstrap

Crear un componente pequeño basado en `next/script` y renderizarlo desde el layout raíz:

1. cargar `gtag.js` con `strategy="afterInteractive"`;
2. inicializar `dataLayer` y `gtag`;
3. usar `NEXT_PUBLIC_GA_MEASUREMENT_ID`;
4. no renderizar scripts si la variable está vacía;
5. respetar el estado de consentimiento antes de habilitar almacenamiento analítico;
6. no lanzar excepciones si el navegador bloquea el script.

No usar `@next/third-parties/google` en la primera versión porque no está instalado y no es necesario para este caso.

### Fase B — Consentimiento

Antes de producción:

- definir si se requiere banner de consentimiento para analytics según la política de privacidad aplicable;
- iniciar Google Consent Mode con `analytics_storage: denied` cuando no exista consentimiento;
- actualizar a `granted` únicamente después de la acción afirmativa del usuario;
- documentar la decisión en la política de privacidad;
- mantener la aplicación funcional si el usuario rechaza analytics.

No se debe crear un banner provisional que no tenga persistencia ni enlace a la política.

### Fase C — Helper de cliente

Crear `lib/analytics/client.ts` con una API tipada similar a:

```ts
trackClientEvent("landing_view", {
  landing_path: "/",
  landing_variant: "default",
});
```

El helper debe:

- verificar que `window.gtag` exista;
- agregar `event_version`, `page_path` y UTMs;
- no usar `any` en TypeScript;
- ignorar errores de red;
- permitir testear `gtag` con un mock;
- evitar enviar dos veces el mismo evento de vista en el mismo montaje.

### Fase D — Identidad

Después de un login o registro exitoso:

- configurar `user_id` con el ID interno opaco del usuario;
- no configurar como `user_id` el email;
- eliminar la identidad al cerrar sesión si el flujo lo requiere;
- no enviar user properties que puedan identificar directamente a una persona.

---

## 8. Instrumentación por etapa

### Día 1 — Contrato y configuración

- [ ] Confirmar Measurement ID de producción, Preview y desarrollo.
- [ ] Crear propiedad GA4 y flujo Web.
- [ ] Definir zona horaria Lima y moneda PEN en GA4.
- [ ] Registrar el diccionario de eventos anterior.
- [ ] Añadir variables a `.env.example`.
- [ ] Extender los tipos de `lib/analytics/events.ts`.
- [ ] Definir la política de consentimiento.

### Días 2–3 — Landing, UTMs y registro

- [ ] Integrar el bootstrap GA4 en el layout raíz.
- [ ] Implementar captura first-touch/last-touch.
- [ ] Medir `landing_view` en la landing pública.
- [ ] Medir `signup_started` en CTAs y formulario.
- [ ] Medir `signup_completed` después de respuesta exitosa.
- [ ] Medir `pricing_viewed` con `IntersectionObserver`, una vez por vista.
- [ ] Configurar `user_id` después de autenticación.

Puntos de integración candidatos del repositorio:

- `components/landing/landing-navbar.tsx`;
- hero y CTA de la landing;
- `components/landing/pricing-section.tsx`;
- formulario de registro y respuesta de `app/api/register/route.ts`.

### Días 4–7 — Activación del producto

- [ ] Completar `project_created` en `app/api/projects/route.ts`.
- [ ] Añadir `budget_created` en las rutas de creación de presupuestos.
- [ ] Añadir `budget_imported` en importaciones MCP, S10, Delphin y RW7.
- [ ] Añadir `excel_paste_used` en el flujo de pegado desde Excel.
- [ ] Añadir `apu_created` al guardar un APU nuevo.
- [ ] Añadir `formula_created` al generar/guardar la fórmula.
- [ ] Añadir `khipu_used` tras una respuesta exitosa de Khipu.
- [ ] Generalizar `export_completed` en `app/api/exports/route.ts`, conservando `demo_export_completed`.
- [ ] Verificar que los eventos se emitan solo después del commit/resultado exitoso.

### Días 8–10 — Monetización

- [ ] Medir `upgrade_clicked` en CTAs de pricing y cuenta.
- [ ] Medir `checkout_started` al crear una sesión de Stripe.
- [ ] Medir `subscription_created` en el webhook después de sincronizar la suscripción.
- [ ] Añadir proveedor, plan y periodo de facturación como parámetros no sensibles.
- [ ] Asegurar idempotencia usando el identificador del evento/webhook existente.
- [ ] No enviar precio, email ni identificadores de cliente de Stripe a GA4.

### Días 11–12 — Dashboard y calidad

- [ ] Crear reportes de adquisición, activación, engagement y revenue.
- [ ] Crear dimensiones personalizadas solo para parámetros que se usarán en reportes.
- [ ] Configurar DebugView y validación en producción.
- [ ] Comparar registros GA4 contra usuarios creados en base de datos.
- [ ] Comparar `subscription_created` contra suscripciones activas de Stripe.
- [ ] Documentar diferencias esperadas por bloqueadores, consentimiento y ad blockers.

---

## 9. Definiciones de métricas

### Visitantes

Usuarios únicos con `landing_view` en el periodo. Para el reporte ejecutivo mostrar también sesiones, pero usar usuarios únicos para la conversión principal.

### Signup

Usuarios únicos con `signup_completed` en el periodo.

```text
Signup rate = signup_completed users / landing_view users
```

### Activated

Usuario que:

1. completó el registro; y
2. dentro de los siguientes 7 días realizó al menos una acción de activación:
   - `project_created` no demo;
   - `budget_created`;
   - `budget_imported`;
   - `excel_paste_used`;
   - `apu_created`;
   - `formula_created`;
   - `export_completed`.

`khipu_used` puede mostrar adopción avanzada, pero no debe ser requisito de activación inicial porque Khipu pertenece a una capa posterior del producto.

```text
Activation rate = activated users / signup_completed users
```

### WAU

Usuarios únicos autenticados que realizaron al menos una acción técnica significativa durante una semana calendario o una ventana móvil de 7 días.

### WAB — North Star recomendada

Presupuestos únicos que recibieron una acción técnica significativa durante la semana. Mantener WAU porque es una métrica de usuario, pero usar WAB para medir valor real del producto.

### Pro

Usuarios o empresas con suscripción Pro activa según la base de datos. GA4 sirve para analizar el camino hasta Pro; Stripe/webhooks determina el número oficial.

```text
Signup → Activated = activated users / signup users
Activated → Pro = new Pro users / activated users
```

Las tasas deben calcularse por cohorte semanal de registro, no mezclando usuarios de diferentes edades.

---

## 10. Dashboard semanal principal

### Vista ejecutiva

| Métrica | Semana actual | Semana anterior | Variación | Fuente |
|---|---:|---:|---:|---|
| Visitantes |  |  |  | GA4 |
| Signup completados |  |  |  | GA4 + BD |
| Tasa landing → signup |  |  |  | GA4 |
| Activados |  |  |  | GA4 + eventos servidor |
| Tasa signup → activation |  |  |  | GA4 |
| WAU |  |  |  | GA4 |
| WAB |  |  |  | BD/eventos |
| Upgrade clicked |  |  |  | GA4 |
| Checkout started |  |  |  | Stripe + GA4 |
| Pro nuevos |  |  |  | Stripe/BD |
| MRR |  |  |  | Stripe/BD |

### Cortes obligatorios

- `utm_source`;
- `utm_medium`;
- `utm_campaign`;
- landing page;
- método de registro;
- cohorte de signup;
- plan;
- demo vs proyecto real;
- importación vs creación manual.

### Implementación del dashboard

**Fase 1:** GA4 Explorations para validar el esquema y operar las primeras semanas.

**Fase 2:** Looker Studio o dashboard interno cuando se necesite combinar GA4, base de datos y Stripe. La fuente de revenue no debe depender de una métrica aproximada de GA4.

El dashboard semanal debe mostrar también:

- top 3 problemas de conversión;
- top 3 experimentos activos;
- top 3 aprendizajes de entrevistas;
- canal con más activaciones, no solo más visitantes.

---

## 11. Plan de pruebas y validación

### Tests automatizados

- [ ] `utm.ts`: parsea UTMs válidas, rechaza valores excesivos y conserva first-touch.
- [ ] `client.ts`: llama a `gtag` con nombre y parámetros correctos.
- [ ] Helper sin `window.gtag`: no lanza error.
- [ ] `landing_view` no se duplica por re-render.
- [ ] Rutas de creación emiten eventos solo cuando la operación tiene éxito.
- [ ] Fallo de analytics no cambia el status HTTP de una operación exitosa.
- [ ] `checkout_started` se emite solo si Stripe devuelve una sesión válida.
- [ ] `subscription_created` es idempotente en reintentos del webhook.
- [ ] No se incluyen emails, nombres, RUC ni montos en payloads.

### QA manual

1. Abrir una URL con UTMs.
2. Verificar `landing_view` en GA4 DebugView.
3. Navegar a pricing y confirmar `pricing_viewed` una sola vez.
4. Completar registro y confirmar `signup_started` y `signup_completed`.
5. Crear un proyecto y presupuesto.
6. Importar un archivo o usar pegado Excel.
7. Crear APU y fórmula.
8. Usar Khipu y exportar.
9. Iniciar checkout sin completar pago.
10. Completar una suscripción de prueba y verificar el webhook.
11. Comparar GA4 con la base de datos y Stripe.
12. Repetir con consentimiento rechazado y confirmar que la aplicación sigue funcionando.

### Validación de calidad en GA4

- usar DebugView en desarrollo/Preview;
- revisar Realtime en producción;
- esperar el procesamiento normal antes de comparar reportes agregados;
- crear una anotación por cada cambio de contrato;
- no cambiar nombres de eventos después de publicar sin definir migración.

---

## 12. Criterios de aceptación

La Fase I queda completa cuando:

- [ ] GA4 recibe `landing_view` en la landing pública.
- [ ] Los 15 eventos definidos en el plan están tipados y tienen un punto de emisión.
- [ ] UTMs first-touch y last-touch se conservan correctamente.
- [ ] El registro puede relacionarse con eventos posteriores mediante un `user_id` no personal.
- [ ] Activation puede calcularse con una ventana de 7 días.
- [ ] `subscription_created` proviene de confirmación de servidor/webhook.
- [ ] Los errores de analytics nunca interrumpen registro, creación, importación, exportación o checkout.
- [ ] El dashboard muestra Visitantes → Signup → Activated → WAU/WAB → Pro.
- [ ] Se puede comparar al menos una semana de datos por `utm_source`, `utm_medium` y `utm_campaign`.
- [ ] Los tests y `npm run lint` / `npm run typecheck` pasan.
- [ ] No se envían datos personales ni financieros sensibles a GA4.

---

## 13. Orden recomendado de implementación

1. Contrato de eventos y política de datos.
2. Variables de entorno y propiedad GA4.
3. Bootstrap GA4 con consentimiento.
4. UTMs y helper cliente.
5. Landing, pricing y registro.
6. Eventos de activación en APIs y componentes existentes.
7. Eventos de checkout y webhook.
8. Tests automatizados y DebugView.
9. Dashboard semanal.
10. Primera revisión de cohortes y ajuste del onboarding.

No invertir significativamente en publicidad hasta tener al menos una semana de datos confiables y verificar que `signup_completed`, activación y Pro puedan reconciliarse con la base de datos.

---

## 14. Panel interno para administración

La primera versión del panel interno está disponible en `/admin`, dentro de una sección llamada **Marketing Analytics**. Esta sección muestra:

- Visitantes, Signup, Activated, WAU, WAB y Pro activos;
- tasas `Visitantes → Signup`, `Signup → Activated` y `Activated → Pro`;
- `upgrade_clicked`, `checkout_started` y `subscription_created`;
- desglose de registros y activaciones por `utm_source`, `utm_medium`, `utm_campaign` y `utm_content` first-touch;
- filtro de fechas de 1 a 90 días;
- cohortes semanales de signup con activación y retención W1, W4 y W8;
- descarga CSV del funnel, atribución UTM y cohortes para la reunión semanal;
- reconciliación interna contra usuarios, proyectos, presupuestos y BillingSubscription;
- salud de instrumentación con eventos faltantes, signup sin UTM, eventos anónimos y posibles duplicados;
- alertas accionables con severidad para diferencias de reconciliación y problemas del funnel;
- ranking de primera acción técnica posterior al signup para identificar el aha moment;
- recomendación de flujo de onboarding basada en la acción líder;
- conversión Activated → Pro, suscripciones nuevas, Pro activos, cancelaciones observadas, suscripciones en riesgo y MRR cuando el importe mensual está configurado explícitamente.

La fuente del panel es la tabla interna `marketing_events`, mientras que las suscripciones Pro activas se consultan desde `BillingSubscription`. La sección de monetización usa `BillingSubscription` para conteos y deduplica usuarios nuevos. La cancelación observada usa cambios a `CANCELED` registrados en el rango y no se presenta como churn histórico completo porque el modelo actual no conserva snapshots diarios. MRR solo se calcula con el equivalente mensual explícito en `STRIPE_PRO_MONTHLY_AMOUNT_PEN_CENTIMOS`; para Pro anual se debe documentar la conversión desde el precio anual. `stripePriceId` por sí solo no contiene un importe confiable. GA4 continúa siendo la fuente externa para adquisición detallada, Realtime, DebugView y Explorations. Las dimensiones UTM se agrupan por la combinación completa de fuente, medio, campaña y contenido para evitar mezclar creatividades distintas. Las cohortes se calculan por semana UTC de registro y solo muestran W1/W4/W8 cuando la ventana de retención ya está madura.

La migración `20260815100000_add_marketing_events` debe aplicarse en cada entorno antes de usar el panel. Si la migración no está aplicada, las operaciones principales siguen funcionando, pero los eventos internos no podrán persistirse.

Los eventos cliente solo se persisten después de aceptar analytics y utilizan un `clientId` anónimo. La descarga CSV requiere capacidad administrativa `users.read`, aplica rate limit y no incluye datos personales ni contenido de presupuestos. La reconciliación marca cada métrica como `Coincide` o `Revisar` comparando eventos únicos contra las fuentes oficiales. GA4 se consulta opcionalmente desde el servidor mediante GA4 Data API cuando se configuran las credenciales de lectura. Los eventos servidor guardan únicamente parámetros permitidos y no incluyen emails, RUC, nombres de proyectos, montos, contenido de APU, fórmulas ni prompts de Khipu.
