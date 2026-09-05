# Auditoría profesional v1.2.4

Fecha de revisión: 2026-09-05  
Base revisada: `fix/integridad-v1.2.3` / PR #7  
Alcance: inventario, ventas, cotizaciones, crédito, anticipos, caja, retiros, devoluciones, anulaciones, resúmenes mensuales, respaldo, autenticación, PWA e interfaz.

## Resultado ejecutivo

La v1.2.4 conserva la estructura y los datos existentes, agrega los modelos visuales **Profesional** y **Clásico**, y cierra errores de integridad que podían dejar residuos de SAT, devolver dinero desde una ubicación equivocada, mantener métricas infladas o aceptar fracciones monetarias invisibles.

No se ejecutaron escrituras contra Firebase, despliegues ni cambios en `main`. Las correcciones se diseñaron para fallar antes de escribir cuando una venta nueva no conserva evidencia suficiente para una reversa exacta.

## Hallazgos corregidos

| Severidad | Hallazgo | Corrección aplicada |
|---|---|---|
| Crítica | Una anulación de pago mixto podía sacar todo el reembolso de una sola ubicación. | Reconstrucción exacta del historial y movimientos separados para efectivo y banco. |
| Crítica | Una huella de fondos incompleta o alterada podía desacoplar efectivo y fondos contables. | Validación de las cuatro partidas y de su suma exacta contra lo cobrado. Las ventas v4 fallan cerradas. |
| Alta | Dos devoluciones parciales podían dejar SAT y ganancia residuales. | Prorrateo acumulado en centavos; el último tramo cierra exactamente el total original. |
| Alta | Una anulación completa podía continuar después de una devolución parcial. | Bloqueo de esa ruta y uso obligatorio del flujo trazable de Caja. |
| Alta | Una venta modificada en otro dispositivo podía anularse usando una confirmación antigua. | Comparación de `revision` dentro de la transacción. |
| Alta | Una fecha o resumen dañado podía desacoplar una anulación, devolución o reemplazo del acumulado mensual. | Mes y documento mensual obligatorios antes de modificar ventas ya contabilizadas. |
| Alta | Precios, gastos, anticipos, envíos y retiros admitían más de dos decimales y los redondeaban silenciosamente. | Validador monetario único; entradas inválidas se rechazan antes de la transacción. |
| Alta | La compensación binaria podía inventar centavos o millonésimas en magnitudes grandes. | Redondeo simétrico acotado cerca de `.5` y verificación de enteros seguros. |
| Media | `ventasTotales` no disminuía si el artículo devuelto no reingresaba al inventario. | La métrica se revierte siempre; existencias y costo solo cambian si hay reingreso. |
| Media | Las cantidades de servicios evitaban la validación común. | Cantidades controladas hasta milésimas y rechazo de precisión adicional. |
| Media | Valores configurables de unidad o moneda podían alcanzar HTML dinámico sin neutralización completa. | Escape de salidas y normalización del símbolo monetario. |
| Media | Fechas inválidas podían producir claves mensuales o etiquetas incorrectas. | Analizador estricto de mes/año y salida segura. |
| Baja | El aviso de margen mostraba 10% aunque el objetivo fuera configurable. | El texto usa el margen configurado. |

## Pruebas realizadas

Se ejecutó la suite completa con Node 20 mediante:

```text
node --experimental-vm-modules --test tests/*.test.mjs
```

Resultado: **90 aprobadas, 0 fallidas, 0 omitidas**.

La suite incluye, entre otros:

- 100.000 líneas fraccionadas sin creación o pérdida de centavos.
- 50.000 devoluciones acumulativas, verificando cierre exacto.
- 50.000 historiales de cobro mixto, conservando efectivo, banco y total.
- 50.000 escenarios matemáticos con identidad ingreso = gastos + ganancia.
- 5.000 ciclos de venta y reversa sin residuo contable.
- 20.000 pagos de crédito, incluso en escenarios con pérdida.
- 9.990 productos para unicidad y capacidad de bloques de códigos.
- Sintaxis de JavaScript y JSON, estructura HTML, identificadores duplicados, caché PWA, protecciones transaccionales y escape de HTML.

La comprobación visual local fue estructural y responsiva a nivel de HTML/CSS. El entorno de auditoría no contiene un navegador ejecutable, por lo que antes de publicar se mantiene como verificación manual obligatoria revisar ambos modelos en un celular y una computadora reales.

## Interfaz v1.2.4

- **Profesional (nuevo):** superficie azul marino, contraste sobrio, jerarquía más clara, paneles amplios y mejor aprovechamiento de escritorio.
- **Clásico (anterior):** conserva la apariencia de la versión base.
- La preferencia se guarda solamente en el dispositivo y se aplica antes del primer render para evitar destellos.
- La selección del modelo visual es independiente del menú superior/lateral.
- En pantallas pequeñas se mantiene una sola columna y la geometría móvil existente.
- Clientes continúa dentro de Configuración y Caja dentro de Finanzas.

## Riesgos arquitectónicos pendientes

Estos puntos no se cambiaron en esta entrega porque requieren migración, infraestructura o una ventana de mantenimiento; mezclarlos con la corrección inmediata elevaría el riesgo para el sistema activo.

| Prioridad | Riesgo pendiente | Recomendación |
|---|---|---|
| Bloqueante de despliegue | Las reglas cerradas de Firestore del PR #7 bloquean todo acceso si se publican antes de vincular el UID real del Dueño. | Activar y verificar la cuenta propietaria, crear respaldo y luego desplegar reglas en una ventana controlada. |
| Alta | Los permisos de empleados y sus PIN se evalúan en el cliente mientras Firebase opera con la sesión del Dueño. | Autorización por usuario en reglas/claims o backend; no confiar en controles de interfaz para separar privilegios. |
| Alta | Una copia lee colecciones en momentos distintos y una restauración de varios lotes puede quedar parcial si falla un lote posterior. | Exportación administrada o restauración por espacio temporal, validación completa y conmutación controlada. |
| Alta | La restauración valida formato, IDs y conteos, pero no todos los tipos y relaciones de cada documento. | Incorporar esquemas por colección, comprobación cruzada de referencias y simulación previa sin escrituras. |
| Media | Los PIN usan SHA-256 sin sal; un PIN corto es vulnerable a fuerza bruta si se obtiene el almacenamiento local. | PBKDF2/Argon2 con sal individual, mayor longitud y migración gradual al iniciar sesión. |
| Media | Parte de los datos locales y la caché offline no está cifrada. | Política de dispositivo confiable, bloqueo por inactividad y cifrado/limpieza selectiva de datos sensibles. |
| Media | Los tiempos de auditoría dependen del reloj del dispositivo. | Guardar además un `serverTimestamp` y conservar el valor local solo para experiencia offline. |
| Media | Nombres duplicados de cliente o producto pueden crearse desde dispositivos concurrentes. | Reservar una clave normalizada en un documento único dentro de la misma transacción. |
| Media | Restaurar anticipos tras una devolución crea un registro agregado nuevo, no reabre los documentos originales. | Guardar referencias exactas de anticipos aplicados y restituir cada saldo por origen. |
| Media | Carritos excepcionalmente grandes pueden alcanzar límites de lecturas/escrituras de una transacción Firestore. | Definir un máximo operativo de líneas y dividir procesos masivos mediante backend idempotente. |
| Media | Gráficas y Excel dependen de CDN, y Chart.js no fija versión; una actualización externa puede cambiar comportamiento y sin red esas funciones no cargan. | Empaquetar versiones revisadas y fijadas de Chart.js/XLSX en el PWA, o usar versión exacta con integridad verificable. |
| Baja | La moneda es configurable, pero aún quedan textos históricos con `Q` fijo. | Sustituirlos de forma gradual por el símbolo normalizado, con regresión visual de reportes e imágenes. |

## Secuencia segura de publicación

1. Revisar primero el PR #7 y no desplegar sus reglas hasta verificar la cuenta real del Dueño.
2. Revisar esta v1.2.4 como PR apilado sobre #7.
3. Descargar una copia JSON completa del negocio.
4. Probar en un dispositivo secundario: contado, crédito, anticipo, pago mixto, devolución con y sin reingreso, anulación y los cinco retiros.
5. Revisar modelos Profesional y Clásico en escritorio y celular.
6. Integrar primero #7 y luego actualizar la base de la v1.2.4 o integrarla en ese mismo orden.
7. Publicar la aplicación; comprobar `sublicosturas-v1.2.4` y conservar el respaldo hasta cerrar la validación.

## Reversa

La v1.2.4 no exige migración ni elimina documentos. Para revertir la interfaz y el código basta volver al commit anterior. Las ventas nuevas incluyen evidencia adicional compatible con el código nuevo; antes de una reversa en producción debe conservarse la copia JSON y evitar registrar operaciones durante el cambio de versión.
