# Auditoría integral de SubliCosturas — 24 de septiembre de 2026

Base del cambio: `main` en `ad9a4d31fd5226fe7bb04b2d94251151099c2d1a`.
Respaldo del código previo: `backup/antes-auditoria-integral-2026-09-24`.
La revisión no leyó, exportó ni modificó los datos reales de Firebase. El 5 % de SAT sigue aplicándose exclusivamente cuando la venta pide factura.

## Correcciones comprobadas

| Área | Defecto observado | Cambio aplicado |
| --- | --- | --- |
| Cobros | Una venta con `saldoPendiente: 0` podía reaparecer como deuda por un campo antiguo positivo o un cobro incompleto. | Se respeta el cero explícito y la prioridad de los campos actuales; los importes se expresan en centavos. |
| Inicio y asistente | La agenda, la prioridad «Por cobrar» y la ficha del cliente usaban las últimas 50 ventas, con riesgo de omitir créditos antiguos. | Al recibir la consulta completa confirmada de créditos, esta pasa a ser la fuente para el saldo, la agenda, las prioridades y el asistente. Mientras llega, los registros recientes prevalecen sobre copias pendientes antiguas del mismo ID. |
| Ficha de cliente | «Total comprado» y «Compras registradas» podían representar solo las ventas cargadas. | Las etiquetas indican cuándo la vista es parcial; la deuda confirmada usa la consulta de pendientes, y antes de confirmarse puede usar el saldo de la ficha. |
| Inventario y préstamos | Un stock negativo restaba dinero al valor de inventario; un préstamo marcado pagado con saldo residual se contaba como pendiente. | Las vistas de Inicio y Excel valúan existencias negativas en cero; se preserva el aviso de stock negativo. Los préstamos pagados no se suman a pendientes. |
| Exportación Excel | El crédito del resumen se calculaba solo con las ventas descargadas; consultas que devolvían únicamente caché se aceptaban como historial completo. | El resumen usa la misma regla de crédito que Finanzas. El historial y las hojas adicionales exigen confirmación del servidor antes de declarar completitud; sigue existiendo la opción explícita de exportar datos parciales. |
| Copia de seguridad | Estar «en línea» bastaba para aceptar respuestas de la caché de Firestore como un respaldo completo. | Se exige respuesta confirmada y sin escrituras pendientes en cada colección y documento del sistema. Si la configuración cambia entre el inicio y el final de la lectura, se cancela. |
| Restauración | La verificación final solo comprobaba que existieran algunos documentos. | Ahora compara sus datos con la copia y exige la respuesta del servidor. Una discrepancia marca la restauración como incompleta para su revisión. |
| Sincronización | La etiqueta «Sincronizado» aparecía con solo tener conexión y ninguna transacción abierta. | Muestra comprobación, falta de conexión, operación en curso, fallo o confirmación de configuración, inventario, ventas, créditos, clientes, anticipos y préstamos. Las respuestas de solo caché y escrituras pendientes no cuentan como confirmación. |
| Buscador | Al abrir Diseños se solicitaba borrar `sublicosturas-studio`, una base IndexedDB distinta del buscador actual. | Se eliminó esa operación; el índice propio permanece en lectura local. |
| Actualización de pantalla | Los paneles profesionales podían quedarse con cifras antiguas tras una actualización general. | Se actualizan con el render general, agrupados para evitar refrescos redundantes. Se añadió la guía ya existente de Caja. |

## Comprobación técnica

- `npm test`: **175 pruebas correctas, 0 fallidas**. Las nuevas pruebas ejecutan crédito pagado, crédito antiguo más allá de 50 ventas, préstamo pagado, inventario negativo, estado de sincronización, carga de historial confirmada y fallos de integridad en respaldo/restauración.
- `git diff --check` y análisis de sintaxis de los archivos JavaScript modificados: correctos.
- Se revisaron las rutas de ingreso, venta, devolución, retiro, préstamo, anticipo, reportes, acceso, respaldo, sincronización, buscador, PWA y los límites de arranque móvil. Las pruebas anteriores cubren distribución de centavos, SAT condicional, transacciones de dos productos, 20 000 pagos, 50 000 escenarios financieros y búsquedas de inventario grandes.
- La caché de la PWA cambia a `sublicosturas-v1.2.5-auditoria-integral-20260924`; la versión funcional y el esquema de datos permanecen en 1.2.5 y v4 respectivamente.

## Límites actuales y mejoras siguientes

1. **Consistencia entre colecciones del respaldo.** Las consultas se ejecutan por separado. La comprobación de configuración detecta parte de los cambios simultáneos, pero no puede garantizar una fotografía atómica de todas las colecciones. Una copia hecha mientras otros equipos operan puede requerir una ventana de mantenimiento o una exportación administrada con marca de corte.
2. **Cobertura de ventas diarias.** Inicio consulta las últimas 50 ventas para arrancar rápido en Android. Si hay más de 50 en el día, sus cifras de ventas y utilidad pueden ser parciales; ahora se indica «ventas cargadas». Una consulta paginada por día, iniciada al abrir el detalle, daría el total exacto sin cargar meses completos en el teléfono.
3. **Permisos de empleados.** Firebase autoriza al propietario y la aplicación filtra los módulos según el PIN/rol local. Si se necesita aislamiento verificable de los datos de cada empleado incluso ante herramientas del navegador, harían falta identidades y reglas de servidor por rol. Es un cambio de arquitectura y migración; no se alteró el acceso actual.
4. **Copia previa a restaurar.** La aplicación dispara la descarga antes de escribir, pero un navegador no puede confirmar que el usuario guardó el archivo. Una restauración en muchos lotes puede quedar incompleta si se corta la conexión; en ese caso se informa y se conserva el punto previo para revisión.
5. **Rendimiento y diseño móvil.** `index.html` sigue siendo grande y varias vistas crean listas completas. Conviene separar el código por pantalla y paginar catálogos largos, verificándolo en el Redmi real y midiendo tiempo hasta primera interacción, memoria y desplazamiento.

## Propuesta para hacer la aplicación propia del taller

Prioridad alta: una **orden de trabajo** que una cotización, archivos de diseño, materiales comprometidos, etapas de producción, entrega, anticipo, cobro pendiente y utilidad final en una ficha. La reserva de materiales debe comprobar el stock en transacción y liberarse si se cancela; una cotización sola no debe mover inventario ni caja.

Prioridad media: una pantalla de **conciliación explicada** con efectivo, banco, fondos reservados, anticipos y préstamos como conceptos distintos, señalando diferencias sin corregirlas automáticamente; y etiquetas de cobertura/fecha del servidor en cada informe financiero.

Prioridad de presentación: un tablero visual de producción con acciones táctiles claras para el teléfono, nombre y colores del negocio, estados legibles, contraste suficiente y una vista compacta de lo que debe entregarse hoy. El modo de capacitación y el buscador por acción pueden guiar a empleados sin revelar cifras que su rol no debe mostrar.

## Reversión y alcance de la verificación

El respaldo de Git preserva el código anterior. Revertir código requiere un cambio nuevo; restaurar datos históricos descartaría movimientos posteriores y no es una reversión adecuada de interfaz.

No hubo conexión a Firebase de producción ni prueba física en el Redmi. La suite combina lógica real en Node/VM, recorridos de interfaz simulada y algunas verificaciones estructurales; no garantiza ausencia absoluta de errores ni certifica la apariencia en Chrome Android.
