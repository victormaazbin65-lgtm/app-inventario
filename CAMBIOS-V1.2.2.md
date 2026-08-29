# Cambios de SubliCosturas v1.2.2

## Ingreso de productos

- Se restauró una forma clara de ingresar compras como **unidades sueltas** o como **lote o paquete**.
- Un lote convierte de forma visible `cantidad de lotes × unidades por lote` y calcula el costo unitario desde el costo total.
- La medida, el tamaño o la presentación son opcionales y están separados del cálculo de existencias.
- La medida descriptiva puede agregarse también a un producto existente y solo actualiza su descripción.
- La lista previa muestra la conversión del lote antes de guardar.

## Interfaz

- Caja ya no aparece en la navegación principal; permanece accesible desde el Panel de Finanzas.
- Clientes se trasladó a Configuración junto con directorio, cuentas por cobrar y anticipos.
- Todas las áreas de Configuración aparecen cerradas y se expanden al seleccionarlas.
- Las operaciones secundarias de Caja también son plegables para conservar una vista más limpia.

## Seguridad matemática

- La cantidad de lotes debe ser un entero mayor que cero.
- La cantidad final y el costo unitario se calculan en la capa central de negocio.
- La actualización descriptiva de un producto existente se valida dentro de la misma transacción del ingreso.
- Editar o anular un ingreso restaura también la descripción anterior cuando corresponde.
