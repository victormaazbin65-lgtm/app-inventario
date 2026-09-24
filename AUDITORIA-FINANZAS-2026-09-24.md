# Revisión de Sublicosturas — 24 de septiembre de 2026

Base revisada: `b3512a7ebceea9399fad543f1d5749427d473f0e` (main).
Respaldo de código: `backup/antes-auditoria-finanzas-2026-09-24`.
Revisión identificable: `auditoria-finanzas-20260924` en build-info.json.

## Por qué podía aparecer dinero disponible en Q0.00

`renderizarTodo()` consultaba `document.getElementById('tab-caja').classList`, pero el HTML ya no contiene ese botón. El resultado es una excepción de JavaScript antes de llegar a `aplicarConfiguracionNegocio()` y a la actualización de efectivo, banco y dinero disponible. Los fondos se dibujaban antes de la excepción, por lo que podían verse con valores mientras las otras tarjetas conservaban el cero inicial. El mismo error interrumpía los historiales dibujados después.

La corrección consulta la visibilidad de `sec-caja`, que sí existe. Conserva Caja dentro del Panel de Finanzas y el arranque diferido de Android. Una prueba ejecuta el recorrido de render completo usando identificadores del HTML real: reproduce la excepción con el código anterior y muestra Q1,210.50 con saldos ficticios de Q1,000.50 y Q210 tras corregirlo.

Esto demuestra un defecto del código compatible con la captura; no permite confirmar la versión instalada en el equipo ni el saldo real en Firebase. Los fondos visibles de la captura suman Q1,210.50, pero no se reemplazó efectivo/banco por esa suma. Un cero registrado explícitamente sigue siendo cero.

## Otros errores corregidos

1. **Crédito incompleto.** Si al menos una ficha tenía `saldoCredito`, se ignoraban todas las ventas pendientes de clientes sin ese campo, cuentas sin ficha y clientes archivados. Ahora la consulta completa de créditos confirmada es prioritaria, incluso cuando queda vacía. En ausencia de confirmación, se combinan fichas con ventas disponibles por cliente sin duplicarlas. Las cuentas archivadas no hacen desaparecer obligaciones pendientes.
2. **Respaldo heredado sin saldos.** Al faltar la clave local de saldos, nunca se recalculaba el cero inicial. La compatibilidad heredada se aplica después de leer fondos y anticipos. Los saldos explícitos se respetan. Esta lectura no modifica Firebase ni recalcula saldos ya inicializados.
3. **Ingresos múltiples y verificación de códigos.** El módulo profesional escribía un índice de nombre durante la reserva del primer producto; la siguiente lectura violaba el orden exigido por las transacciones. Ahora las reservas de códigos y nombres se preparan sin escrituras y se aplican al final. Se valida también que dos productos del mismo lote no reclamen el mismo nombre. El nombre previo se consulta en el servidor. Se actualizaron los dos llamadores: ingreso y verificación de códigos.
4. **Entrega de archivos.** Se renovó el nombre de caché de la PWA y se identificó la revisión en build-info.json. La versión funcional continúa en 1.2.5. No se añadieron temporizadores de actualización ni se cambió el esquema de datos.

## Comprobaciones

- Las 160 pruebas anteriores pasaban antes del trabajo, pero no ejecutaban el render completo que fallaba.
- Se añadieron 7 pruebas ejecutables: Inicio, Caja, mezcla de créditos, restauración local heredada y ceros explícitos, orden de lecturas/escrituras, nombres duplicados y operación completa de ingreso múltiple.
- El ingreso completo ejecuta la función real contra una transacción simulada estricta: dos productos con 2 unidades a Q10, más Q5 de transporte, quedan a Q11.25 por unidad, con códigos distintos e índices de nombres, sin modificar fondos.
- La suite cubre además SAT opcional, distribución por centavos, costo ponderado, lotes, créditos, anticipos, préstamos, devoluciones, reversiones, restauración, sincronización, acceso y arranque Android. Incluye las pruebas existentes de estrés de 100,000 líneas fraccionadas y 20,000 productos de surtido.
- Resultado final local: 167 pruebas aprobadas, 0 fallidas. `git diff --check` sin errores.
- Algunas pruebas heredadas comprueban estructura de código, no todas ejecutan una operación completa. Se sustituyó la comprobación del viejo cálculo de crédito por la del nuevo cálculo; no se eliminaron las pruebas de conservación monetaria.

## Límites y alcance

No se leyó ni modificó la base de datos real. No se recalcularon ventas históricas, existencias, fondos ni impuestos. Se conserva la facturación SAT únicamente cuando se selecciona. El respaldo creado es del código, no una exportación de datos de Firebase.

La prueba en Chromium no pudo ejecutarse porque la descarga del navegador de pruebas falló en este entorno. Las pruebas de recorrido usan Node/VM y un DOM simulado a partir del HTML; no certifican el aspecto visual ni el comportamiento físico del Redmi. La corrección del total no permite afirmar que todas las causas de los cierres Android previos estén resueltas.

La revisión abarcó el arranque, render, núcleo monetario, operaciones de ventas/ingresos/retiros y los módulos de gestión, finanzas, respaldo y capas profesionales. No es una garantía de ausencia absoluta de errores. Los cambios se limitaron a defectos reproducidos.

## Mejoras propuestas para siguientes cambios

- Mostrar si cada saldo procede del servidor o de la copia local y cuándo fue confirmado. La existencia de conectividad por sí sola no demuestra que un saldo esté actualizado.
- Añadir una conciliación de fondos, caja, banco y anticipos con diferencias explicadas; debe señalar discrepancias y nunca corregir importes automáticamente.
- Dar a los informes una indicación de cobertura: historial completo o últimas ventas cargadas. El arranque limitado a 50 ventas puede afectar reportes secundarios que utilicen ese arreglo directamente.
- Expandir las pruebas de transacciones a dos dispositivos concurrentes, reintentos, ventas con anticipo y devoluciones completas. Las pruebas matemáticas aisladas no bastan para cubrir interacción entre módulos.
- Hacer las copias de seguridad con una comprobación de que no hubo movimientos durante la lectura: actualmente las colecciones se leen por separado y pueden corresponder a instantes diferentes si otro equipo opera mientras se exporta.

## Reversión

La referencia de respaldo conserva exactamente el código previo. Si fuera necesario revertir, aplicar un commit de reversión del cambio integrado, conservar historial y publicar nuevamente. No restaurar una copia antigua de datos para revertir un cambio de interfaz; eso descartaría operaciones posteriores.
