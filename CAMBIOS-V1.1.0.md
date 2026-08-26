# SubliCosturas 1.1.0 — integridad y Studio

## Antes de publicar

- Rama de respaldo: `respaldo/v1.0.9-antes-v1.1.0`.
- Rama de trabajo: `mejoras/v1.1.0-integridad-studio`.
- No mezclar directamente en `main`: revisar y aprobar el pull request.
- Hacer una exportación/backup de Firestore antes de ejecutar la migración de códigos en producción.

## Primer uso después de actualizar

1. Entrar como Dueño y abrir **Inventario**.
2. Pulsar **Verificar códigos únicos** una sola vez.
3. Esperar el mensaje de finalización. La operación revisa todo el inventario en lotes seguros, detecta códigos heredados duplicados y crea `codigos_inventario/{codigo}`.
4. Si se interrumpe la conexión, ejecutar la opción otra vez. Los lotes confirmados no se deshacen y la verificación continúa de forma segura.
5. Después de finalizar, cada ingreso nuevo asigna y reserva su código dentro de la misma transacción del inventario.

Los códigos eliminados se marcan como `retirado`; no vuelven a asignarse a otro producto.

## Cambios de integridad

- Dinero normalizado a centavos en ventas, cotizaciones y retiros.
- Edición de ventas como borrador: la venta original no se revierte al abrirla. El stock, fondos, venta y resumen mensual se reemplazan juntos al confirmar.
- Edición manual de inventario transaccional, con detección de cambios concurrentes y bitácora en `ajustes_inventario`.
- Cambios de usuarios esperan confirmación de Firebase, se escriben con `await` y usan `usuariosRevision` para detectar conflictos entre dispositivos.
- Un equipo nuevo sin usuarios locales permanece bloqueado hasta que Firebase confirme si existe o no un Dueño.
- La rueda del mouse deja de alterar inputs numéricos; continúa desplazando la página.
- Los reportes Excel usan celdas numéricas y descargan ventas, ingresos, cotizaciones y retiros completos.
- El análisis de abastecimiento consulta todas las ventas de los últimos 30 días.
- Los datos escritos por formularios se guardan sin entidades HTML; el escape se aplica al mostrarlos.

## SubliCosturas Studio

Studio vive en `/studio/` y es independiente del inventario. Usa la File System Access API para escribir dentro de una carpeta elegida por el usuario:

`SubliCosturas_Proyectos / CLIENTE / PRODUCTO / FECHA-CÓDIGO-DISEÑO`

Cada proyecto guarda sus archivos originales y un `proyecto.json`. El índice rápido vive en IndexedDB, pero puede reconstruirse leyendo esos archivos de metadatos. No se guardan los archivos grandes en `localStorage` ni se suben a Firebase.

Para escritura directa se recomienda Chrome o Edge de escritorio bajo HTTPS o localhost. Otros navegadores pueden no ofrecer `showDirectoryPicker`.

## Reversión

Si el cambio no se aprueba o aparece una incidencia:

1. No mezclar el pull request, o hacer `revert` del commit de mezcla si ya se publicó.
2. Desplegar `respaldo/v1.0.9-antes-v1.1.0`.
3. Los documentos de `codigos_inventario` y `ajustes_inventario` son aditivos; la versión 1.0.9 los ignora. No es necesario borrarlos para volver a operar.
4. Las carpetas de Studio son archivos normales y permanecen en la PC. Eliminarlas nunca forma parte de la reversión de la app.
5. Si se requiere restaurar datos de negocio, usar el backup de Firestore realizado antes de la migración.

## Límites deliberados

- Studio cataloga y conserva `.cdr`, `.psd`, `.ai` y otros formatos como archivos; no intenta editarlos ni interpretarlos.
- La migración a Firebase Authentication y reglas cerradas no se incluye automáticamente porque requiere revisar las reglas activas y coordinar cuentas sin bloquear el sistema existente. Debe realizarse como una fase separada con entorno de prueba y backup.
