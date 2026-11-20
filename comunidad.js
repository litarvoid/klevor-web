// Sección «Comunidad KLEVOR» de la página principal.
import * as K from "./klevor-firebase.js";
import { el, estrellas, tarjetaOpinion, ventanaOpinion, ventanaResponder, ventanaModerar, confirmar, aviso, pintarCuentaNav } from "./comunidad-ui.js";

const CLAVE_ORDEN = "klevor_orden_opiniones"; // cookie de preferencias: solo con permiso
const ORDENES = { recientes: "Más recientes", mejores: "Mejor valoradas", peores: "Peor valoradas" };
const POR_PAGINA = 9;

const seccion = document.getElementById("comunidad");
const navCaja = document.getElementById("cuenta-nav");
let opiniones = null;   // null = sin cargar
let usuario = null;
let mostradas = POR_PAGINA;
let orden = leerOrden();

function leerOrden() {
  try {
    if (window.KlevorCookies && KlevorCookies.permitido("preferencias")) {
      const o = localStorage.getItem(CLAVE_ORDEN);
      if (o in ORDENES) return o;
    }
  } catch (e) { /* nada */ }
  return "recientes";
}
function guardarOrden(o) {
  try {
    if (window.KlevorCookies && KlevorCookies.permitido("preferencias")) localStorage.setItem(CLAVE_ORDEN, o);
    else localStorage.removeItem(CLAVE_ORDEN);
  } catch (e) { /* nada */ }
}
document.addEventListener("klevor-cookies", () => { if (!KlevorCookies.permitido("preferencias")) guardarOrden(orden); });

// ------------------------------------------------------------------ pintar
const zonaResumen = seccion.querySelector("[data-resumen]");
const zonaLista = seccion.querySelector("[data-lista]");
const zonaMas = seccion.querySelector("[data-mas]");
const zonaOrden = seccion.querySelector("[data-orden]");
const botonEscribir = seccion.querySelector("[data-escribir]");

function ordenadas() {
  const l = [...opiniones];
  if (orden === "mejores") l.sort((a, b) => b.estrellas - a.estrellas || b.creada - a.creada);
  else if (orden === "peores") l.sort((a, b) => a.estrellas - b.estrellas || b.creada - a.creada);
  else l.sort((a, b) => b.creada - a.creada);
  return l;
}

function pintarOrden() {
  zonaOrden.replaceChildren(...Object.entries(ORDENES).map(([clave, nombre]) =>
    el("button", { type: "button", "aria-pressed": String(clave === orden), texto: nombre,
      onclick: () => { orden = clave; guardarOrden(clave); mostradas = POR_PAGINA; pintar(); } })));
}

function pintarResumen() {
  if (!opiniones.length) { zonaResumen.replaceChildren(); zonaResumen.hidden = true; return; }
  zonaResumen.hidden = false;
  const media = opiniones.reduce((s, o) => s + o.estrellas, 0) / opiniones.length;
  const barras = [5, 4, 3, 2, 1].map((n) => {
    const c = opiniones.filter((o) => o.estrellas === n).length;
    return el("div", { clase: "k-barra" }, el("span", { texto: `${n} ★` }),
      el("i", {}, el("span", { style: `width:${(c / opiniones.length) * 100}%` })), el("span", { texto: String(c) }));
  });
  zonaResumen.replaceChildren(
    el("div", { clase: "k-media" }, el("b", { texto: media.toFixed(1).replace(".", ",") }), estrellas(Math.round(media)),
      el("small", { texto: `${opiniones.length} ${opiniones.length === 1 ? "opinión" : "opiniones"}` })),
    el("div", { clase: "k-barras" }, barras));
}

function accionesDe(o) {
  const mia = usuario && o.uid === usuario.uid;
  const acc = [];
  if (mia) {
    acc.push(el("button", { type: "button", clase: "k-btn k-btn-borde k-btn-mini", texto: "Editar",
      onclick: async () => {
        const perfil = await K.leerPerfil(usuario);
        if (await ventanaOpinion(usuario, perfil, o)) { aviso("Opinión actualizada."); recargar(); }
      } }));
  }
  const moderador = K.esModerador(usuario);
  if (moderador) {
    acc.push(el("button", { type: "button", clase: "k-btn k-btn-borde k-btn-mini", texto: o.respuesta ? "Cambiar respuesta" : "Responder",
      onclick: async () => { if (await ventanaResponder(o)) { aviso("Respuesta guardada."); recargar(); } } }));
    if (!mia) {
      acc.push(el("button", { type: "button", clase: "k-btn k-btn-borde k-btn-mini", texto: "Editar (moderar)",
        onclick: async () => { if (await ventanaModerar(o)) { aviso("Corrección guardada."); recargar(); } } }));
    }
  }
  if (mia || moderador) {
    acc.push(el("button", { type: "button", clase: "k-btn k-btn-peligro k-btn-mini", texto: mia ? "Borrar" : "Borrar (moderar)",
      onclick: async () => {
        const ok = await confirmar({ titulo: "¿Borrar esta opinión?", texto: "Se borrará para siempre y no se puede deshacer.",
          boton: "Borrar", peligro: true });
        if (!ok) return;
        try { await K.borrar(o.id); aviso("Opinión borrada."); recargar(); }
        catch (e) { aviso(K.mensajeError(e), 5000); }
      } }));
  }
  return { mia, acciones: acc };
}

function pintar() {
  pintarOrden();
  if (opiniones === null) return;
  pintarResumen();
  if (!opiniones.length) {
    zonaLista.className = "";
    zonaLista.replaceChildren(el("div", { clase: "k-vacio" }, el("b", { texto: "Aún no hay opiniones" }),
      el("span", { texto: "¿Ya has probado KLEVOR? Sé la primera persona en contar qué tal te va." })));
    zonaMas.replaceChildren();
    return;
  }
  zonaLista.className = "k-lista";
  const lista = ordenadas();
  zonaLista.replaceChildren(...lista.slice(0, mostradas).map((o, i) => {
    const t = tarjetaOpinion(o, accionesDe(o));
    t.style.animationDelay = `${Math.min(i, 8) * 45}ms`;
    return t;
  }));
  zonaMas.replaceChildren(lista.length > mostradas
    ? el("button", { type: "button", clase: "k-btn k-btn-borde", texto: "Ver más opiniones",
      onclick: () => { mostradas += POR_PAGINA; pintar(); } })
    : "");
}

async function recargar() {
  try {
    opiniones = await K.listarOpiniones(100);
  } catch (e) {
    zonaLista.className = "";
    zonaLista.replaceChildren(el("div", { clase: "k-vacio" }, el("b", { texto: "No se han podido cargar las opiniones" }),
      el("span", { texto: K.mensajeError(e) })));
    return;
  }
  pintar();
}

// ------------------------------------------------------------------ escribir
botonEscribir.addEventListener("click", async () => {
  try {
    if (!usuario) usuario = await K.entrar();
    const perfil = await K.leerPerfil(usuario);
    if (await ventanaOpinion(usuario, perfil)) {
      aviso("¡Gracias! Tu opinión ya está publicada.");
      orden = "recientes";
      await recargar();
    }
  } catch (e) {
    const m = K.mensajeError(e);
    if (m) aviso(m, 5000);
  }
});

// ------------------------------------------------------------------ arranque
pintarOrden();
K.alCambiarSesion((u) => {
  usuario = u;
  pintarCuentaNav(navCaja, u);
  if (opiniones) pintar();
});

// Las opiniones se piden a Google solo cuando la sección está a punto de verse.
const vigia = new IntersectionObserver((entradas) => {
  if (entradas.some((e) => e.isIntersecting)) { vigia.disconnect(); recargar(); }
}, { rootMargin: "400px" });
vigia.observe(seccion);
if (location.hash === "#comunidad") recargar();
