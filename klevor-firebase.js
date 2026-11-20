// Conexión de la web de KLEVOR con Firebase (inicio de sesión con Google y opiniones).
//
// Privacidad: Firebase solo se carga cuando hace falta.
//  - Las opiniones se leen cuando la sección «Comunidad» aparece en pantalla (no pone cookies).
//  - El inicio de sesión (que guarda la sesión en el navegador) solo se activa si pulsas
//    «Iniciar sesión» o si ya habías iniciado sesión antes en este navegador.
import { firebaseConfig, VERSION_FIREBASE, MODERADORES } from "./firebase-config.js";

const BASE = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/`;
const MARCA_SESION = "klevor_sesion"; // «había sesión»: técnica, solo si inicias sesión
export const MAX_OPINIONES = 3;
export const ESPERA_PUBLICAR_MIN = 10;

let _app, _db, _auth, _fs, _au;

async function app() {
  if (!_app) {
    const { initializeApp } = await import(BASE + "firebase-app.js");
    _app = initializeApp(firebaseConfig);
  }
  return _app;
}

async function fs() {
  if (!_fs) {
    _fs = await import(BASE + "firebase-firestore.js");
    _db = _fs.getFirestore(await app());
  }
  return { f: _fs, db: _db };
}

async function au() {
  if (!_au) {
    _au = await import(BASE + "firebase-auth.js");
    _auth = _au.initializeAuth(await app(), {
      persistence: _au.browserLocalPersistence,
      popupRedirectResolver: _au.browserPopupRedirectResolver,
    });
    _auth.languageCode = "es";
  }
  return { a: _au, auth: _auth };
}

function haySesionGuardada() {
  try { return localStorage.getItem(MARCA_SESION) === "1"; } catch (e) { return false; }
}
function marcarSesion(si) {
  try { si ? localStorage.setItem(MARCA_SESION, "1") : localStorage.removeItem(MARCA_SESION); } catch (e) { /* nada */ }
}

// ------------------------------------------------------------------ sesión
const oyentes = new Set();
let usuarioActual = null;
let escuchando = false;

async function empezarAEscuchar() {
  if (escuchando) return;
  escuchando = true;
  const { a, auth } = await au();
  a.onAuthStateChanged(auth, (u) => {
    usuarioActual = u;
    marcarSesion(!!u);
    oyentes.forEach((cb) => cb(u));
  });
}

/** Llama a cb(usuario|null) ahora y cada vez que cambie la sesión. */
export function alCambiarSesion(cb) {
  oyentes.add(cb);
  if (haySesionGuardada()) empezarAEscuchar().catch(() => cb(null));
  else cb(null);
  return () => oyentes.delete(cb);
}

export function usuario() { return usuarioActual; }
export function esModerador(u) { return !!u && MODERADORES.includes(u.uid); }

export async function entrar() {
  const { a, auth } = await au();
  const proveedor = new a.GoogleAuthProvider();
  proveedor.setCustomParameters({ prompt: "select_account" });
  const r = await a.signInWithPopup(auth, proveedor);
  marcarSesion(true);
  await asegurarPerfil(r.user); // antes de avisar a la página, para que el perfil ya exista
  await empezarAEscuchar();
  return r.user;
}

export async function salir() {
  const { a, auth } = await au();
  await a.signOut(auth);
  marcarSesion(false);
}

async function fotoDelToken(u) {
  const t = await u.getIdTokenResult();
  return t.claims.picture || null;
}

// ------------------------------------------------------------------ perfil privado
function aliasInicial(u) {
  let a = (u.displayName || "").trim().split(/\s+/)[0] || "Usuario";
  if (a.length < 2) a = "Usuario";
  return a.slice(0, 30);
}

export async function asegurarPerfil(u) {
  const { f, db } = await fs();
  const ref = f.doc(db, "usuarios", u.uid);
  const s = await f.getDoc(ref);
  if (s.exists()) return s.data();
  const nuevo = {
    alias: aliasInicial(u), mostrarFoto: false, avisos: false,
    creado: f.serverTimestamp(), ultimaPublicacion: new f.Timestamp(0, 0), ultimoTexto: "",
  };
  await f.setDoc(ref, nuevo);
  return (await f.getDoc(ref)).data();
}

export async function leerPerfil(u) {
  const { f, db } = await fs();
  const s = await f.getDoc(f.doc(db, "usuarios", u.uid));
  return s.exists() ? s.data() : asegurarPerfil(u);
}

/** Cambia alias / mostrar foto / avisos, y actualiza el alias y la foto de sus opiniones. */
export async function guardarPreferencias(u, cambios) {
  const { f, db } = await fs();
  const perfil = await leerPerfil(u);
  const nuevo = { ...perfil, ...cambios };
  const foto = nuevo.mostrarFoto ? await fotoDelToken(u) : null;
  const lote = f.writeBatch(db);
  lote.update(f.doc(db, "usuarios", u.uid), {
    alias: nuevo.alias, mostrarFoto: nuevo.mostrarFoto, avisos: nuevo.avisos,
  });
  for (const o of await misOpiniones(u)) {
    if (o.alias !== nuevo.alias || o.foto !== foto) {
      lote.update(f.doc(db, "opiniones", o.id), { alias: nuevo.alias, foto });
    }
  }
  await lote.commit();
  return nuevo;
}

// ------------------------------------------------------------------ opiniones
function aObjeto(s) {
  const d = s.data();
  return {
    id: s.id, ...d,
    creada: d.creada ? d.creada.toDate() : new Date(),
    editada: d.editada ? d.editada.toDate() : null,
    respondida: d.respondida ? d.respondida.toDate() : null,
  };
}

/** Lee las opiniones públicas con una petición directa a Firestore, sin cargar Firebase:
 *  así quien solo mira no guarda nada en su navegador. */
export async function listarOpiniones(cuantas = 60) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery` +
    `?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "opiniones" }],
      orderBy: [{ field: { fieldPath: "creada" }, direction: "DESCENDING" }],
      limit: cuantas,
    } }),
  });
  if (!r.ok) { const e = new Error("No se han podido cargar las opiniones."); e.code = r.status === 429 ? "resource-exhausted" : "unavailable"; throw e; }
  const valor = (v) => {
    if (!v || "nullValue" in v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return new Date(v.timestampValue);
    return null;
  };
  return (await r.json()).filter((x) => x.document).map(({ document: d }) => {
    const c = Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, valor(v)]));
    return { ...c, id: d.name.split("/").pop(), creada: c.creada || new Date(), editada: c.editada || null };
  });
}

export async function misOpiniones(u) {
  const { f, db } = await fs();
  const res = [];
  for (let i = 1; i <= MAX_OPINIONES; i++) {
    const s = await f.getDoc(f.doc(db, "opiniones", `${u.uid}_${i}`));
    if (s.exists()) res.push(aObjeto(s));
  }
  return res.sort((a, b) => b.creada - a.creada);
}

/** Lo mismo que comprueba el servidor, para avisar antes con un mensaje claro. */
export function validar({ estrellas, comentario, sugerencia }) {
  const enlace = /(https?:\/\/|www\.|\.com\/|\.es\/)/i;
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return "Elige de 1 a 5 estrellas.";
  if (comentario.length < 10) return "Cuéntanos un poco más: el comentario necesita al menos 10 letras.";
  if (comentario.length > 1000) return "El comentario puede tener como mucho 1000 letras.";
  if (sugerencia.length > 500) return "La sugerencia puede tener como mucho 500 letras.";
  if (enlace.test(comentario) || enlace.test(sugerencia)) return "Por seguridad, las opiniones no pueden llevar enlaces.";
  return null;
}

export async function publicar(u, datos) {
  const error = validar(datos);
  if (error) throw new Error(error);
  const { f, db } = await fs();
  const perfil = await leerPerfil(u);
  const espera = perfil.ultimaPublicacion.toMillis() + ESPERA_PUBLICAR_MIN * 60000 - Date.now();
  if (espera > 0) {
    throw new Error(`Para evitar abusos, espera ${Math.ceil(espera / 60000)} min antes de publicar otra opinión.`);
  }
  if (perfil.ultimoTexto === datos.comentario) throw new Error("Esa opinión ya la habías publicado.");
  const mias = await misOpiniones(u);
  if (mias.length >= MAX_OPINIONES) {
    throw new Error(`Puedes tener como mucho ${MAX_OPINIONES} opiniones. Edita o borra alguna en «Mi cuenta».`);
  }
  const usados = new Set(mias.map((o) => o.id));
  let hueco = 1;
  while (usados.has(`${u.uid}_${hueco}`)) hueco++;
  const foto = perfil.mostrarFoto ? await fotoDelToken(u) : null;
  const lote = f.writeBatch(db);
  lote.set(f.doc(db, "opiniones", `${u.uid}_${hueco}`), {
    uid: u.uid, alias: perfil.alias, foto,
    estrellas: datos.estrellas, comentario: datos.comentario, sugerencia: datos.sugerencia,
    creada: f.serverTimestamp(), editada: null, respuesta: null, respondida: null, moderada: false,
  });
  lote.update(f.doc(db, "usuarios", u.uid), { ultimaPublicacion: f.serverTimestamp(), ultimoTexto: datos.comentario });
  await lote.commit();
}

export async function editar(u, id, datos) {
  const error = validar(datos);
  if (error) throw new Error(error);
  const { f, db } = await fs();
  const perfil = await leerPerfil(u);
  const foto = perfil.mostrarFoto ? await fotoDelToken(u) : null;
  await f.updateDoc(f.doc(db, "opiniones", id), {
    estrellas: datos.estrellas, comentario: datos.comentario, sugerencia: datos.sugerencia,
    alias: perfil.alias, foto, editada: f.serverTimestamp(), moderada: false,
  });
}

// ------------------------------------------------------------------ moderación
/** Respuesta pública de KLEVOR a una opinión (texto vacío o null = quitarla). Solo moderadores. */
export async function responder(id, texto) {
  const { f, db } = await fs();
  const limpio = (texto || "").trim();
  if (limpio.length > 1000) throw new Error("La respuesta puede tener como mucho 1000 letras.");
  await f.updateDoc(f.doc(db, "opiniones", id), limpio
    ? { respuesta: limpio, respondida: f.serverTimestamp() }
    : { respuesta: null, respondida: null });
}

/** Corrige el texto de una opinión ajena. Queda marcada como «Editada por moderación». */
export async function moderarTexto(id, { comentario, sugerencia }) {
  if (!comentario.trim()) throw new Error("El comentario no puede quedar vacío. Si no vale, bórralo.");
  if (comentario.length > 1000 || sugerencia.length > 500) throw new Error("El texto es demasiado largo.");
  const { f, db } = await fs();
  await f.updateDoc(f.doc(db, "opiniones", id), { comentario: comentario.trim(), sugerencia: sugerencia.trim(), moderada: true });
}

export async function borrar(id) {
  const { f, db } = await fs();
  await f.deleteDoc(f.doc(db, "opiniones", id));
}

/** Borra sus opiniones, su perfil y su cuenta de Firebase. */
export async function eliminarCuenta(u) {
  const { a } = await au();
  const { f, db } = await fs();
  // Google pide haber iniciado sesión hace poco para borrar una cuenta: se confirma antes.
  const proveedor = new a.GoogleAuthProvider();
  proveedor.setCustomParameters({ login_hint: u.email || "" });
  await a.reauthenticateWithPopup(u, proveedor);
  const lote = f.writeBatch(db);
  for (const o of await misOpiniones(u)) lote.delete(f.doc(db, "opiniones", o.id));
  lote.delete(f.doc(db, "usuarios", u.uid));
  await lote.commit();
  await a.deleteUser(u);
  marcarSesion(false);
}

export function mensajeError(e) {
  const c = (e && e.code) || "";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
  if (c === "auth/popup-blocked") return "Tu navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta web y vuelve a intentarlo.";
  if (c === "auth/network-request-failed" || c === "unavailable") return "No hay conexión. Comprueba tu internet y vuelve a intentarlo.";
  if (c === "auth/user-mismatch") return "Elige la misma cuenta de Google con la que iniciaste sesión.";
  if (c === "permission-denied") return "No se ha podido guardar. Si acabas de publicar o editar, espera unos minutos y vuelve a intentarlo.";
  if (c === "resource-exhausted") return "Hoy hay muchísimo tráfico. Inténtalo de nuevo más tarde.";
  return (e && e.message) || "Algo ha fallado. Vuelve a intentarlo.";
}
