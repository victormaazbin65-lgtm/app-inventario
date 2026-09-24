# Correcciones de informes y acceso — 24 de septiembre de 2026

Este cambio continúa la auditoría integral en la versión pública 1.2.5. No se ha leído, exportado ni modificado la base de producción. El código anterior se conserva en la rama `backup/antes-correcciones-informes-2026-09-24`.

## Correcciones aplicadas

| Área | Problema comprobado | Solución |
| --- | --- | --- |
| Resumen diario | Inicio consultaba las últimas 50 ventas; con más ventas, los importes del día se quedaban cortos. | «Consultar hoy» lee las ventas de ese día en páginas de 100, por petición del usuario y con respuesta confirmada del servidor. Suma en centavos, excluye anuladas y muestra hora de consulta. Los importes incompletos llevan la etiqueta «ventas cargadas». |
| Significado del dinero | El texto «Ingresos» podía interpretarse como efectivo cobrado aunque incluyera ventas a crédito. | El panel inteligente distingue «Vendido», «Costos y SAT» y «Utilidad», e indica expresamente que vendido no equivale a cobrado. No cambia la contabilización de efectivo, banco, fondos ni impuesto. |
| Control de acceso en pantalla | El panel inteligente enseñaba resumen, caja, márgenes y anomalías a empleados sin el permiso financiero. Algunas preguntas y prioridades revelaban cifras o cuentas por cobrar. | Se aplica el permiso `verFinanzas` a tarjetas, consultas, prioridades, panel de Inicio y resumen del asistente. Sin usuario activo, el módulo adicional no concede permiso por defecto. |
| Respaldo en Android | Se iniciaban 20 lecturas completas de colecciones a la vez. | Lee hasta tres colecciones en paralelo por lote y cede tiempo al navegador entre lotes. Sigue rechazando respuestas de caché o escrituras pendientes. |
| Cambio de día y ventas | Una consulta de ayer o una venta nueva podía dejar visible un total viejo. | El resumen se usa solo si coincide con la fecha local actual; al cambiar los documentos en la escucha de ventas recientes, se invalida y vuelve a estar disponible «Consultar hoy». Si hay cambios observados durante la consulta, se cancela. |

La regla del **5 % de SAT solo con factura** y la versión pública 1.2.5 continúan iguales. **No se implementó una orden de trabajo del taller**, conforme a la instrucción recibida. No se añadieron colecciones ni migraciones de datos.

## Verificación

- `npm test`: **182 pruebas correctas, ninguna fallida**. Incluyen 125 ventas vigentes y una anulada repartidas en dos páginas, centavos de ventas/costos/utilidad, rechazo de caché y cambios concurrentes observados, permisos y límite de concurrencia del respaldo.
- `git diff --check`, sintaxis JavaScript y el análisis de sintaxis de HTML/scripts de la suite: correctos.
- La comprobación es de código y simulaciones aisladas; no se han probado movimientos en Firebase de producción ni el navegador de un Redmi físico.

## Límites y propuestas siguientes

1. **Respaldo y consulta diaria:** las lecturas de varias páginas o colecciones no son una fotografía atómica del servidor. Si otros equipos cambian registros durante el recorrido, una consulta puede recoger momentos distintos; el resumen muestra cuándo se consultó, e invalida los cambios detectados en las ventas recientes. Para un cierre contable verificable convendría un corte de servidor único o un libro de movimientos con contador transaccional y conciliación, en una fase diseñada y probada aparte.
2. **Aislamiento por empleado:** la regla actual de Firestore permite al UID del propietario consultar todos los documentos; los PIN y permisos de empleados se aplican en la aplicación. Ocultar tarjetas corrige la vista, pero no impide que quien controle un navegador autenticado con ese UID acceda a los datos. El aislamiento real requiere identidades Firebase distintas y reglas de servidor por rol, además de revisar qué datos se comparten. Referencia: [guía oficial de acceso por roles](https://firebase.google.com/docs/firestore/solutions/role-based-access).
3. **Informes auditables:** añadir a cada informe fecha de última confirmación, número de registros y alcance consultado; permitir abrir la lista de operaciones que explica cada cifra. Una conciliación explicada debe mostrar por separado vendido, cobrado, anticipos, banco, efectivo y fondos reservados.
4. **Rendimiento móvil:** paginar también los historiales completos y medir en un Redmi real tiempo de inicio, memoria y desplazamiento. El HTML principal todavía reúne muchas pantallas y merece extracción progresiva por módulo.

Las mejoras 1–4 son propuestas: no alteran datos ni introducen la función de orden de trabajo descartada.
