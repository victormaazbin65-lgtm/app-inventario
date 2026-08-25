# Auditoría profunda, códigos de inventario y rediseño — SubliCosturas 1.0.8

Fecha de revisión: 24 de agosto de 2026

## Protección aplicada durante la revisión

- El análisis y las pruebas se hicieron en la rama aislada `mejoras/recalculo-instantaneo-v2`.
- Ninguna prueba se conectó a Firebase ni escribió inventario, ventas, ingresos, cotizaciones, retiros o fondos reales.
- No se ejecutó ninguna migración de datos ni se escribió en el Firebase real durante las pruebas.
- La asignación de códigos al inventario existente no se ejecuta automáticamente: requiere el botón protegido, conexión, confirmación y una transacción completa.
- La regla SAT quedó igual: 5% del ingreso únicamente cuando se marca factura.
- Las ventas nuevas conservan `versionCalculo: 2`, por lo que siguen siendo compatibles con la anulación y edición existentes.

## Mejoras implementadas

### Cálculo instantáneo

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

### Códigos permanentes y etiquetas físicas

- Cada categoría recibe un bloque de 1000: 1000, 2000, 3000 y así sucesivamente.
- El número base identifica el bloque; los productos usan desde base + 1 hasta base + 999. Ejemplo: categoría 1000 → productos 1001 a 1999.
- El bloque y el siguiente código se guardan en `sistema/config.codigosInventario` para que dos dispositivos no reserven el mismo número.
- Los productos nuevos reciben su código dentro de la misma transacción de ingreso.
- Los productos actuales se codifican únicamente al presionar **Asignar códigos faltantes**, con PIN de dueño, confirmación y conexión.
- La asignación conserva `stock`, `costo`, fondos, ventas y `lastModified`; por eso no invalida la reversión exacta de un ingreso anterior.
- El código se puede buscar desde ingreso, inventario, ventas y cotizaciones.
- El inventario permite imprimir una etiqueta individual o todas las etiquetas asignadas. El reporte Excel incluye código y bloque.
- Un código asignado nunca se renumera. Si el producto cambia de categoría, conserva su etiqueta física.
- Crear, renombrar o eliminar una categoría ahora usa una transacción. Al renombrar se conserva el bloque; al trasladar productos se conservan sus códigos.

### Diseño oscuro moderno

- Se mantuvo el modo oscuro y se renovaron superficies, tarjetas, botones, formularios, pestañas y paneles financieros.
- Las pestañas quedan visibles al desplazarse, con efecto de desenfoque compatible y contraste reforzado.
- La vista se adapta mejor a teléfono: formularios de dos columnas pasan a una, las pestañas tienen desplazamiento horizontal y las acciones ocupan el ancho disponible.
- Se agregó foco visible y respeto por `prefers-reduced-motion` para accesibilidad.
- El rediseño es CSS y presentación; no cambia cálculos, nombres de colecciones ni flujos contables.

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
- Prueba de bloques, renombrado y detección de códigos repetidos.
- 9,990 asignaciones simuladas (10 categorías × 999 productos), verificando bloque, secuencia, unicidad y agotamiento seguro.
- Prueba de búsqueda por código y escape seguro del contenido de etiquetas.
- Verificación estática de que la asignación existente es explícita, transaccional y no modifica la huella contable.
- Verificación del nuevo modo oscuro, adaptación móvil y reducción de movimiento.
- Consistencia de versión PWA e iconos.

Resultado actual: 18 pruebas aprobadas, 0 fallidas.

## Errores y riesgos encontrados

### Corregidos en esta rama

1. **Desglose incompleto en tiempo real.** La lógica calculaba ganancia al escribir, pero la interfaz solo enseñaba total y materiales; producción, envío, SAT, gastos totales y ganancia quedaban ocultos.
2. **Fórmula duplicada.** Venta, cotización y conversión repetían el mismo cálculo en varios lugares, creando riesgo de diferencias futuras.
3. **Stock engañoso en una cotización repetida.** El aviso comparaba cada renglón por separado y no la suma del mismo producto.
4. **Exportaciones frágiles con registros antiguos incompletos.** Algunas llamadas directas a `.toFixed()` podían detener el reporte si un valor legado era texto o faltaba. Ahora se normalizan esos números sin alterar los datos guardados.
5. **Desbordamiento numérico.** Se agregó un rechazo explícito para montos tan grandes que JavaScript produciría `Infinity`.
6. **Categorías con escrituras parciales.** Crear, renombrar y eliminar categorías ya no dispara escrituras independientes sin esperar. Ahora los documentos y la configuración se actualizan juntos o no se actualiza nada.
7. **Identificación física inexistente.** Se añadieron códigos permanentes, búsqueda por código, exportación e impresión de etiquetas sin depender de servicios externos.

### Pendientes; no se modificaron para no ampliar el riesgo de esta entrega

1. **Seguridad real de Firebase (prioridad alta).** Los PIN y permisos se evalúan en el navegador. Eso controla la interfaz, pero no sustituye Firebase Authentication ni reglas de Firestore. El repositorio no contiene reglas para comprobar qué operaciones acepta el servidor. Debe auditarse desde Firebase antes de cambiarlo.
2. **Edición de venta en dos pasos (prioridad media).** Al editar una venta, primero se anula de forma atómica y luego se carga al carrito. Si se abandona el carrito, la original permanece anulada. Es matemáticamente consistente, pero sería mejor guardar un borrador de edición o pedir una confirmación final más clara.
3. **Asignación del transporte de compras (prioridad media).** El transporte global de un ingreso se reparte por pieza. Es correcto si las piezas tienen costos logísticos semejantes; puede distorsionar costos cuando un artículo pesa o ocupa mucho más que otro. Una versión futura podría permitir repartir por cantidad, valor o peso.
4. **Dependencias externas y modo sin conexión (prioridad media).** El service worker conserva archivos propios, pero Firebase, Chart.js y XLSX se cargan desde CDN. En un dispositivo nuevo sin caché, la aplicación no puede iniciar completamente sin Internet.
5. **Sincronización de usuarios (prioridad media).** El guardado de usuarios conserva respaldo local, pero la escritura en Firebase silencia el error. Puede aparentar éxito en un dispositivo aunque el cambio no haya llegado a los demás.
6. **Prueba concurrente real pendiente.** Las transacciones de venta, ingreso, anulación y retiro están protegidas en código, pero la concurrencia real entre varios dispositivos debe probarse contra un Firebase Emulator configurado con las mismas reglas, nunca contra los datos reales.

## Cómo regresar sin perder datos

Antes de integrar esta rama, basta con cerrar el pull request: `main` y Firebase no cambian.

Si ya se integró, se debe crear un `git revert` del commit de integración de la versión 1.0.8. Volver al código 1.0.7 no requiere borrar ni restaurar inventario, ventas o fondos.

Si ya se presionó **Asignar códigos faltantes**, los campos `codigoInventario`, `bloqueCategoria` y `codigosInventario` pueden permanecer en Firebase: la versión anterior simplemente los ignora. No se deben borrar para regresar; conservarlos permite recuperar las mismas etiquetas si se vuelve a activar esta versión.

No se debe usar `git reset --hard`, borrar colecciones de Firebase ni restaurar una copia completa de la base para revertir estas mejoras.
