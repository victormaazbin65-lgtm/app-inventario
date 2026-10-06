# Correcciones de la auditoría — Sublicosturas 1.4.0

Base revisada: `1b67cae2dab5099f60c787d086c98f43dc97c225`. Cambios preparados sobre una rama aislada, sin consultar ni modificar la base de Firebase de producción. Se conserva el comportamiento configurado del SAT, la contabilidad histórica y el arranque diferido para Android.

## Errores reproducidos y correcciones

| Caso | Corrección aplicada | Comprobación |
|---|---|---|
| SC-01 | La edición guarda la versión y la ficha al abrirse; rechaza una existencia modificada mientras el formulario estaba abierto. | Una venta deja stock 8; el formulario antiguo no lo devuelve a 10. |
| SC-02 | La venta compara unidad y tipo actuales del producto con el carrito. | Un carrito en metros no descuenta centímetros tras un cambio de unidad. |
| SC-03 | La devolución distingue pérdida económica nueva de fondos previamente retirados. | Una devolución válida registra utilidad -2 sin inventar un retiro; se conservan los controles de liquidez. |
| SC-04 | Ingresos, ventas y operaciones financieras distinguen commit confirmado de fallo de pantalla. | Un render fallido no anuncia que una operación guardada fue cancelada. |
| SC-05 | Borrar, renombrar y cambiar categoría mantiene los índices de nombres; una reserva comprueba si su propietario todavía existe. | Se puede crear un producto equivalente después de eliminar su ficha; los códigos retirados siguen sin reutilizarse. |
| SC-06 | Vaciar el carrito elimina el borrador activo; el arranque no borra borradores pendientes de recuperar. | No reaparece una línea eliminada. |
| SC-07 | Historial de costos excluye ingresos anulados y diferencia compra por unidad de promedio posterior. | Se muestra Q8 de compra y no Q6 de promedio ni el ingreso anulado. |
| SC-08 | Los reportes identifican el cobro acumulado de las ventas del período y muestran por separado entradas/salidas de caja por fecha de movimiento. | Un abono posterior no se confunde con una venta realizada ese día. |
| SC-09 | Recuperación con vista previa, detección de documentos extra/cambios posteriores y escritura atómica limitada. | Una copia antigua no mezcla stock y fondos antiguos con ventas actuales. Ver límites en RECUPERACION_SEGURA.md. |
| SC-10 | Validación de campos numéricos obligatorios, IDs y configuración financiera. | Se rechazan productos sin stock/costo, ventas sin total y fondos inválidos. |
| SC-11 | La orden de compra vuelve a dibujarse aunque sus proveedores no cambien. | Un nuevo faltante del mismo proveedor actualiza cantidades y estimado. |
| SC-12 | Módulos con rutas de versión inmutables, manifiesto SHA-256 y actualización solicitada por el usuario. | HTML nuevo no reutiliza JS mutable antiguo; no se recarga automáticamente durante una operación. |
| SC-13 | Se conserva el total original de la compra y su residuo de conversión. El inventario utiliza el costo derivado del total exacto. | Q100 / 30,000 unidades conserva Q100; editar otro campo no redondea otra vez ese costo. |
| SC-14 | El snapshot actualiza el rol de la sesión; cada transacción contrasta usuario, PIN y permisos con la configuración del servidor. | Una sesión con rol revocado no puede confirmar nuevas escrituras desde esta versión. |

## Mejoras adicionales

- Revisión global del sistema y bitácora dentro de la misma transacción de los comandos. Las escrituras administrativas también pasan por este control.
- Identificador persistente durante un reintento no confirmado; la misma operación pendiente consulta su registro para evitar un segundo efecto. Si hubo un error de conexión, revisar el resultado antes de cambiar los datos del formulario o repetir una operación distinta. Esto no sustituye la verificación operativa después de una respuesta incierta.
- Autor inicial conservado y editor registrado por separado. Se evita la segunda escritura de autor/auditoría que podía fallar después de la venta.
- Borradores separados por cuenta Firebase y usuario PIN. Las copias antiguas compartidas del dispositivo sólo se ofrecen al Dueño con aviso al recuperarlas.
- Clientes homónimos identificados en el selector por contacto e ID; escribir un nombre ambiguo no enlaza automáticamente a la primera ficha.
- Consulta completa y paginada de reportes bajo demanda; la vista local indica su alcance parcial. Cierre diario con saldos confirmados y fecha de Guatemala.
- Versión coherente 1.4.0 y construcción reproducible de recursos. El constructor rechaza modificar recursos de una versión ya publicada.
- CI conserva las pruebas de negocio e incorpora un recorrido de navegador con Firebase simulado, en tamaño escritorio y móvil. No hay escrituras de prueba en producción.

## Validación y alcance

Resultado local final: 232 pruebas aprobadas, cero fallos. Se verificó que los 22 módulos publicados coinciden con sus fuentes y sus hashes SHA-256. La comprobación de navegador aún no se ejecutó: la descarga de Chromium falló en este entorno. La publicación y GitHub Actions permanecen pendientes porque la revisión automática bloqueó el push al repositorio público.

Ejecutar `npm run build` y `npm test`. Para la interfaz: instalar `playwright@1.62.1`, ejecutar `npx playwright install --with-deps --only-shell chromium` y `npm run test:browser`. GitHub Actions ejecuta estos controles antes de integrar la entrega.

La suite conserva las 198 pruebas anteriores, agrega los 14 casos de la auditoría y pruebas de atomicidad, reintentos, permisos, concurrencia y consultas completas. Las expectativas antiguas de versión/ruta, auditoría secundaria y recuperación por lotes se actualizaron al nuevo comportamiento. No se desactivaron pruebas de negocio.

Los ensayos usan memoria y un Firebase simulado. No prueban reglas de seguridad contra el emulador, el servidor real ni un Redmi físico. La prueba móvil del navegador verifica la interfaz y la ejecución con una pantalla estrecha; no mide el rendimiento o estabilidad del dispositivo real.

## Trabajo que todavía requiere una migración o decisión operativa

1. **Permisos por empleado en Firebase.** Las reglas actuales identifican al UID del propietario. Varios empleados usando esa misma cuenta y PIN no equivalen a identidades Firebase independientes. El control nuevo protege el flujo de esta app, pero no evita que alguien con acceso a esa cuenta use directamente el SDK. Separar identidades y datos privados/costos requiere una migración de autenticación y reglas probada antes de desplegarla. No se cambiaron esas reglas ni se expuso un acceso público para facilitar la entrega.
2. **PIN y datos locales.** El PIN conserva el formato histórico de hash sin sal. La separación de borradores no cifra el almacenamiento local ni cambia las credenciales de los usuarios existentes.
3. **Recuperaciones grandes e históricas.** Están canceladas en el navegador por seguridad. No se añadió un importador administrativo de producción ni se promete una recuperación parcial como completa.
4. **Historial financiero anterior.** No se reconstruyeron movimientos de caja que las versiones antiguas nunca registraron. Los reportes de caja advierten este alcance.
5. **Arquitectura y crecimiento.** `index.html` sigue siendo grande; una división completa debe hacerse por módulos y regresiones, sin reescribir de golpe el sistema operativo. La revisión global añade lecturas y escrituras a cada comando, y puede aumentar la contención entre dispositivos. Medir lecturas, tamaño de configuración y tiempos con datos reales antes de migrar esta coordinación a un servidor.
6. **Validación real.** Después de publicar, comprobar acceso, venta, compra, abono, devolución y actualización en el Redmi, con cantidades pequeñas habituales y respaldo reciente. Esta entrega no ejecuta ventas, restaura copias ni despliega reglas en producción.

No se modificaron cifras históricas automáticamente. Un error antiguo ya guardado necesita revisión de su operación concreta y corrección contable trazable; cambiar el código evita su repetición, pero no identifica ni recalcula automáticamente todas las ventas pasadas.
