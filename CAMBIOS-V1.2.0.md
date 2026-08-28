# Cambios de SubliCosturas v1.2.0

Esta versión amplía la aplicación para operar un negocio pequeño sin cambiar ni borrar automáticamente el historial anterior. Las ventas e ingresos nuevos guardan una versión de cálculo propia; los registros antiguos conservan sus cifras.

## Acceso y configuración del negocio

- Cuenta real del Dueño con Firebase Authentication por correo y contraseña.
- Recuperación de contraseña por correo.
- Nombre del negocio, moneda, porcentaje SAT, margen objetivo y etiquetas de producción y mano de obra configurables.
- Logo sincronizado entre dispositivos y controles sensibles limitados al rol Dueño.
- Reglas de Firestore preparadas para cerrar la base al UID del Dueño después de activar la cuenta.

## Clientes, ventas y cobros

- Fichas de clientes con nombres, apellidos, teléfono, dirección, NIT, notas y límite de crédito.
- Ventas al contado o a crédito.
- Pagos en efectivo, transferencia o depósito, con separación entre caja y banco.
- Abonos posteriores y saldo pendiente por cliente.
- Anticipos recibidos, aplicados a una venta o devueltos.
- Mano de obra opcional en ventas y cotizaciones.
- Límite de crédito comprobado nuevamente dentro de la transacción.

El inventario se descuenta al confirmar una venta a crédito, pero los fondos aumentan únicamente por lo que ya fue pagado o aplicado como anticipo. Cada abono distribuye exactamente los mismos centavos cobrados.

## Caja, banco y préstamos

- Panel de efectivo, banco, crédito por cobrar y anticipos pendientes.
- Traslados entre efectivo y banco sin cambiar la ganancia.
- Retiros con origen, motivo y desglose de fondos.
- Préstamos entregados con persona, motivo, fecha esperada y saldo pendiente.
- Abonos de préstamos que restituyen proporcional y exactamente los fondos de origen.
- Bitácora de movimientos de caja.

El fondo configurable de producción/operación reserva producción, mano de obra y envío. En las ventas y en Excel esos tres gastos continúan mostrándose por separado.

## Devoluciones y pérdidas

- Devolución parcial de artículos con reembolso, reducción de crédito y restauración de anticipos.
- Reingreso opcional del producto al inventario.
- Anulación total con devolución del dinero realmente pagado, sin reembolsar dos veces un anticipo.
- Registro de pérdidas de inventario sin crear ventas ni ingresos de dinero.
- Actualización conjunta de venta, cliente, inventario, fondos, caja y resumen mensual.

## Unidades e ingresos de inventario

- Unidades enteras y fraccionables: piezas, pares, medidas de longitud, área, peso, volumen y tiempo.
- Unidades personalizadas.
- Conversión de empaques mediante cantidad comprada × contenido por compra.
- Costo por unidad o costo total del empaque.
- Distribución exacta del transporte entre líneas, incluso cuando hay menos centavos que productos.
- Cantidades guardadas en milésimas y costos unitarios con seis decimales para evitar pérdidas por división.
- Validación de la unidad tanto en pantalla como dentro de la transacción de venta.

## Copias y reportes

- Copia completa JSON para restauración.
- Validación de formato, identificadores repetidos y tamaño máximo antes de restaurar.
- Punto de restauración automático antes de escribir cualquier documento.
- La restauración no borra documentos adicionales ni reemplaza el UID propietario actual.
- Excel legible con resumen, inventario, ventas, ingresos, cotizaciones, clientes, retiros, anticipos, préstamos, devoluciones, pérdidas y movimientos de caja.

## Archivos y organización

- `negocio-core.js`: reglas matemáticas, unidades, configuración, fondos y clientes.
- `gestion-negocio.js`: configuración, autenticación, logo, clientes y unidades.
- `finanzas-negocio.js`: caja, créditos, anticipos, préstamos, devoluciones y pérdidas.
- `respaldo-negocio.js`: copia y restauración.
- `firestore.rules`, `firebase.json` y `SEGURIDAD_FIREBASE.md`: protección del servidor.

## Verificación realizada

- 51 pruebas automáticas aprobadas.
- 50,000 escenarios de cálculo financiero.
- 20,000 escenarios de pagos a crédito, incluidos casos con pérdida.
- 20,000 escenarios de retiros en centavos.
- 5,000 ventas agregadas y revertidas del resumen mensual.
- 9,990 asignaciones de códigos de inventario.
- Validación de sintaxis de HTML, JavaScript, módulos, JSON y PWA.

## Activación necesaria en Firebase

La pantalla de correo ya está integrada, pero la protección del servidor requiere una acción administrativa:

1. Habilitar **Correo/Contraseña** en Firebase Authentication.
2. Activar la cuenta desde **Opciones > Cuenta real del Dueño**.
3. Publicar las reglas con `firebase deploy --only firestore:rules`.

Consultar `SEGURIDAD_FIREBASE.md` antes de usar cuentas reales.
