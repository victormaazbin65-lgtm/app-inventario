# SubliCosturas Studio

Aplicación local para organizar trabajos por tres ejes principales: cliente, diseño y producto.

## Qué guarda

Studio acepta cualquier archivo seleccionado por el usuario: CorelDRAW (`.cdr`), Photoshop (`.psd`), Illustrator (`.ai`), SVG, PDF, imágenes, documentos y formatos futuros. Los bytes se copian directamente a una carpeta normal del disco; el navegador no necesita entender el formato.

## Estructura

Al elegir, por ejemplo, `D:\TRABAJOS`, Studio crea:

```text
D:\TRABAJOS\SubliCosturas_Proyectos\CLIENTE\PRODUCTO\FECHA-CODIGO-DISEÑO\
```

Dentro quedan los archivos originales y `proyecto.json`. Esto permite encontrar el trabajo desde el Explorador de Windows aunque la aplicación no esté abierta.

## Índice y recuperación

- IndexedDB conserva un índice pequeño con nombres, etiquetas, rutas y tamaños; no duplica los archivos grandes.
- **Reconstruir catálogo** recorre `SubliCosturas_Proyectos` y recupera cada proyecto desde su `proyecto.json`.
- **Exportar índice** descarga una copia JSON adicional del catálogo.
- Copiar `SubliCosturas_Proyectos` a otro disco respalda archivos y metadatos juntos.

## Compatibilidad

La escritura directa requiere `showDirectoryPicker`, contexto seguro y permiso explícito del usuario. Se recomienda Chrome o Edge de escritorio sobre HTTPS o localhost. La app recuerda el identificador de la carpeta, pero el navegador puede solicitar permiso nuevamente al iniciar otra sesión.

Documentación técnica: [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) y [`showDirectoryPicker`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker).
