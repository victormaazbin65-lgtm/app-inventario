# Mejoras seguras v1.3.1

Fecha: 2026-09-17  
Base pública conservada: `1.2.5`  
Build interno: `1.3.1`

## Regla principal

Esta etapa no modifica fórmulas de ventas, costos, ganancias, inventario, préstamos, devoluciones ni la regla SAT.

La regla SAT queda protegida por prueba automática:

- si el cliente **no solicita factura**, el impuesto SAT de la operación es **0**;
- si el cliente **solicita factura**, se aplica el porcentaje configurado del negocio.

## Respaldo de código

Antes de iniciar esta etapa se creó la rama:

`backup-estable-1.3.0-2026-09-17`

Esa rama apunta exactamente al commit estable previo:

`d5703453edbb830f9930e9b91f2a5f403f1b76b7`

Si una mejora futura provoca una regresión, esa rama permite recuperar el código anterior sin depender del historial local de una computadora.

## Cambios incluidos

- Chart.js queda fijado en la versión 4.5.1 para evitar que una actualización externa cambie el comportamiento sin aviso.
- La PWA deja de precargar `logo.jpeg`, archivo grande que no utiliza la interfaz actual.
- La pantalla de auditoría solicita como máximo las 50 entradas más recientes desde Firestore cuando las funciones de consulta están disponibles.
- Los refrescos periódicos de la capa profesional se suspenden cuando la aplicación está en segundo plano y se reanudan al volver.
- La agenda de cobros evita reconstruir el DOM si su contenido no cambió.
- Se agregan pruebas específicas para congelar la regla SAT y las invariantes de esta etapa.

## No modificado

- `negocio-core.js`
- fórmulas financieras;
- cálculo de SAT;
- distribución de fondos;
- ventas y devoluciones;
- préstamos y abonos;
- reglas de inventario;
- versión pública `1.2.5`.

## Procedimiento seguro de publicación

1. ejecutar toda la suite de pruebas;
2. revisar que GitHub Actions termine en verde;
3. comparar esta rama contra `main`;
4. integrar únicamente si las pruebas siguen aprobadas;
5. conservar la rama de respaldo incluso después de integrar.
