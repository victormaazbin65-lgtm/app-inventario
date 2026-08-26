# SubliCosturas 1.1.1 — buscador integrado de diseños

## Cambio principal

- Se retiró la aplicación externa Studio y su acceso desde Opciones.
- Se agregó **Diseños** como pestaña principal, visible para el Dueño.
- El usuario elige cualquier carpeta existente y el sistema cataloga nombres, formatos, fechas y rutas relativas en un índice local.
- La búsqueda tolera acentos, plurales, palabras parciales, errores pequeños y sinónimos frecuentes como pachón/botella/termo o playera/camiseta.
- Cada resultado muestra la ubicación y permite copiarla.

## Protección de archivos y del sistema

- El buscador solicita solamente permiso de lectura.
- No crea, copia, mueve, renombra ni elimina archivos o carpetas.
- No usa Firebase y no modifica inventario, ventas, ingresos, cotizaciones, fondos ni usuarios.
- El índice guarda solo metadatos pequeños en IndexedDB. **Olvidar carpeta** borra ese índice, nunca los archivos originales.
- Para actualizar archivos nuevos o eliminados se usa **Actualizar catálogo**.

## Compatibilidad

La selección directa de carpetas requiere Chrome o Edge de escritorio mediante HTTPS o localhost. Por seguridad del navegador, la ubicación mostrada comienza en la carpeta elegida y no revela necesariamente la letra de la unidad de Windows.

## Reversión

- Respaldo exacto anterior: `respaldo/v1.1.0-antes-buscador-integrado`.
- Si fuera necesario volver, se puede revertir el commit de publicación o desplegar esa rama.
- La reversión no modifica ni elimina los archivos de trabajo del usuario.
