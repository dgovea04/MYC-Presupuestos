# Especificación de seguridad y tenancy

## Guard central

Crear `lib/knowledge/authorization.ts` con funciones de servicio:

```ts
assertKnowledgeReadAccess(actorUserId, context): Promise<AuthorizedKnowledgeContext>;
assertKnowledgeWriteAccess(actorUserId, context): Promise<AuthorizedKnowledgeContext>;
assertKnowledgeEntityAccess(actorUserId, entityRef): Promise<AuthorizedEntityContext>;
```

El guard validará membership activa, role mínimo, project/company relationship, scope y pertenencia de source/evidence/canonical/observation. `GLOBAL` requiere superadmin para escritura/promoción; lectura puede incluirse sólo tras verificar política pública.

## Reglas de endpoint

- POST observations: eliminar confianza en `companyId/projectId/scope/userId` del cliente; Review bridge fija PROJECT. APIs humanas resuelven scope desde entidad y membership.
- POST sources/evidence: exigir contexto tenant, actor y validar fuente antes de insertar evidencia.
- GET items/resources/retrieval: resolver workspace desde sesión o validar query mediante membership antes de consultar.
- aliases: cargar entidad con ownership y aplicar guard central; resource GLOBAL también requiere superadmin.
- internal services: repetir guard en service boundary, no sólo en route handler.

## Pruebas obligatorias

- usuario A no crea/lee/escribe datos COMPANY de B;
- usuario A no crea/lee PROJECT de B aunque envíe `companyId` falso;
- usuario no puede asociar evidence de otro tenant;
- editor no puede escribir GLOBAL;
- una ruta no crea filas si el guard falla;
- actor no puede escribir USER de otro usuario;
- proyectos inexistentes o cruzados devuelven 403/404 indistinguible según política.

## No regresión

Las restricciones no deben bloquear GLOBAL read-only legítimo ni la lectura de datos existentes del propio workspace. No se usará Prisma directo desde componentes UI.
