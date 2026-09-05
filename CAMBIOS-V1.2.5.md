# SubliCosturas 1.2.5 — Plan de surtido por distribuidor

## Resultado

La pestaña **Por Surtir** ahora sirve tanto para revisar artículos individuales como para preparar una compra concentrada con una sola empresa.

## Cambios

- Selector de vista **Productos / Distribuidores**.
- Filtro por distribuidor o proveedor y búsqueda por producto, categoría, código o empresa.
- Agrupación por empresa con cantidad de productos, agotados y costo mínimo conocido.
- Cálculo conservador de compra mínima: lleva cada producto exactamente un paso de su unidad por encima del mínimo configurado.
- Compatibilidad con unidades enteras y fraccionables hasta milésimas.
- Productos sin distribuidor quedan visibles en **SIN DISTRIBUIDOR ASIGNADO**.
- Costos faltantes o inválidos se muestran para revisión y no contaminan los totales.
- Exportación Excel según la vista y los filtros; la vista por distribuidores incluye una hoja resumen y otra de detalle.
- La preferencia Productos/Distribuidores se guarda únicamente en el dispositivo.
- Diseño adaptable para computadora y celular, compatible con los modelos Profesional y Clásico.

## Seguridad y compatibilidad

- No se modifica el esquema de inventario ni se migra ningún documento.
- No se escriben cantidades, proveedores ni compras desde esta pantalla.
- La función es informativa y reutiliza el proveedor que ya tiene cada producto.
- La regla SAT permanece igual: solo se calcula cuando el cliente solicita factura.

## Verificación

- Pruebas matemáticas para unidades enteras y fraccionables.
- Consolidación exacta de costos en centavos.
- Estrés con 20.000 productos distribuidos entre 40 empresas.
- Regresión completa del inventario, ventas, devoluciones, caja, seguridad y PWA.
