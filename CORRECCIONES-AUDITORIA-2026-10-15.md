# Correcciones de la auditoría integral · candidata 1.4.2

Base: versión publicada 1.4.1, commit `33ce9899ae3c27d31d07829f30ddb3c7b205a3cb`. Rama de pruebas: `fix/auditoria-integral-2026-10-15`. No se publica ni fusiona esta entrega. Las pruebas utilizan datos simulados, sin consultar ni modificar Firebase de producción.

## Resultado por hallazgo

| ID | Cambio verificable | Estado |
| --- | --- | --- |
| AUD-01 | Cotizaciones, carritos y desglose ocultan costos y utilidad al empleado sin `verFinanzas`. El Dueño conserva el detalle completo. | Corregido en los flujos de pantalla revisados. La separación de lecturas del servidor depende de AUD-09. |
| AUD-02 | La navegación central comprueba permisos antes de abrir una sección; Ayuda respeta el acceso del empleado. | Corregido. |
| AUD-03 | Los comandos de dinero tienen firma de sus datos; una confirmación perdida se consulta por su ID y no vuelve a escribir. Si no se confirma, conserva el marcador y comunica incertidumbre. El reintento utiliza la referencia original del movimiento. | Corregido para los comandos firmados; ver límites de recuperación más abajo. |
| AUD-04 | Mes contable, límites del día y avisos usan Guatemala. Las ventas nuevas guardan su mes. Una devolución o anulación antigua conserva el mes del resumen original. | Corregido sin migrar documentos existentes. |
| AUD-05 | Una descarga externa fallida elimina su nodo; el reintento crea otra descarga y comprueba que la biblioteca esté disponible. | Corregido, con tiempo máximo de espera. |
| AUD-06 | Refrescar finanzas conserva la línea y cantidad elegidas para devolver. Si la línea desaparece, exige seleccionar otra, sin cambiarla silenciosamente. | Corregido. |
| AUD-07 | La devolución guarda el resumen neto y conserva el original; el historial muestra sus devoluciones. La pantalla también calcula el detalle neto de devoluciones anteriores. | Corregido sin reescribir historiales antiguos. |
| AUD-08 | El respaldo avisa si requiere recuperación administrativa. Se añade un revisor local de estructura, SHA-256, conteos y capacidad, sin conexión a Firebase. | Mitigado. Continúa el límite seguro de 398 documentos de colecciones; no se implementa restauración grande en producción. |
| AUD-09 | Las escrituras administrativas genéricas exigen Dueño. Se documenta la migración a identidades individuales, validación de PIN y permisos en el servidor. | Mitigado. El UID compartido continúa y no debe presentarse como aislamiento de seguridad. |
| AUD-10 | Los datos vigentes prevalecen sobre la caché de análisis; las anulaciones no vuelven a contarse. Cambios de configuración invalidan el análisis y la consulta completa puede actualizarse otra vez. | Corregido; una lectura concurrente inconsistente se marca incompleta. |

## Compatibilidad y conservación

- El Dueño mantiene todos sus permisos. No se cambia el flujo de vinculación de su cuenta, la regla SAT del 5% con factura ni las fórmulas de costos y cobros.
- Se conservan ingresos, existencias, ventas, cotizaciones, clientes, anticipos, préstamos, devoluciones e historiales. No se ejecuta migración ni se borran documentos.
- Los módulos se entregan en `assets/1.4.2/`; los recursos publicados de 1.4.0 y 1.4.1 permanecen intactos para las pestañas anteriores. La carga profesional continúa diferida para Android.
- La recuperación de un guardado confirmado solo limpia los campos que aún conservan los datos enviados. Protege texto nuevo, PIN y campos ajenos. Una actualización se bloquea mientras exista un marcador pendiente.
- La bitácora y el diagnóstico identifican la versión ejecutada.

## Límites de recuperación

La consulta de guardados pendientes exige respuesta del servidor, coincidencia de solicitud y del actor y la misma cuenta Firebase. La caché, una lectura fallida o la ausencia del registro no autorizan borrar el marcador ni anunciar que la operación falló definitivamente.

La revisión manual libera únicamente comandos financieros reconocidos y confirmados. Para ingresos, ventas y cotizaciones se conserva el borrador y se recupera enviando **la misma solicitud** mediante su formulario original. Los marcadores genéricos de versiones anteriores requieren revisión del historial; no se convierten en confirmaciones nuevas ni se eliminan a ciegas. Los marcadores están en la sesión de ese navegador; no son una cola offline ni una garantía de coordinación entre varios dispositivos.

No se ha probado esta candidata con los datos o las reglas desplegadas en producción. Las pruebas de navegador comprueban el comportamiento de la interfaz y de las transacciones simuladas; no sustituyen pruebas del servidor con identidades independientes. Ver `SEGURIDAD_FIREBASE.md` y `RECUPERACION_SEGURA.md` para los dos trabajos pendientes.

## Validación

Se conservan las pruebas existentes de PIN, permisos, inventario, ingresos, ventas, crédito, anticipos, préstamos, devoluciones, SAT, cierres y respaldo. Los nuevos casos reproducen los hallazgos y prueban la corrección, incluidos respuesta perdida, consulta sin escrituras, selección retirada y análisis inconsistente. La suite automática actual tiene 282 pruebas aprobadas en UTC. El resultado de Chromium en escritorio y móvil se adjuntará al PR tras ejecutar su CI.

La publicación requiere autorización expresa posterior a esta revisión. El PR se prepara como borrador; no debe tener fusión automática.
