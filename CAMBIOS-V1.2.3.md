# Cambios de SubliCosturas v1.2.3

Esta versión refuerza integridad y concurrencia sin borrar, renombrar ni migrar documentos existentes. La interfaz superior/lateral, Clientes dentro de Configuración, Caja dentro de Finanzas y el buscador integrado se conservan.

## Integridad de ventas y devoluciones

- Las ventas nuevas guardan un identificador inmutable por línea, la cantidad original y sus totales asignados en centavos.
- Las devoluciones fraccionarias reparten los centavos de manera acumulativa; al devolver toda una línea, la suma siempre coincide exactamente con el total original.
- Una devolución se cancela si la venta fue anulada, cambió de revisión o la línea ya no coincide con la que confirmó el usuario.
- La misma transacción actualiza venta, cliente, fondos, efectivo o banco, movimiento de caja, inventario, anticipo y resumen mensual.
- Si falta el resumen mensual que una venta declara haber contabilizado, no se aplica una devolución parcial.
- Los anticipos restaurados conservan un método de salida válido.

## Clientes, cantidades y caja

- El crédito pendiente se consulta independientemente del límite visual de las últimas 50 ventas.
- Los clientes mantienen saldos resumidos de crédito y anticipos para impedir que se archiven durante una operación concurrente.
- Las unidades fraccionables respetan el paso configurado y admiten como máximo tres decimales.
- El contenido por lote se valida con la unidad del producto; una pieza ya no acepta media pieza por paquete.
- Los movimientos monetarios rechazan montos menores de Q 0.01 o con más de dos decimales.
- Las pérdidas toman el costo vigente del producto dentro de la transacción, no el valor posiblemente antiguo de la pantalla.

## Robustez y rendimiento

- Se retiró la migración v10 automática que podía reemplazar la configuración moderna durante el arranque.
- Los respaldos rechazan versiones futuras desconocidas y conteos internos que no coinciden.
- Un `localStorage` dañado ya no impide iniciar la aplicación.
- La búsqueda de hasta 50,000 archivos se procesa por bloques, cancela resultados obsoletos y deja respirar a la interfaz.
- Las escrituras de IndexedDB solo se consideran exitosas cuando termina la transacción completa.
- El renderizado dejó de escribir el producto de servicio en Firebase; esa verificación ocurre una sola vez durante la carga.
- La actualización PWA solo limpia cachés de SubliCosturas y no guarda respuestas HTML fallidas.

## Compatibilidad y reversa

- No hay borrados masivos ni transformación de datos históricos.
- Las ventas anteriores sin identificador de línea usan una comprobación conservadora; si existe duda, la operación se cancela sin escribir.
- Antes de publicar debe conservarse la rama `respaldo/v1.2.2-antes-v1.2.3`.
- Para regresar, se revierte el commit de esta versión y se publica el código anterior con un número de versión superior para evitar cachés mezcladas.

## Seguridad con despliegue coordinado obligatorio

La rama incluye reglas de Firestore cerradas por defecto, pero abrir o fusionar el PR no las despliega por sí solo. **No deben publicarse** hasta confirmar primero el UID propietario activo, probar el acceso desde otro dispositivo y descargar un respaldo válido. El orden exacto y la recuperación están documentados en `SEGURIDAD_FIREBASE.md`; desplegarlas antes podría bloquear el acceso a Firestore.
