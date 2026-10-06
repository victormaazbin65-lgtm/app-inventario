# Recuperación segura de Sublicosturas

La versión 1.4.0 protege los datos actuales: descargar un respaldo sigue incluyendo todas las colecciones, pero restaurar no combina saldos antiguos con operaciones actuales.

## Recuperación automática disponible

1. Termina las operaciones y cierra las demás pestañas y dispositivos del negocio, especialmente los que todavía usen versiones anteriores.
2. Guarda una copia JSON completa. Excel sirve para consulta; no sirve para restaurar.
3. Selecciona la copia JSON desde Opciones. El sistema valida estructura, valores y SHA-256, obtiene el estado completo del servidor y prepara una vista previa.
4. Si hay documentos ajenos a la copia, cambios posteriores o colecciones financieras ausentes, la recuperación se cancela sin escribir. El hash detecta cambios en el archivo; no certifica quién lo creó ni que sus cifras sean correctas.
5. Una copia de hasta 398 documentos de colecciones, más configuración e imagen, cabe en el límite conservador de 400 escrituras de recuperación. Se descarga primero el estado actual y se comprueba otra vez la base.
6. La restauración compara la configuración y cada documento de destino dentro de una transacción, registra su resultado junto con los cambios y verifica todos los documentos de las colecciones. Si falla la comprobación posterior, informa que la restauración ya se aplicó; no se debe repetir a ciegas.

Las copias antiguas pueden validarse, pero una copia parcial no se aplica automáticamente. `operaciones_sistema` es una colección nueva: una copia anterior a 1.4.0 normalmente no la incluye. No se inventan registros ausentes ni se eliminan operaciones actuales para forzar su compatibilidad.

## Copias grandes o recuperación de una fecha anterior

El navegador **no aplica una recuperación de más de 400 escrituras ni un retroceso sobre una base con movimientos posteriores**. Esta restricción evita recuperaciones parciales. No dividir manualmente una copia y subir sus partes.

El procedimiento administrativo es preparar una base de recuperación separada mediante las herramientas de exportación/importación de Firestore, conservar una exportación de la base actual, importar la copia completa con su configuración y colecciones en el destino separado y verificar allí inventario, créditos, anticipos, fondos y movimientos. Sólo después de comparar conteos y cifras se planifica el cambio del destino del negocio, con una ventana de mantenimiento y un retorno preparado al destino anterior. Este procedimiento requiere acceso administrativo de Firebase y puede tener costos de infraestructura; no está ejecutado ni automatizado por esta entrega.

Para una copia JSON de esta app, las herramientas de exportación nativa de Firestore no importan directamente el JSON: es necesario un importador administrativo validado o una conversión explícita. No se ofrece un importador improvisado sobre la base en funcionamiento. Si necesitas este escenario, hay que implementar y probar esa migración con una copia separada antes de utilizarla.

## Volver al código anterior

El punto de partida del código es `1b67cae2dab5099f60c787d086c98f43dc97c225`. Un revert de la entrega devuelve el código, pero **no** revierte datos ni movimientos registrados. Conservar las carpetas de recursos de versiones anteriores permite que las pestañas abiertas terminen con sus propios módulos. La actualización solicita una acción explícita y se bloquea cuando hay carritos o ediciones pendientes.
