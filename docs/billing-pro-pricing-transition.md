# Transición de precio Pro

## Oferta activa

- Oferta: `PRO_ANNUAL_FOUNDER`
- Precio fundador: **S/ 299/año**
- Precio normal futuro: **S/ 349/año**
- Cadencia: anual
- Monto Yape: **S/ 299.00**
- Metadata Stripe: `offer=founder`, `plan=pro`, `price_amount=299`

La landing comunica que el precio fundador está dirigido a los primeros usuarios Pro y que luego será S/ 349/año. No se comunica como precio permanente ni como precio de por vida.

## Configuración requerida

Crear en Stripe un precio recurrente anual de S/ 299 y configurar:

```env
STRIPE_PRICE_PRO_ANNUAL_FOUNDER=price_...
NEXT_PUBLIC_YAPE_PRO_AMOUNT=S/ 299.00
```

El precio de Stripe debe pertenecer a la misma cuenta y modo (test/live) que `STRIPE_SECRET_KEY`. El webhook sigue siendo obligatorio para confirmar y sincronizar suscripciones.

## Transición al precio normal

Cuando termine la oferta:

1. Crear o identificar el precio recurrente anual de S/ 349 en Stripe.
2. Reemplazar `STRIPE_PRICE_PRO_ANNUAL_FOUNDER` por la variable operativa del precio normal, por ejemplo `STRIPE_PRICE_PRO_ANNUAL`.
3. Cambiar el copy de la landing para retirar el mensaje fundador y mostrar S/ 349/año como precio vigente.
4. Actualizar `NEXT_PUBLIC_YAPE_PRO_AMOUNT` a `S/ 349.00`.
5. Mantener la metadata histórica de las suscripciones ya creadas.
6. Ejecutar checkout y Yape en staging antes de promover el cambio.

El código actual deja la variable fundadora explícita para que el cambio sea intencional. Cambiar la variable solo afecta nuevos checkouts; las suscripciones existentes conservan el precio Stripe asociado. Antes de la primera renovación de usuarios fundadores debe definirse comercialmente si conservan S/ 299 mientras continúen activos o si el precio fundador aplica únicamente al primer año. Esa decisión debe reflejarse en la comunicación y en una migración de suscripciones si fuera necesaria.

## Validación posterior

- Landing: `S/ 299/año`, `Luego S/ 349/año`, `precio fundador anual`.
- Checkout: usa `STRIPE_PRICE_PRO_ANNUAL_FOUNDER` y `billing_period=annual`.
- Stripe: metadata `offer`, `plan` y `price_amount` presentes en Checkout Session y suscripción.
- Yape: muestra `S/ 299.00` y `PRO_ANNUAL_FOUNDER`.
- Admin: solicitudes manuales identificadas como `PRO_ANNUAL_FOUNDER` y activación por un año.
