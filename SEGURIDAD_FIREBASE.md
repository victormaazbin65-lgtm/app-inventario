# Cerrar Firestore sin bloquear al Dueño

## Alcance de la candidata 1.4.2

Esta entrega no despliega reglas, cambia el UID propietario ni modifica Firebase de producción. Mantiene el acceso completo del Dueño y añade comprobaciones de pantalla y de transacción para las operaciones administrativas. Las reglas existentes siguen comprobando la cuenta Firebase compartida: **no distinguen al empleado que introdujo un PIN**. Los permisos de esta versión no son aislamiento de servidor entre empleados.

La información que ya se descargó en un dispositivo tampoco se retira simplemente ocultando su sección. Los PIN y sus hashes dentro de la configuración compartida no deben considerarse secretos frente a quien controla ese dispositivo. No se recomienda ampliar dispositivos de empleados bajo la suposición de que esta limitación ya está resuelta.

## Migración pendiente para separar empleados en el servidor (AUD-09)

Debe prepararse en un proyecto de prueba independiente, con datos ficticios, antes de autorizar otro despliegue:

1. Elegir cuentas Firebase individuales o un servicio de autenticación que verifique el PIN y entregue un token individual. Si se conserva el PIN, su verificación y los límites de intentos deben hacerse en el servidor. No entregar la contraseña ni reutilizar el token del Dueño como identidad del empleado.
2. Separar las credenciales privadas y las asignaciones de roles de la configuración operativa que necesita leer la aplicación. Evitar que el cliente pueda asignarse su rol o leer hashes ajenos. Los roles y permisos se comprobarán en reglas o en un servicio de comandos autorizado.
3. Proteger también las lecturas de costos, utilidades e historiales financieros. Cuando un empleado necesite vender, el servidor debe validar precios, existencias, identidad y permisos y aplicar la operación completa de forma atómica; esconder campos en el cliente no sustituye esta validación.
4. Mantener la firma de solicitud, los identificadores de operación y la revisión global para que reintentos y concurrencia sigan siendo seguros. Relacionar explícitamente el ID histórico de cada usuario con su nueva identidad, sin reescribir ventas ni perder sus autores originales.
5. Probar en el emulador el Dueño con acceso completo; empleado autorizado; empleado revocado; cambio de PIN durante una operación; token vencido; acceso directo a documentos y costos; cambio de rol malicioso; escrituras parciales; y reintentos de una misma solicitud. Verificar también bloqueo de lecturas con identidad distinta y que nadie pueda borrar la bitácora.
6. Ensayar la migración completa y el retorno con una copia aislada. Preparar respaldo y ventana de mantenimiento, actualizar primero los dispositivos de prueba y obtener autorización expresa antes de cambiar producción. No activar servicios de pago ni publicar reglas por este documento.

El siguiente procedimiento describe únicamente la vinculación de la cuenta propietaria existente. No implementa esa migración individual.

## Vinculación de la cuenta propietaria

La pantalla de correo y recuperación usa Firebase Authentication. La protección del servidor se completa al publicar `firestore.rules`; ocultar botones por sí solo no protege una base de datos.

> **Orden obligatorio:** vincula y prueba primero la cuenta real con la versión actualmente publicada. Solo después despliega las reglas cerradas de esta rama. Si se despliegan antes de guardar el UID propietario, Firestore quedará cerrado para todos.

1. En Firebase Console, abre **Authentication > Sign-in method** y habilita **Correo/Contraseña**.
2. En la aplicación actualmente publicada entra como Dueño, abre **Opciones > Cuenta real del Dueño** y activa el correo.
3. Comprueba que la aplicación muestre **Cuenta real activada** y prueba ese correo en una ventana privada o segundo dispositivo.
4. Descarga un respaldo completo y confirma que puede abrirse como JSON antes de continuar.
5. Desde una terminal vinculada al proyecto `sublicosturas-app`, publica las reglas:

   ```bash
   firebase deploy --only firestore:rules
   ```

6. Prueba nuevamente en una ventana privada: primero debe pedir correo y contraseña, y después el PIN del Dueño o empleado.
7. Verifica inventario, una consulta de cliente y el panel financiero antes de cerrar la sesión que ya funcionaba.

En un celular o computadora nuevos, las reglas no exponen `sistema/config` antes de autenticar. La aplicación reconoce el rechazo de Firestore, muestra el formulario de correo sin depender de esa lectura y vuelve a abrir la sincronización únicamente después de comprobar el UID propietario. Una cuenta distinta permanece sin acceso al PIN y a los datos.

Estas reglas están cerradas por defecto. No conservan acceso público de transición y tampoco permiten que el primer usuario autenticado se adjudique el negocio. Todas las colecciones quedan limitadas al UID ya guardado del Dueño.

Los empleados pueden seguir usando sus PIN mientras el dispositivo mantiene iniciada la cuenta Firebase del Dueño. Esos permisos son controles operativos de pantalla, no identidades independientes de servidor. No se debe entregar a un empleado la contraseña del correo del Dueño; el Dueño inicia la sesión Firebase en el dispositivo y el empleado utiliza únicamente su PIN.

La restauración de una copia nunca reemplaza el UID actualmente vinculado, para evitar que el Dueño se bloquee a sí mismo.

## Recuperación si se desplegaron las reglas antes de tiempo

No borres datos ni crees otro proyecto. Desde Firebase Console o una terminal autenticada con la cuenta propietaria, vuelve temporalmente a las reglas de la versión anterior, vincula el UID correcto desde la aplicación y despliega de nuevo estas reglas cerradas. Conserva abierta cualquier sesión que todavía tenga acceso hasta terminar la verificación.
