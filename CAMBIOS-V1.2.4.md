# SubliCosturas v1.2.4 — interfaz profesional e integridad contable

## Qué cambia

- Se agrega un modelo visual **Profesional** y se conserva el modelo **Clásico**. La selección vive solo en el dispositivo y no modifica datos, cálculos ni permisos.
- La anulación de una venta respeta el efectivo y banco usados en cada pago original. Si el historial de una venta nueva no cuadra, la operación se detiene sin escribir cambios.
- La huella contable de fondos se valida campo por campo y debe coincidir exactamente con lo cobrado antes de anular o recibir un abono.
- Las anulaciones verifican la revisión de la venta y se detienen si otro dispositivo la cambió después de abrir la confirmación.
- Una venta con devoluciones parciales ya no puede anularse por la ruta completa; el saldo restante se devuelve desde Caja para conservar su bitácora.
- Una venta contabilizada no puede anularse, devolverse ni reemplazarse si su fecha o resumen mensual asociado están dañados; la transacción falla cerrada antes de escribir.
- Las devoluciones parciales prorratean SAT en centavos acumulados. La última devolución cierra exactamente el impuesto sin residuos.
- `ventasTotales` se corrige al devolver un producto aunque se decida no reingresarlo a existencias.
- Se validan precios, gastos, anticipos y transporte con un máximo de dos decimales; ya no se redondean importes operativos silenciosamente.
- El redondeo simétrico corrige medios centavos sin inventar centavos o millonésimas en magnitudes grandes, y las sumas financieras se detienen al superar el entero seguro.
- Servicios y devoluciones aceptan cantidades controladas hasta milésimas y rechazan precisión invisible.
- Los cuatro retiros clásicos y el retiro inteligente conservan su funcionamiento y rechazan fracciones invisibles de centavo.
- Se neutralizan valores configurables antes de insertarlos en HTML y se endurece la lectura de meses/fechas inválidas.
- Los mensajes de margen usan el objetivo configurado en vez de mostrar un 10% fijo.

## Compatibilidad y reversa

- No se cambian colecciones ni se eliminan documentos.
- El modelo Clásico conserva la apariencia anterior; el menú superior/lateral sigue siendo una preferencia separada.
- Las ventas históricas mantienen su ruta de compatibilidad. Las ventas v4 fallan de forma cerrada cuando su huella de pagos no es verificable.
- Para revertir esta entrega basta volver al commit anterior; no requiere migración de datos.

## Puesta en producción recomendada

1. Crear una copia JSON completa.
2. Verificar y activar primero la cuenta real del Dueño antes de publicar reglas cerradas de Firestore.
3. Probar en un dispositivo secundario: venta de contado, crédito, pago mixto, devolución parcial y anulación.
4. Publicar la aplicación y confirmar que la caché activa sea `sublicosturas-v1.2.4`.
