# Auditoría profunda y mejora de cálculo — SubliCosturas 1.0.8

Fecha de revisión: 24 de agosto de 2026

## Protección aplicada durante la revisión

- El análisis y las pruebas se hicieron en la rama aislada `mejoras/recalculo-instantaneo-v2`.
- Ninguna prueba se conectó a Firebase ni escribió inventario, ventas, ingresos, cotizaciones, retiros o fondos reales.
- No se ejecutó ninguna migración de datos.
- La regla SAT quedó igual: 5% del ingreso únicamente cuando se marca factura.
- Las ventas nuevas conservan `versionCalculo: 2`, por lo que siguen siendo compatibles con la anulación y edición existentes.

## Mejora implementada

Ventas y cotizaciones muestran ahora, mientras se escribe:

1. Total a cobrar o total cotizado.
2. Costo de materiales y servicios.
3. Gasto de producción (luz/tinta).
4. Mensajero o envío.
5. SAT, si corresponde.
6. Gastos totales.
7. Ganancia libre.
8. Margen sobre la venta.

Los campos de producción, envío y factura ya actualizan el panel con eventos `input`/`change`. La vista previa y el guardado final llaman a una sola función, `calcularDesgloseFinanciero()`, para impedir que dos fórmulas duplicadas den resultados diferentes.

También se corrigió el aviso de existencias en cotizaciones: si el mismo producto aparece en varios renglones, ahora se suma la cantidad total antes de calcular cuánto falta.

## Fórmula conservada

```text
ingreso = suma(cantidad × precio cobrado)
materiales = suma(cantidad × costo unitario real)
SAT = ingreso × 5% solamente con factura
gastos totales = materiales + producción + envío + SAT
ganancia libre = ingreso − gastos totales
margen = ganancia libre ÷ ingreso
```

No se cambió la forma en que los fondos reciben producto, luz/tinta, ganancia libre o SAT.

## Pruebas realizadas

- Validación de sintaxis HTML, JavaScript clásico, módulo Firebase y JSON.
- Detección de identificadores HTML y funciones globales duplicadas.
- Prueba de costo promedio ponderado.
- Prueba de suma y reversión del resumen mensual.
- Prueba explícita de SAT al 5% con factura y Q 0.00 sin factura.
- Prueba simulada del recálculo instantáneo al cambiar producción, envío y factura.
- Prueba del aviso de stock acumulado en cotizaciones repetidas.
- 50,000 escenarios financieros aleatorios, verificando las identidades de gastos, ganancia y SAT.
- 50,000 escenarios aleatorios de costo promedio ponderado.
- 5,000 ventas simuladas agregadas y luego revertidas sin dejar residuo contable.
- 20,000 retiros inteligentes aleatorios, verificando prioridad por fondos, centavos exactos y protección SAT.
- Verificación de que las operaciones críticas siguen usando transacciones y no escrituras parciales.
- Consistencia de versión PWA e iconos.

Resultado actual: 13 pruebas aprobadas, 0 fallidas.

## Errores y riesgos encontrados

### Corregidos en esta rama

1. **Desglose incompleto en tiempo real.** La lógica calculaba ganancia al escribir, pero la interfaz solo enseñaba total y materiales; producción, envío, SAT, gastos totales y ganancia quedaban ocultos.
2. **Fórmula duplicada.** Venta, cotización y conversión repetían el mismo cálculo en varios lugares, creando riesgo de diferencias futuras.
3. **Stock engañoso en una cotización repetida.** El aviso comparaba cada renglón por separado y no la suma del mismo producto.
4. **Exportaciones frágiles con registros antiguos incompletos.** Algunas llamadas directas a `.toFixed()` podían detener el reporte si un valor legado era texto o faltaba. Ahora se normalizan esos números sin alterar los datos guardados.
5. **Desbordamiento numérico.** Se agregó un rechazo explícito para montos tan grandes que JavaScript produciría `Infinity`.

### Pendientes; no se modificaron para no ampliar el riesgo de esta entrega

1. **Seguridad real de Firebase (prioridad alta).** Los PIN y permisos se evalúan en el navegador. Eso controla la interfaz, pero no sustituye Firebase Authentication ni reglas de Firestore. El repositorio no contiene reglas para comprobar qué operaciones acepta el servidor. Debe auditarse desde Firebase antes de cambiarlo.
2. **Edición de venta en dos pasos (prioridad media).** Al editar una venta, primero se anula de forma atómica y luego se carga al carrito. Si se abandona el carrito, la original permanece anulada. Es matemáticamente consistente, pero sería mejor guardar un borrador de edición o pedir una confirmación final más clara.
3. **Asignación del transporte de compras (prioridad media).** El transporte global de un ingreso se reparte por pieza. Es correcto si las piezas tienen costos logísticos semejantes; puede distorsionar costos cuando un artículo pesa o ocupa mucho más que otro. Una versión futura podría permitir repartir por cantidad, valor o peso.
4. **Dependencias externas y modo sin conexión (prioridad media).** El service worker conserva archivos propios, pero Firebase, Chart.js y XLSX se cargan desde CDN. En un dispositivo nuevo sin caché, la aplicación no puede iniciar completamente sin Internet.
5. **Sincronización de usuarios (prioridad media).** El guardado de usuarios conserva respaldo local, pero la escritura en Firebase silencia el error. Puede aparentar éxito en un dispositivo aunque el cambio no haya llegado a los demás.
6. **Prueba concurrente real pendiente.** Las transacciones de venta, ingreso, anulación y retiro están protegidas en código, pero la concurrencia real entre varios dispositivos debe probarse contra un Firebase Emulator configurado con las mismas reglas, nunca contra los datos reales.

## Ideas tomadas de sistemas similares

Referencias revisadas: [Printavo](https://www.printavo.com/), [YoPrint](https://yoprint.com/), [Odoo Manufacturing](https://www.odoo.com/app/manufacturing-features), [Zoho Inventory](https://www.zoho.com/inventory/features/), [Square Inventory](https://squareup.com/us/en/point-of-sale/features/inventory-management) y [Sortly](https://www.sortly.com/features/).

### Prioridad 1: gran beneficio con cambio controlado

1. **Orden de trabajo después de aprobar la cotización.** Estados: cotizada, aprobada, diseño, producción, lista y entregada. Debe guardar fecha prometida, responsable, anticipo y saldo.
2. **Receta de costos por producto.** Por ejemplo, una taza puede consumir taza blanca, papel, tinta, caja, energía y minutos de trabajo. Al vender, el sistema propondría automáticamente esos costos y materiales.
3. **Reserva de inventario.** Una cotización aprobada apartaría material sin registrarlo todavía como vendido. Esto evita prometer el mismo producto a dos clientes.
4. **Precio mínimo sugerido.** A partir de material, producción, envío, merma, mano de obra y margen deseado, mostraría un precio recomendado y advertiría si se vende por debajo del punto de equilibrio.

### Prioridad 2: control operativo

5. **Anticipos y pagos pendientes.** Separar total del pedido, anticipo recibido y saldo por cobrar, con cierre diario por efectivo, transferencia y tarjeta.
6. **Merma y reimpresión.** Registrar piezas dañadas o repetidas contra la orden de trabajo para que la rentabilidad real incluya errores de producción.
7. **Surtido inteligente.** Usar ventas promedio y tiempo del proveedor para sugerir punto de reorden, cantidad a comprar y productos de baja rotación.
8. **Bitácora por usuario.** Registrar quién cambió precio, stock, cotización, venta o retiro, con valor anterior y nuevo.

### Prioridad 3: velocidad y servicio al cliente

9. **Código QR o barras.** Buscar, contar, ingresar y vender artículos con la cámara del teléfono.
10. **Aprobación digital del diseño.** Enviar un enlace o imagen al cliente, guardar su aprobación y evitar producir con una versión equivocada.
11. **Historial de cliente.** Mostrar pedidos, diseños, precios anteriores, saldo y productos frecuentes para repetir trabajos más rápido.
12. **Panel de producción.** Vista por fecha y estado para detectar pedidos atrasados, carga de trabajo y cuellos de botella.

## Cómo regresar sin perder datos

Antes de integrar esta rama, basta con cerrar el pull request: `main` y Firebase no cambian.

Si ya se integró, se debe crear un `git revert` del commit de integración de la versión 1.0.8. Esta entrega no cambia colecciones ni migra documentos, por lo que volver al código 1.0.7 no requiere borrar ni restaurar inventario, ventas o fondos.

No se debe usar `git reset --hard`, borrar colecciones de Firebase ni restaurar una copia completa de la base para revertir esta mejora visual y matemática.
