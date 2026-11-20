// Página «Mi cuenta»: datos de Google, preferencias, mis opiniones y eliminar la cuenta.
import * as K from "./klevor-firebase.js";
import { el, avatar, fecha, tarjetaOpinion, ventanaOpinion, confirmar, aviso, pintarCuentaNav, ICONO_GOOGLE } from "./comunidad-ui.js";

const main = document.getElementById("contenido");
const navCaja = document.getElementById("cuenta-nav");
let usuario = null;
let cuentaEliminada = false;

K.alCambiarSesion((u) => {
  usuario = u;
  pintarCuentaNav(navCaja, u, { alSalir: () => location.assign("./") });
  if (cuentaEliminada) return; // se queda el mensaje de «Cuenta eliminada»
  if (u) pintarCuenta(u);
  else pintarPuerta();
});

function pintarPuerta() {
  main.replaceChildren(el("div", { clase: "puerta" },
    el("h1", { texto: "Mi cuenta" }),
    el("p", { texto: "Inicia sesión con tu cuenta de Google para publicar opiniones y gestionar tus datos. " +
      "No hace falta contraseña nueva." }),
    el("button", { type: "button", clase: "k-btn k-btn-claro", html: ICONO_GOOGLE + " Continuar con Google",
      onclick: async () => {
        try { await K.entrar(); } catch (e) { const m = K.mensajeError(e); if (m) aviso(m, 5000); }
      } }),
    el("p", { clase: "k-aviso-legal", html: 'Al iniciar sesión aceptas la <a href="privacidad.html">política de privacidad</a>.' })));
}

function interruptor(id, marcado, alCambiar) {
  const i = el("input", { type: "checkbox", id, checked: marcado, onchange: (e) => alCambiar(e.target) });
  return el("label", { clase: "interruptor" }, i, el("span", {}));
}

async function pintarCuenta(u) {
  main.replaceChildren(el("p", { clase: "cargando", texto: "Cargando tu cuenta…" }));
  let perfil, mias;
  try {
    perfil = await K.leerPerfil(u);
    mias = await K.misOpiniones(u);
  } catch (e) {
    main.replaceChildren(el("p", { clase: "cargando", texto: K.mensajeError(e) }));
    return;
  }
  const registro = u.metadata && u.metadata.creationTime ? new Date(u.metadata.creationTime) : null;

  // ---------- datos
  const cabecera = el("section", { clase: "perfil", "aria-label": "Tus datos de Google" },
    avatar(u.photoURL, u.displayName, 84),
    el("div", {},
      el("h2", { texto: u.displayName || "Tu cuenta" }),
      el("p", { texto: u.email || "" }),
      registro ? el("p", { texto: `Miembro desde el ${fecha(registro)}` }) : null));

  // ---------- preferencias
  const campoAlias = el("input", { type: "text", id: "alias", maxlength: 30, value: perfil.alias, autocomplete: "nickname" });
  const guardarAlias = el("button", { type: "button", clase: "k-btn k-btn-principal k-btn-mini", texto: "Guardar",
    onclick: async () => {
      const alias = campoAlias.value.trim();
      if (alias.length < 2) return aviso("El alias necesita al menos 2 letras.");
      await cambiar({ alias }, "Alias guardado.");
    } });
  async function cambiar(cambios, mensaje, deshacer) {
    try {
      perfil = await K.guardarPreferencias(u, cambios);
      aviso(mensaje);
      pintarMias(await K.misOpiniones(u));
    } catch (e) {
      aviso(K.mensajeError(e), 5000);
      if (deshacer) deshacer();
    }
  }
  const preferencias = el("section", { clase: "bloque", "aria-labelledby": "t-pref" },
    el("h3", { id: "t-pref", texto: "Preferencias y privacidad" }),
    el("p", { clase: "sub2", texto: "Decide cómo apareces en la comunidad. Tu correo nunca se muestra a nadie." }),
    el("div", { clase: "fila" },
      el("div", { clase: "k-campo" }, el("label", { for: "alias", texto: "Alias público" }),
        el("div", { clase: "alias" }, campoAlias, guardarAlias),
        el("small", { texto: "Es el nombre que verán los demás junto a tus opiniones." }))),
    el("div", { clase: "fila" },
      el("div", {}, el("b", { texto: "Mostrar mi foto de Google en mis opiniones" }),
        el("small", { texto: "Si está apagado, se muestra la inicial de tu alias." })),
      interruptor("foto", perfil.mostrarFoto, (i) =>
        cambiar({ mostrarFoto: i.checked }, i.checked ? "Tu foto se mostrará en tus opiniones." : "Tu foto ya no se muestra.",
          () => { i.checked = !i.checked; }))),
    el("div", { clase: "fila" },
      el("div", {}, el("b", { texto: "Avisos por correo sobre novedades de KLEVOR" }),
        el("small", { texto: "Por ahora no enviamos ningún correo. Si algún día lo hacemos, solo a quien lo tenga activado." })),
      interruptor("avisos", perfil.avisos, (i) =>
        cambiar({ avisos: i.checked }, "Preferencia guardada.", () => { i.checked = !i.checked; }))));

  // ---------- mis opiniones
  const listaMias = el("div", { clase: "mis" });
  const bloqueMias = el("section", { clase: "bloque", id: "mis-opiniones", "aria-labelledby": "t-mias" },
    el("h3", { id: "t-mias", texto: "Mis opiniones" }),
    el("p", { clase: "sub2", texto: `Puedes tener hasta ${K.MAX_OPINIONES} opiniones publicadas. Edítalas o bórralas cuando quieras.` }),
    listaMias);
  function pintarMias(lista) {
    mias = lista;
    if (!lista.length) {
      listaMias.replaceChildren(el("div", { clase: "k-vacio" }, el("b", { texto: "Todavía no has publicado ninguna opinión" }),
        el("a", { href: "./#comunidad", clase: "k-btn k-btn-principal", style: "margin-top:12px", texto: "Escribir mi primera opinión" })));
      return;
    }
    listaMias.replaceChildren(...lista.map((o) => tarjetaOpinion(o, { mia: true, acciones: [
      el("button", { type: "button", clase: "k-btn k-btn-borde k-btn-mini", texto: "Editar",
        onclick: async () => { if (await ventanaOpinion(u, perfil, o)) { aviso("Opinión actualizada."); pintarMias(await K.misOpiniones(u)); } } }),
      el("button", { type: "button", clase: "k-btn k-btn-peligro k-btn-mini", texto: "Borrar",
        onclick: async () => {
          if (!await confirmar({ titulo: "¿Borrar esta opinión?", texto: "Se borrará para siempre y no se puede deshacer.",
            boton: "Borrar", peligro: true })) return;
          try { await K.borrar(o.id); aviso("Opinión borrada."); pintarMias(await K.misOpiniones(u)); }
          catch (e) { aviso(K.mensajeError(e), 5000); }
        } }),
    ] })));
  }
  pintarMias(mias);

  // ---------- sesión y eliminar
  const sesion = el("section", { clase: "bloque", "aria-labelledby": "t-sesion" },
    el("h3", { id: "t-sesion", texto: "Sesión" }),
    el("div", { clase: "fila" },
      el("div", {}, el("b", { texto: "Cerrar sesión en este navegador" }),
        el("small", { texto: "Tus opiniones siguen publicadas." })),
      el("button", { type: "button", clase: "k-btn k-btn-borde", texto: "Cerrar sesión",
        onclick: async () => { await K.salir(); location.assign("./"); } })));
  const eliminar = el("section", { clase: "bloque peligro", "aria-labelledby": "t-eliminar" },
    el("h3", { id: "t-eliminar", texto: "Eliminar mi cuenta" }),
    el("div", { clase: "fila" },
      el("div", {}, el("b", { texto: "Borrar mi cuenta y todos mis datos" }),
        el("small", { texto: "Se borran tus opiniones, tus preferencias y tu cuenta de la web. No se puede deshacer. " +
          "Tu cuenta de Google no se toca." })),
      el("button", { type: "button", clase: "k-btn k-btn-peligro", texto: "Eliminar cuenta",
        onclick: async () => {
          const ok = await confirmar({ titulo: "¿Eliminar tu cuenta?",
            texto: `Se borrarán para siempre tus ${mias.length} opiniones, tus preferencias y tu cuenta de la web de KLEVOR. ` +
              "Google te pedirá confirmar que eres tú.", boton: "Eliminar para siempre", peligro: true, escribir: "ELIMINAR" });
          if (!ok) return;
          try {
            cuentaEliminada = true;
            await K.eliminarCuenta(u);
            main.replaceChildren(el("div", { clase: "puerta" }, el("h1", { texto: "Cuenta eliminada" }),
              el("p", { texto: "Hemos borrado tu cuenta y todos tus datos. Gracias por haber formado parte de la comunidad." }),
              el("a", { href: "./", clase: "k-btn k-btn-principal", texto: "Volver a la web" })));
          } catch (e) {
            cuentaEliminada = false;
            const m = K.mensajeError(e);
            if (m) aviso(m, 6000);
          }
        } })));

  const moderacion = K.esModerador(u) ? el("section", { clase: "bloque", "aria-labelledby": "t-mod" },
    el("h3", { id: "t-mod", texto: "🛡️ Eres moderador" }),
    el("p", { clase: "sub2", texto: "En la sección Comunidad, cada opinión te muestra «Responder» (aparece como «Respuesta de KLEVOR»), " +
      "«Editar (moderar)» para quitar insultos, enlaces o datos personales (se marca como «Editada por moderación») y «Borrar (moderar)»." }),
    el("a", { href: "./#comunidad", clase: "k-btn k-btn-principal", texto: "Ir a moderar opiniones" })) : null;

  main.replaceChildren(el("h1", { texto: "Mi cuenta" }), cabecera, moderacion, preferencias, bloqueMias, sesion, eliminar);
  if (location.hash === "#mis-opiniones") bloqueMias.scrollIntoView({ behavior: "smooth", block: "start" });
}
