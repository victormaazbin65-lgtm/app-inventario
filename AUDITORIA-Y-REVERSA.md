# Auditoría segura 1.0.7

Esta rama corrige riesgos de consistencia sin migrar, borrar ni reescribir los datos existentes de Firebase. La lógica de SAT se conserva: cuando se solicita factura, el sistema mantiene el cálculo actual del 5 %.

## Qué cambia

- Ventas, conversiones de cotizaciones y retiros actualizan inventario, fondos, historial y resumen mensual dentro de transacciones de Firestore.
- Si falta conexión o una transacción falla, no se aplica un reemplazo local parcial. El carrito o formulario permanece disponible para reintentar.
- Las anulaciones de ventas nuevas son bajas lógicas (`anulada: true`); no se borran ventas.
- Los ingresos nuevos guardan stock y costo antes/después. Solo pueden editarse o anularse si ningún movimiento posterior cambió esos productos.
- Los registros anteriores a 1.0.7 permanecen visibles e intactos, pero su reversión automática se bloquea porque no contienen información suficiente para reconstruir costos y resúmenes exactamente.
- El reporte completo descarga todas las ventas y retiros antes de exportar cuando existe conexión.
- Se corrigen `version.json`, iconos, manifest y caché PWA. La limpieza de actualización afecta solamente Cache Storage y Service Workers; nunca elimina `localStorage` ni Firestore.
- Se validan números finitos, cantidades, costos negativos y ventas por Q 0.00.
- Se escapan datos dinámicos en los principales historiales y vistas para reducir inyección de HTML.
- Se agrega un retiro inteligente opcional sin eliminar los cuatro retiros manuales. Puede retirar un monto priorizando ganancia, luz/tinta y productos sin tocar SAT; retirar solo ganancia; o retirar toda la caja con advertencia explícita. El desglose y los cuatro fondos se registran en una sola transacción de Firestore.

## Compatibilidad de datos

No hay una migración destructiva. Los documentos nuevos agregan campos compatibles como `versionCalculo`, `resumenMensualContabilizado`, `costoUnitarioReal`, `aplicadoEn`, `stockAntes`, `costoAntes`, `stockDespues` y `costoDespues`. El código sigue leyendo los registros antiguos para mostrarlos y reportarlos.

## Verificación antes de publicar

1. Mantener `main` sin cambios hasta aprobar esta rama.
2. Ejecutar `node --experimental-vm-modules --test tests/*.test.mjs`.
3. Probar en un proyecto Firebase de ensayo: ingreso, venta, cotización a venta, retiro, anulación inmediata y rechazo de anulación después de otro movimiento.
4. Confirmar en dos dispositivos que una venta simultánea con stock insuficiente deja pasar solo una operación.
5. Probar los tres modos de retiro en Firebase de ensayo y confirmar que un cambio simultáneo de fondos cancela el retiro antes de escribir.
6. Hacer una exportación o respaldo administrado de Firestore antes del despliegue. No usar datos reales para pruebas destructivas.

## Cómo regresar

Si la rama todavía no se ha fusionado, basta con no fusionarla y continuar usando `main`.

Si ya se fusionó, se debe revertir el commit de fusión en GitHub y publicar el código anterior como una versión nueva, por ejemplo `1.0.8`. No conviene bajar el número a `1.0.6`, porque algunos dispositivos podrían conservar la caché de 1.0.7. En el código anterior se cambian de forma coordinada:

- `APP_VERSION` en `index.html` a `1.0.8`;
- `version` en `version.json` a `1.0.8`;
- `CACHE_NAME` en `sw.js` a `sublicosturas-v1.0.8`.

Esta reversa de código no requiere restaurar la base de datos: la rama no ejecuta migraciones ni borrados masivos. No se debe reemplazar Firestore con una copia antigua salvo que exista evidencia independiente de corrupción y un respaldo verificado.

## Fuera de esta rama

No se cambia Firebase Authentication ni Firestore Security Rules. Esa mejora necesita revisar las reglas reales y diseñar una migración de acceso para no bloquear a los usuarios actuales. Tampoco se reactiva el bloqueo por inactividad ni se divide todavía el archivo principal; son fases separadas para no mezclar cambios de comportamiento con las correcciones contables.
