# Activar la cuenta real del Dueño

La pantalla de correo y recuperación usa Firebase Authentication. La protección del servidor se completa al publicar `firestore.rules`; ocultar botones por sí solo no protege una base de datos.

1. En Firebase Console, abre **Authentication > Sign-in method** y habilita **Correo/Contraseña**.
2. En la aplicación entra como Dueño, abre **Opciones > Cuenta real del Dueño** y activa el correo.
3. Comprueba que la aplicación muestre **Cuenta real activada**.
4. Desde una terminal vinculada al proyecto `sublicosturas-app`, publica las reglas:

   ```bash
   firebase deploy --only firestore:rules
   ```

5. Prueba en una ventana privada: primero debe pedir correo y contraseña, y después el PIN del Dueño o empleado.

Antes de activar una cuenta, las reglas conservan el comportamiento anterior para permitir la migración. Después de activarla, todas las colecciones quedan limitadas al UID del Dueño. Los empleados pueden usar sus PIN mientras el dispositivo mantiene iniciada la cuenta Firebase del Dueño; sus permisos de pantalla siguen controlados por la aplicación.

La primera activación del UID tampoco se acepta de forma anónima: la escritura debe venir de la misma cuenta Firebase que se está vinculando.

La restauración de una copia nunca reemplaza el UID actualmente vinculado, para evitar que el Dueño se bloquee a sí mismo.
