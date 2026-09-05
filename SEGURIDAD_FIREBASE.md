# Cerrar Firestore sin bloquear al Dueño

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
