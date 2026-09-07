# Operación de colaboración

La colaboración se habilita gradualmente mediante `COLLABORATION_ENABLED`. El acceso efectivo también exige la capacidad `collaboration.realtime` del workspace y membresía activa.

Los leases de presencia y edición se consideran expirados por `expiresAt`; un conflicto optimista debe responder 409. Los eventos de presupuesto deben incluir `requestId` cuando la operación pueda reintentarse. Para rollback operativo, deshabilitar primero el flag y conservar las migraciones aditivas.
