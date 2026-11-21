// Piezas de interfaz compartidas por la página principal y «Mi cuenta».
// Todo el texto de los usuarios se pone con textContent (nunca como HTML) para evitar trucos.
import * as K from "./klevor-firebase.js";

export const ICONO_GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

const NOMBRES_ESTRELLAS = ["", "Muy mala", "Mejorable", "Está bien", "Muy buena", "¡Excelente!"];

export function el(etiqueta, props = {}, ...hijos) {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "clase") e.className = v;
    else if (k === "texto") e.textContent = v;
    else if (k === "html") e.innerHTML = v; // solo para iconos fijos nuestros
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat()) if (h != null) e.append(h);
  return e;
}

function svgEstrella(llena, tam = 18) {
  const color = llena ? "#ffd166" : "#2a3d6b";
  return `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" aria-hidden="true"><path fill="${color}" d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>`;
}

export function estrellas(n) {
  return el("span", { clase: "k-estrellas", role: "img", "aria-label": `${n} de 5 estrellas`,
    html: [1, 2, 3, 4, 5].map((i) => svgEstrella(i <= n)).join("") });
}

export function avatar(foto, alias, tam = 40) {
  if (foto) {
    return el("img", { clase: "k-avatar", src: foto, alt: "", width: tam, height: tam,
      referrerpolicy: "no-referrer", loading: "lazy", style: `width:${tam}px;height:${tam}px` });
  }
  return el("span", { clase: "k-avatar", "aria-hidden": "true", style: `width:${tam}px;height:${tam}px`,
    texto: (alias || "?").trim().charAt(0).toUpperCase() });
}

export function fecha(d) {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function tarjetaOpinion(o, { mia = false, acciones = [] } = {}) {
  const t = el("article", { clase: "k-opinion" },
    el("header", {},
      avatar(o.foto, o.alias),
      el("div", {},
        el("b", { texto: o.alias }),
        el("time", { datetime: o.creada.toISOString(),
          texto: fecha(o.creada) + (o.editada ? " · editada" : "") })),
      mia ? el("span", { clase: "k-tuya", texto: "Tuya" }) : null),
    estrellas(o.estrellas),
    el("p", { texto: o.comentario }),
    o.sugerencia ? el("div", { clase: "k-sugerencia" }, el("small", { texto: "Sugerencia" }), el("p", { texto: o.sugerencia })) : null,
    o.moderada ? el("span", { clase: "k-moderada", title: "El moderador ha corregido parte del texto para cumplir las normas de la comunidad.",
      texto: "Editada por moderación" }) : null,
    o.respuesta ? el("div", { clase: "k-respuesta" },
      el("div", { clase: "k-respuesta-cabeza" },
        el("img", { src: "imagenes/icono.png", alt: "", width: 22, height: 22 }),
        el("b", { texto: "Respuesta de KLEVOR" }),
        o.respondida ? el("time", { datetime: o.respondida.toISOString(), texto: fecha(o.respondida) }) : null),
      el("p", { texto: o.respuesta })) : null,
    acciones.length ? el("div", { clase: "k-acciones" }, acciones) : null);
  return t;
}

// ------------------------------------------------------------------ ventanas
let ventanaAbierta = null;

export function abrirVentana(contenido, { alCerrar } = {}) {
  cerrarVentana();
  const anterior = document.activeElement;
  const fondo = el("div", { clase: "k-fondo" });
  const caja = el("div", { clase: "k-ventana", role: "dialog", "aria-modal": "true" }, contenido);
  fondo.append(caja);
  const cerrar = () => {
    fondo.remove();
    document.removeEventListener("keydown", tecla);
    if (ventanaAbierta === cerrar) ventanaAbierta = null;
    if (anterior && anterior.focus) anterior.focus();
    if (alCerrar) alCerrar();
  };
  const tecla = (e) => {
    if (e.key === "Escape") cerrar();
    if (e.key === "Tab") {
      const f = caja.querySelectorAll("button:not(:disabled), input, textarea, a[href]");
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    }
  };
  fondo.addEventListener("mousedown", (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener("keydown", tecla);
  document.body.append(fondo);
  ventanaAbierta = cerrar;
  const primero = caja.querySelector("[autofocus], input, textarea, button");
  if (primero) primero.focus();
  return cerrar;
}

export function cerrarVentana() { if (ventanaAbierta) ventanaAbierta(); }

/** Ventana de confirmación. Si `escribir` tiene texto, hay que teclearlo para poder confirmar. */
export function confirmar({ titulo, texto, boton = "Confirmar", peligro = false, escribir = "" }) {
  return new Promise((resolver) => {
    let decidido = false;
    const ok = el("button", { type: "button", clase: "k-btn " + (peligro ? "k-btn-peligro-lleno" : "k-btn-principal"),
      texto: boton, disabled: !!escribir });
    const no = el("button", { type: "button", clase: "k-btn k-btn-borde", texto: "Cancelar" });
    const campo = escribir ? el("div", { clase: "k-campo" },
      el("label", { for: "k-confirmar-texto", html: `Para confirmar, escribe <b>${escribir}</b>` }),
      el("input", { type: "text", id: "k-confirmar-texto", autocomplete: "off",
        oninput: (e) => { ok.disabled = e.target.value.trim() !== escribir; } })) : null;
    const cerrar = abrirVentana([
      el("h2", { texto: titulo }), el("p", { clase: "k-intro", texto }), campo,
      el("div", { clase: "k-pie-ventana" }, no, ok)],
      { alCerrar: () => { if (!decidido) resolver(false); } });
    no.addEventListener("click", () => cerrar());
    ok.addEventListener("click", () => { decidido = true; cerrar(); resolver(true); });
  });
}

export function aviso(texto, ms = 3200) {
  document.querySelectorAll(".k-toast").forEach((t) => t.remove());
  const t = el("div", { clase: "k-toast", role: "status", texto });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

/** Ventana para escribir o editar una opinión. Devuelve una promesa: true si se guardó. */
export function ventanaOpinion(u, perfil, existente = null) {
  return new Promise((resolver) => {
    let elegidas = existente ? existente.estrellas : 0;
    let guardado = false;
    const textoEstrellas = el("span", { clase: "k-texto-estrellas", "aria-live": "polite",
      texto: NOMBRES_ESTRELLAS[elegidas] });
    const botones = [1, 2, 3, 4, 5].map((i) => el("button", { type: "button", "aria-label": `${i} estrellas`,
      "aria-pressed": String(i <= elegidas), html: svgEstrella(i <= elegidas, 36) }));
    const pintar = (n) => botones.forEach((b, i) => { b.innerHTML = svgEstrella(i < n, 36); });
    botones.forEach((b, i) => {
      b.addEventListener("mouseenter", () => pintar(i + 1));
      b.addEventListener("mouseleave", () => pintar(elegidas));
      b.addEventListener("click", () => {
        elegidas = i + 1;
        pintar(elegidas);
        botones.forEach((x, j) => x.setAttribute("aria-pressed", String(j < elegidas)));
        textoEstrellas.textContent = NOMBRES_ESTRELLAS[elegidas];
      });
    });
    const contador = (area, max) => {
      const c = el("span", { clase: "k-contador", texto: `${area.value.length}/${max}` });
      area.addEventListener("input", () => { c.textContent = `${area.value.length}/${max}`; });
      return c;
    };
    const comentario = el("textarea", { id: "k-comentario", rows: 5, maxlength: 1000,
      placeholder: "¿Qué tal te va con KLEVOR? ¿Qué es lo que más usas?" });
    comentario.value = existente ? existente.comentario : "";
    const sugerencia = el("textarea", { id: "k-sugerencia", rows: 3, maxlength: 500,
      placeholder: "¿Qué te gustaría que hiciera KLEVOR?" });
    sugerencia.value = existente ? existente.sugerencia : "";
    const error = el("div", { clase: "k-error", role: "alert", hidden: true });
    const guardar = el("button", { type: "submit", clase: "k-btn k-btn-principal",
      texto: existente ? "Guardar cambios" : "Publicar opinión" });
    const cancelar = el("button", { type: "button", clase: "k-btn k-btn-borde", texto: "Cancelar" });

    const form = el("form", { novalidate: true },
      el("h2", { texto: existente ? "Editar tu opinión" : "Comparte tu experiencia" }),
      el("p", { clase: "k-intro", texto: `Publicarás como «${perfil.alias}»${perfil.mostrarFoto ? " con tu foto de Google" : ""}. ` +
        "Puedes cambiarlo en «Mi cuenta»." }),
      error,
      el("div", { clase: "k-campo" }, el("span", { clase: "k-etiqueta", id: "k-et-estrellas", texto: "Tu valoración" }),
        el("div", { clase: "k-elegir-estrellas", role: "group", "aria-labelledby": "k-et-estrellas" }, botones), textoEstrellas),
      el("div", { clase: "k-campo" }, el("label", { for: "k-comentario", texto: "Tu opinión" }), comentario, contador(comentario, 1000)),
      el("div", { clase: "k-campo" }, el("label", { for: "k-sugerencia", html: "Sugerencias <small>(opcional)</small>" }),
        sugerencia, contador(sugerencia, 500)),
      el("div", { clase: "k-pie-ventana" }, cancelar, guardar),
      el("p", { clase: "k-aviso-legal", html: 'Tu opinión será pública. Tu correo nunca se muestra. ' +
        '<a href="privacidad.html">Privacidad</a>.' }));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const datos = { estrellas: elegidas, comentario: comentario.value.trim(), sugerencia: sugerencia.value.trim() };
      const fallo = K.validar(datos);
      if (fallo) { error.textContent = fallo; error.hidden = false; return; }
      error.hidden = true;
      guardar.disabled = true;
      guardar.textContent = "Guardando…";
      try {
        if (existente) await K.editar(u, existente.id, datos);
        else await K.publicar(u, datos);
        guardado = true;
        cerrar();
        resolver(true);
      } catch (err) {
        const m = K.mensajeError(err);
        error.textContent = m || "No se ha podido guardar.";
        error.hidden = false;
        guardar.disabled = false;
        guardar.textContent = existente ? "Guardar cambios" : "Publicar opinión";
      }
    });
    const cerrar = abrirVentana(form, { alCerrar: () => { if (!guardado) resolver(false); } });
    cancelar.addEventListener("click", () => cerrar());
  });
}

/** Moderador: responder como KLEVOR. Devuelve true si se guardó. */
export function ventanaResponder(o) {
  return new Promise((resolver) => {
    let guardado = false;
    const area = el("textarea", { id: "k-respuesta", rows: 5, maxlength: 1000, placeholder: "¡Gracias por tu opinión! …" });
    area.value = o.respuesta || "";
    const error = el("div", { clase: "k-error", role: "alert", hidden: true });
    const ok = el("button", { type: "submit", clase: "k-btn k-btn-principal", texto: "Publicar respuesta" });
    const quitar = o.respuesta ? el("button", { type: "button", clase: "k-btn k-btn-peligro", texto: "Quitar respuesta" }) : null;
    const cancelar = el("button", { type: "button", clase: "k-btn k-btn-borde", texto: "Cancelar" });
    const guardar = async (texto) => {
      ok.disabled = true;
      try { await K.responder(o.id, texto); guardado = true; cerrar(); resolver(true); }
      catch (e) { error.textContent = K.mensajeError(e); error.hidden = false; ok.disabled = false; }
    };
    const form = el("form", { novalidate: true },
      el("h2", { texto: "Responder como KLEVOR" }),
      el("p", { clase: "k-intro", texto: `Tu respuesta aparecerá debajo de la opinión de «${o.alias}», con el nombre «Respuesta de KLEVOR».` }),
      error,
      el("div", { clase: "k-campo" }, el("label", { for: "k-respuesta", texto: "Respuesta" }), area),
      el("div", { clase: "k-pie-ventana" }, quitar, cancelar, ok));
    form.addEventListener("submit", (e) => { e.preventDefault(); if (area.value.trim()) guardar(area.value); });
    if (quitar) quitar.addEventListener("click", () => guardar(null));
    const cerrar = abrirVentana(form, { alCerrar: () => { if (!guardado) resolver(false); } });
    cancelar.addEventListener("click", () => cerrar());
  });
}

/** Moderador: corregir el texto de una opinión ajena (queda marcada). Devuelve true si se guardó. */
export function ventanaModerar(o) {
  return new Promise((resolver) => {
    let guardado = false;
    const comentario = el("textarea", { id: "k-mod-comentario", rows: 5, maxlength: 1000 });
    comentario.value = o.comentario;
    const sugerencia = el("textarea", { id: "k-mod-sugerencia", rows: 3, maxlength: 500 });
    sugerencia.value = o.sugerencia || "";
    const error = el("div", { clase: "k-error", role: "alert", hidden: true });
    const ok = el("button", { type: "submit", clase: "k-btn k-btn-principal", texto: "Guardar corrección" });
    const cancelar = el("button", { type: "button", clase: "k-btn k-btn-borde", texto: "Cancelar" });
    const form = el("form", { novalidate: true },
      el("h2", { texto: "Editar como moderador" }),
      el("p", { clase: "k-intro", texto: `Úsalo para quitar insultos, enlaces o datos personales del texto de «${o.alias}». ` +
        "La opinión mostrará «Editada por moderación». Las estrellas no se pueden cambiar." }),
      error,
      el("div", { clase: "k-campo" }, el("label", { for: "k-mod-comentario", texto: "Comentario" }), comentario),
      el("div", { clase: "k-campo" }, el("label", { for: "k-mod-sugerencia", texto: "Sugerencia" }), sugerencia),
      el("div", { clase: "k-pie-ventana" }, cancelar, ok));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      ok.disabled = true;
      try {
        await K.moderarTexto(o.id, { comentario: comentario.value, sugerencia: sugerencia.value });
        guardado = true; cerrar(); resolver(true);
      } catch (err) { error.textContent = K.mensajeError(err); error.hidden = false; ok.disabled = false; }
    });
    const cerrar = abrirVentana(form, { alCerrar: () => { if (!guardado) resolver(false); } });
    cancelar.addEventListener("click", () => cerrar());
  });
}

/** Botón «Iniciar sesión» o la foto con su menú, en la barra de arriba. */
export function pintarCuentaNav(caja, u, { alSalir } = {}) {
  caja.replaceChildren();
  if (!u) {
    caja.append(el("button", { type: "button", clase: "k-entrar", html: ICONO_GOOGLE + "<span>Iniciar sesión</span>",
      "aria-label": "Iniciar sesión con Google",
      onclick: async () => {
        try { await K.entrar(); aviso("¡Hola! Has iniciado sesión."); }
        catch (e) { const m = K.mensajeError(e); if (m) aviso(m, 5000); }
      } }));
    return;
  }
  const boton = el("button", { type: "button", clase: "k-avatar-boton", "aria-haspopup": "true", "aria-expanded": "false",
    "aria-label": "Tu cuenta" }, avatar(u.photoURL, u.displayName, 36));
  let menu = null;
  const cerrarMenu = () => { if (menu) { menu.remove(); menu = null; boton.setAttribute("aria-expanded", "false"); } };
  boton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu) return cerrarMenu();
    menu = el("div", { clase: "k-menu", role: "menu" },
      el("div", { clase: "k-quien" }, el("b", { texto: u.displayName || "Tu cuenta" }), el("span", { texto: u.email || "" })),
      el("a", { href: "cuenta.html", role: "menuitem", texto: "Mi cuenta" }),
      el("a", { href: "cuenta.html#mis-chats", role: "menuitem", texto: "Mis chats" }),
      el("a", { href: "cuenta.html#mis-opiniones", role: "menuitem", texto: "Mis opiniones" }),
      el("button", { type: "button", role: "menuitem", texto: "Cerrar sesión",
        onclick: async () => { cerrarMenu(); await K.salir(); aviso("Has cerrado sesión."); if (alSalir) alSalir(); } }));
    caja.append(menu);
    boton.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (e) => { if (menu && !menu.contains(e.target)) cerrarMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });
  caja.append(boton);
}
