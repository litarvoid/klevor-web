// Configuración web de Firebase del proyecto de KLEVOR («klevor-web»).
// NO es secreta: Google la diseña para ir en el código público de la web. La seguridad
// la dan las reglas de Firestore (web/firestore.rules), que se ejecutan en los servidores de Google.
// Nunca pongas aquí claves privadas ni cuentas de servicio.
export const firebaseConfig = {
  apiKey: "AIzaSyCLai1z6jtRX4TccMwcGTOBzelR9OGbWpo",
  authDomain: "klevor-web.firebaseapp.com",
  projectId: "klevor-web",
  storageBucket: "klevor-web.firebasestorage.app",
  messagingSenderId: "126183586903",
  appId: "1:126183586903:web:b40c055f8ea0128237f712",
};

// Versión de Firebase que se carga (desde el servidor oficial de Google, gstatic.com)
export const VERSION_FIREBASE = "12.0.0";

// Moderadores: pueden borrar cualquier opinión (deben coincidir con los de firestore.rules).
export const MODERADORES = ["V5LUile9OjeURzLHtXUlpVna6rd2"]; // cuenta ai.klevor@gmail.com
