# Auditoría profesional v1.3.0 — operación simple sobre una base más completa

Fecha: 2026-09-08  
Base pública conservada: `1.2.5`  
Build interno de esta etapa: `1.3.0`  
PR: `#13`

## Objetivo

Hacer que SubliCosturas se comporte cada vez más como un sistema profesional de operación diaria sin convertirlo en una aplicación complicada. La regla de diseño usada en esta etapa fue: **más capacidad por dentro, menos pasos y menos pestañas por fuera**.

No se reescribieron las fórmulas de ventas, SAT, costos, crédito, devoluciones, préstamos o inventario que ya estaban sometidas a pruebas de estrés. Las funciones nuevas se agregaron en módulos independientes y el `index.html` principal no fue modificado en esta entrega.

## Exclusiones expresas

Por decisión del usuario, esta etapa **no implementa**:

- cuentas Firebase individuales por empleado / autorización de servidor por empleado;
- productos favoritos, accesos frecuentes o repetir automáticamente la última venta.

Los permisos existentes continúan funcionando con el modelo actual. Esto significa que la separación visual por empleado mejora la experiencia, pero no sustituye una autorización individual de servidor.

## Mejoras aplicadas

### Buscador global de acciones

Se agrega **“¿Qué quieres hacer?”**, disponible también con `Ctrl/Cmd + K`.

Permite localizar acciones por lenguaje cotidiano, por ejemplo:

- hacer una venta;
- crear cotización;
- ingresar producto;
- buscar inventario;
- ver Por Surtir;
- abrir clientes;
- ver caja;
- registrar/devolver préstamo;
- abrir agenda de cobros;
- generar orden de compra;
- hacer cierre diario;
- imprimir etiquetas;
- cambiar tema;
- crear respaldo;
- abrir diagnóstico;
- buscar diseños.

El motor filtra las opciones de acuerdo con el rol y el permiso financiero existente. Se corrigió además un caso real descubierto por CI: la búsqueda inicial por subcadenas confundía `venta` con `inventario`; ahora trabaja con palabras y prefijos reales.

### Inicio contextual y salud del negocio

Inicio incorpora un panel de **Estado del negocio y prioridades**.

Puede mostrar, según permisos:

- ventas del día;
- utilidad del día;
- cuentas por cobrar;
- productos agotados;
- productos con stock bajo;
- cantidad de productos activos;
- prioridades ordenadas por urgencia.

Los empleados sin permiso financiero no reciben cifras internas de utilidad o cuentas por cobrar.

### Agenda de cobros

Créditos y préstamos se presentan en una misma agenda para facilitar seguimiento por vencimiento, pero **siguen siendo operaciones contables distintas**.

La agenda prioriza:

1. vencidos;
2. los que vencen hoy;
3. próximos;
4. sin fecha.

No convierte préstamos en créditos ni modifica los documentos originales.

### Sincronización visible

La interfaz muestra un estado pequeño:

- `Sincronizado`;
- `Guardando…`;
- `Sin conexión · modo consulta`.

Las operaciones críticas continúan usando las validaciones de conexión y las transacciones existentes.

### Borradores recuperables

Venta, Cotización e Ingreso guardan un borrador local cuando ya contienen líneas.

- se guarda en el dispositivo;
- se actualiza periódicamente y antes de cerrar la página;
- se puede continuar o descartar desde Inicio;
- caduca después de 72 horas;
- se elimina al completar correctamente la operación correspondiente.

El borrador no escribe inventario ni dinero en Firebase.

### Centro Inteligente ampliado

El Centro Inteligente puede responder además:

- “¿Cómo va mi negocio?”;
- “¿Qué tengo pendiente?”;
- “¿Qué debo cobrar?”;
- “¿Cuál fue el último costo de este producto?”;
- “¿Qué proveedor tiene este producto?”;
- cómo generar una orden de compra;
- cómo hacer el cierre diario;
- cómo imprimir etiquetas;
- cómo recuperar borradores;
- qué significa el estado de sincronización.

Las respuestas financieras respetan el permiso financiero existente.

### Órdenes de compra

Por Surtir puede preparar una orden por proveedor reutilizando el cálculo de surtido existente.

La orden muestra:

- código;
- producto;
- stock actual;
- cantidad sugerida;
- costo unitario actual;
- subtotal;
- total estimado.

Se puede imprimir, exportar a Excel/CSV o guardar en `ordenes_compra`.

**Crear o guardar una orden no aumenta inventario.** La mercancía debe registrarse desde Ingreso cuando realmente se recibe.

### Historial de costos

Inventario incluye un panel para revisar costos encontrados en ingresos anteriores:

- fecha;
- proveedor;
- costo registrado;
- variación contra la compra anterior.

Este análisis es informativo y no modifica el costo actual.

### Cierre diario y conteo de caja

Inicio incorpora un cierre guiado para el Dueño:

- efectivo esperado;
- efectivo contado;
- banco esperado;
- banco comprobado;
- diferencia por ubicación;
- diferencia total.

El cierre se guarda en `cierres_diarios` junto con usuario, fecha, resumen del día y cuentas pendientes.

**Registrar una diferencia no corrige ni modifica automáticamente efectivo o banco.** Deja evidencia para revisar el origen del descuadre.

### CRM resumido

Dentro de Clientes se agrega un resumen contextual de la ficha:

- cantidad de compras;
- total comprado (si el usuario puede ver finanzas);
- saldo de crédito;
- anticipos disponibles;
- última compra;
- notas existentes.

No se creó una nueva pestaña CRM.

### Etiquetas con código de barras

Inventario puede generar una etiqueta Code39 usando el código permanente ya asignado al producto.

El código de barras se genera localmente como SVG y no depende de un servicio externo de QR/barcode.

### Auditoría y errores

Se incorpora una auditoría secundaria en `auditoria_sistema` para registrar actividad alrededor de operaciones importantes cuando la operación principal realmente cambió estado.

También se guardan localmente errores JavaScript recientes. El Dueño puede enviar un diagnóstico a `errores_sistema` para revisión.

La auditoría secundaria se diseñó para **no hacer fallar una venta o movimiento principal que ya terminó correctamente**. Por ello no es atómica con la operación financiera original y, si falla su propia escritura, puede faltar una entrada de auditoría aunque la operación principal exista.

Se intenta incluir `serverTimestamp` además de la hora local en los registros nuevos que lo permiten.

### Protección contra duplicados concurrentes

Se agrega una reserva en `indices_nombres`:

- productos: clave normalizada de categoría/nombre/descripción durante la ruta de reserva de ingreso;
- clientes: NIT real cuando existe, o teléfono como identidad alternativa.

Los clientes con el mismo nombre siguen estando permitidos. El objetivo es evitar duplicados inequívocos, no prohibir homónimos.

Esta protección cubre la ruta transaccional de ingreso/reserva y el guardado de clientes nuevo; no debe interpretarse todavía como una migración completa de **todas** las rutas históricas de edición de inventario.

### Respaldo v4

La copia JSON avanza a `schemaVersion: 4` y agrega:

- colecciones profesionales nuevas;
- orden determinista de documentos;
- firma SHA-256 cuando Web Crypto está disponible;
- verificación obligatoria de la firma al restaurar una copia v4;
- validaciones de tipos/esquema para colecciones importantes;
- compatibilidad explícita con copias antiguas v1-v3;
- copia previa obligatoria antes de restaurar;
- restauración en lotes de hasta 400 escrituras;
- bitácora `restauraciones_sistema` con estados `validada`, `aplicando`, `completa` o `incompleta`;
- verificación posterior de una muestra de cada colección restaurada.

Limitación importante: Firestore no permite convertir una restauración arbitrariamente grande hecha desde el cliente en una única transacción atómica. Si falla un lote intermedio, la restauración se marca como **incompleta** y se conserva el respaldo previo para recuperación. La mejora reduce riesgo y hace el fallo trazable, pero no promete all-or-nothing para bases enormes.

### Modo de capacitación

Apariencia e interfaz incorpora un modo opcional por dispositivo que muestra tres pasos cortos en las pantallas principales. Puede desactivarse cuando el usuario ya conoce el flujo.

### Dependencias y funcionamiento sin red

Chart.js queda fijado a `4.5.1` y XLSX a `0.18.5` en la capa profesional.

El Service Worker guarda esas URLs en caché después de la primera descarga correcta. Esto mejora estabilidad y permite reutilizarlas sin red posteriormente.

Limitación: todavía **no son archivos físicos empaquetados dentro del repositorio**; la primera descarga de esas dependencias requiere Internet. El empaquetado físico puede hacerse en una etapa posterior con un proceso de build controlado.

### Modularización

Esta entrega es la **fase 1 de modularización profesional**:

- todas las funciones nuevas viven fuera de `index.html`;
- se agregan núcleos puros, UI, operaciones, compatibilidad y ajustes del asistente como módulos separados;
- `index.html` no se modificó.

El gran código legado que todavía vive en `index.html` no se extrajo en masa porque hacerlo junto con todas estas mejoras aumentaría mucho el riesgo de regresión. La extracción futura debe hacerse pantalla por pantalla con pruebas después de cada paso.

## Invariantes conservadas

- La regla SAT existente no fue reescrita.
- El dinero operativo continúa usando centavos en el núcleo existente.
- Una orden de compra no modifica existencias.
- Un cierre diario no cambia efectivo ni banco.
- La agenda de cobros no mezcla la contabilidad de préstamo y crédito.
- Los borradores no escriben movimientos financieros.
- Las mejoras visuales no cambian fórmulas.
- La versión pública coordinada permanece en `1.2.5` para no crear un ciclo de actualización parcial; `build-info.json` identifica esta capa como build interno `1.3.0`.

## Pruebas finales de la rama

GitHub Actions ejecutó la suite completa con Node 24.

Resultado final antes de integrar:

- **136 pruebas aprobadas**;
- **0 fallidas**;
- 0 omitidas.

La suite conserva, entre otras, las pruebas de estrés anteriores:

- 100.000 líneas fraccionadas;
- 50.000 devoluciones segmentadas;
- 50.000 historiales de cobro mixto;
- 50.000 escenarios financieros;
- 20.000 pagos de crédito;
- 20.000 escenarios de capacidad de préstamos;
- 9.990 códigos de inventario.

Y agrega pruebas específicas de esta etapa para buscador global, permisos financieros, agenda de cobros, salud del negocio, órdenes, cierre, Code39, borradores, auditoría, reservas concurrentes, Centro Inteligente, PWA, dependencias fijadas, respaldo v4 y las dos exclusiones expresas.

## Riesgos que siguen abiertos

### Seguridad por empleado

Permanece el modelo actual solicitado por el usuario. Los PIN/permisos de empleados continúan siendo principalmente una capa cliente mientras Firebase opera bajo la autorización propietaria. No se implementó Auth individual por empleado.

### Auditoría no atómica

La auditoría nueva es secundaria. Para una trazabilidad legal/empresarial estrictamente atómica sería necesario mover la operación y su auditoría a un backend/Cloud Function o equivalente.

### Restauración grande

La restauración v4 es mucho más verificable, pero sigue siendo por lotes desde el cliente y no una única transacción global.

### Modularización legado

El archivo `index.html` sigue siendo demasiado grande. La arquitectura nueva evita seguir ampliándolo, pero todavía falta extraer las secciones históricas una por una.

### Dependencias externas

Chart.js/XLSX están fijadas y cacheables, pero no empaquetadas físicamente todavía.

### Versión pública

La capa interna ya se identifica como build `1.3.0`; el corte público sigue en 1.2.5. Un futuro cambio de versión debe hacerse de una vez y coordinado en `index.html`, `version.json`, `package.json` y caché PWA.

## Conclusión

La etapa v1.3.0 aumenta significativamente la capacidad de operación, seguimiento y recuperación sin añadir un conjunto nuevo de pestañas principales ni reescribir la contabilidad existente. El siguiente trabajo estructural recomendable, después de observar esta versión estable en uso real, es continuar la extracción gradual del `index.html` y después empaquetar físicamente las dependencias externas.
