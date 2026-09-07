# Auditoría profesional v1.2.8 — simplicidad, interfaz e integridad

Fecha: 2026-09-07  
Base: `main` en `03d5f6c09102420bbf6bae9f62c51edd471c1e7f`

## Objetivo

Revisar SubliCosturas como sistema de operación diaria para un negocio pequeño: que sea profesional, matemáticamente consistente, fácil de aprender y seguro de modificar sin duplicar la lógica contable.

## Resultado ejecutivo

La base actual es sólida en las áreas matemáticas que más riesgo tienen: dinero en centavos, cantidades en milésimas, reversas acumuladas, pagos mixtos, crédito, préstamos y códigos. La suite existente ya cubre estrés de 100.000 líneas, 50.000 devoluciones, 50.000 historiales mixtos, 50.000 escenarios financieros, 20.000 pagos de crédito y 9.990 códigos.

La mejora v1.2.8 no reescribe esas fórmulas. Añade una capa visual moderna y configurable, una ayuda global, un diagnóstico de lectura y pruebas de integración adicionales. También actualiza la CI a Node 24.

## Cambios aplicados

### 1. Temas visuales

Se agregan cinco temas locales por dispositivo:

- Automático: sigue claro/oscuro del sistema.
- Azul Noche: apariencia profesional predeterminada.
- Claro: fondo luminoso para oficina.
- Grafito: oscuro neutral.
- Alto contraste: máxima legibilidad.

El tema es independiente del modelo **Profesional / Clásico**. No toca Firebase, ventas, inventario, permisos ni cálculos.

### 2. Interfaz Profesional modernizada

- Mayor consistencia de radios, tarjetas, campos y botones.
- Estados de foco visibles para teclado.
- Mejor aprovechamiento del ancho de escritorio.
- Navegación superior fija en escritorio cuando se usa el menú superior.
- Mejor tamaño táctil en móvil.
- Números tabulares en importes.
- Respeto a `prefers-reduced-motion`.
- Colores y superficies derivados del tema, en vez de quedar amarrados a un único oscuro.

### 3. Ayuda rápida

Se agrega un acceso flotante y discreto al Centro Inteligente. Lleva al campo de preguntas existente para que un usuario nuevo pueda preguntar con lenguaje normal sin buscar primero la función.

El Centro Inteligente también aprende la guía de temas y puede explicar cómo cambiar la apariencia.

### 4. Diagnóstico del sistema

Nueva sección colapsada en Opciones:

- núcleo matemático;
- Centro Inteligente;
- módulo financiero;
- interfaz principal;
- soporte Service Worker;
- conexión.

Es de solo lectura y no modifica datos.

### 5. Integridad y CI

Se agregan pruebas para:

- cinco temas y carga PWA;
- ausencia de escrituras remotas en los módulos visuales;
- ayuda del Centro Inteligente sobre temas;
- 20.000 escenarios de capacidad de préstamos sin tocar SAT ni dejar ubicación negativa;
- validación monetaria;
- botones HTML simples apuntando a funciones existentes;
- existencia de todos los archivos del `APP_SHELL`;
- accesibilidad básica de la capa moderna;
- Node 24 en GitHub Actions.

## Estado matemático y lógico

### Fortalezas actuales

- El dinero operativo se normaliza a centavos.
- Los costos unitarios admiten precisión controlada.
- Las cantidades se validan por unidad y paso.
- SAT se separa cuando corresponde y las pruebas conservan la identidad financiera.
- Las devoluciones parciales usan acumulación para cerrar exactamente el último centavo.
- Los pagos mixtos conservan ubicación efectivo/banco.
- Los préstamos descuentan saldo y fondos, y sus abonos restauran el desglose original.
- Los códigos de inventario mantienen unicidad y registro permanente.
- Las operaciones críticas usan transacciones y fallan cerradas ante cambios concurrentes conocidos.

### Riesgos que siguen pendientes

1. **Seguridad real por empleado — alta.** Los permisos visuales/PIN siguen siendo cliente; Firebase opera con la sesión propietaria. La solución profesional es Auth individual por empleado + reglas/claims/backend.
2. **Respaldo/restauración — alta.** Una restauración por lotes todavía merece una fase temporal/validación completa antes de conmutar.
3. **Auditoría horaria — media.** Conviene guardar `serverTimestamp` además de la hora del dispositivo.
4. **Duplicados concurrentes — media.** Cliente/producto deberían reservar una clave normalizada en transacción.
5. **Carritos gigantes — media.** Debe definirse un máximo operativo para no alcanzar límites de Firestore.
6. **Chart.js/XLSX externos — media.** Conviene fijar y empaquetar versiones locales para que reportes/gráficas funcionen offline y no cambien por CDN.
7. **`index.html` monolítico — media.** Es el principal riesgo de mantenibilidad. Conviene extraer por etapas Resumen, Ingreso, Ventas, Cotización, Usuarios y Centro Inteligente sin reescritura total.
8. **Trazabilidad de autor en ventas/cotizaciones — media.** La etiqueta de usuario añadida en v1.2.6 es secundaria a la transacción principal; si esa escritura falla puede faltar atribución.
9. **Versión técnica — baja.** La aplicación sigue declarando 1.2.5 aunque las mejoras incrementales internas hayan avanzado. Debe coordinarse un futuro corte de versión en `index`, `version.json`, `package.json` y caché PWA en una sola publicación.

## Ideas nuevas recomendadas, ordenadas por valor y simplicidad

### Próxima prioridad

**Buscador global de acciones.** Un cuadro “¿Qué quieres hacer?” que encuentre “registrar venta”, “devolver préstamo”, “ingresar taza”, “ver cliente”, etc., y abra la sección exacta. No crea otra pestaña y reduce mucho la curva de aprendizaje.

**Inicio por rol.** El Dueño ve finanzas, alertas y utilidad; un empleado ve solo tareas y secciones permitidas. Menos información irrelevante hace el sistema más sencillo.

**Borradores recuperables.** Guardar localmente un carrito/venta/cotización incompleta para recuperarla después de cerrar la app o perder señal.

**Estado de sincronización visible.** Un indicador pequeño: En línea / Sin conexión / Guardando / Sincronizado. Evita dudas sobre si una operación llegó a la nube.

### Segunda etapa

**Órdenes de compra a proveedor.** Desde Por Surtir generar una orden imprimible/Excel por distribuidor sin convertirla todavía en ingreso.

**Historial de proveedor y último costo.** Mostrar último precio, variación y fecha de compra al surtir.

**Cuentas por cobrar por vencimiento.** Unificar crédito y préstamos en una agenda de cobros sin mezclar su contabilidad.

**Etiquetas QR/código de barras.** Usar el código permanente de inventario para localizar un producto con cámara o lector.

**Cierre diario guiado.** Checklist de caja, banco, ventas, créditos y anomalías con confirmación del Dueño.

### Etapa de arquitectura

**Usuarios Firebase individuales y permisos de servidor.**  
**Modularización gradual del `index.html`.**  
**Dependencias locales versionadas.**  
**Respaldo transaccional validado por esquema.**

## Criterio de diseño recomendado

Cada función nueva debería cumplir cuatro reglas:

1. Si no se usa todos los días, debe estar colapsada o en Opciones.
2. Una acción crítica debe mostrar qué va a cambiar antes de confirmar.
3. La ayuda debe explicar y navegar; nunca duplicar la contabilidad.
4. La interfaz puede cambiar de tema/modelo, pero una misma operación debe ejecutar exactamente la misma lógica de negocio.
