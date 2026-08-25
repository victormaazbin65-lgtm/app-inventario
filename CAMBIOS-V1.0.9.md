# SubliCosturas 1.0.9 — interfaces y funciones inteligentes configurables

## Alcance

Esta versión agrega una capa visual y de análisis sobre el sistema 1.0.8. No cambia la estructura de inventario, ventas, ingresos, cotizaciones, retiros ni fondos en Firebase.

## Interfaz

- Conserva el menú superior como opción predeterminada.
- Agrega un menú lateral opcional para computadora.
- El menú lateral puede mostrar solo iconos o iconos con nombres.
- En pantallas menores de 900 px se conserva automáticamente la navegación superior existente.
- Las dos presentaciones usan los mismos botones, secciones y funciones; no existe una copia de la lógica del negocio.

## Configuración inteligente

En Opciones existe un interruptor maestro y controles independientes para:

- alertas importantes;
- predicción para surtir;
- precios y margen;
- retiro inteligente;
- detector de posibles errores;
- resumen del día;
- consultas inteligentes;
- etiquetas y códigos.

Cada módulo permite escoger entre `Solo informar` y `Ayudar con opciones`. Las preferencias se guardan únicamente en el dispositivo mediante `subli_preferencias_sistema_v1` y no escriben en Firebase.

## Límites de seguridad

- El centro inteligente es de solo lectura.
- Ninguna sugerencia vende, retira, borra, cambia precios ni modifica existencias automáticamente.
- El retiro asistido sigue exigiendo permiso de Dueño, conexión, confirmación y transacción atómica.
- En modo `Solo informar`, la confirmación del retiro asistido queda desactivada.
- Los retiros manuales existentes continúan disponibles.
- La regla SAT conserva exactamente el 5% del ingreso cuando la operación lleva factura y 0% cuando no lleva factura.
- La sugerencia de precio busca un margen libre del 30%, se muestra como referencia y nunca reemplaza el monto ingresado.
- El análisis utiliza los registros disponibles en el dispositivo; no envía información a un servicio externo de IA.

## Validación

La prueba automatizada cubre sintaxis, identificadores duplicados, SAT, ventas y cotizaciones, costo promedio, retiros, códigos por categoría, búsqueda, PWA, ambas interfaces, controles inteligentes, sugerencias de precio y análisis de anomalías.

Los escenarios de estrés existentes continúan ejecutándose sobre 50,000 cálculos financieros, 5,000 agregaciones y reversas contables, 20,000 retiros y 9,990 asignaciones de códigos.

## Reversa

La publicación debe integrarse mediante un único pull request. Si se necesita volver atrás, se revierte el commit de integración de la versión 1.0.9 desde GitHub. La reversa reemplaza solamente los archivos de la aplicación y no elimina ni restaura colecciones de Firebase.

La preferencia local `subli_preferencias_sistema_v1` puede permanecer en el navegador después de una reversa porque la versión anterior simplemente la ignora.
