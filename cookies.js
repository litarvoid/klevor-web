/* Gestor de consentimiento de cookies de KLEVOR.
 *
 * - Guarda la decisión en el almacenamiento local del navegador («klevor_consentimiento»),
 *   que es lo único técnico/necesario que usa la web. Dura 12 meses; luego se vuelve a preguntar.
 * - Lo no necesario empieza APAGADO y no se activa hasta que la persona lo acepta.
 * - Para añadir en el futuro una herramienta opcional (estadísticas, etc.), ponla así y solo
 *   se cargará con permiso:
 *     <script type="text/plain" data-cookies="analiticas" data-src="https://..."></script>
 *   y descríbela en cookies.html. Si cambias lo que se usa, sube VERSION para volver a preguntar.
 */
(function () {
  "use strict";
  var CLAVE = "klevor_consentimiento";
  var VERSION = 2; // 2: llegan las cuentas y el orden de las opiniones
  var DURACION = 365 * 24 * 60 * 60 * 1000; // 12 meses
  var CATEGORIAS = ["preferencias", "analiticas", "publicidad"];

  function leer() {
    try {
      var d = JSON.parse(localStorage.getItem(CLAVE) || "null");
      if (!d || d.version !== VERSION || !(Date.now() - d.fecha < DURACION)) return null;
      return d;
    } catch (e) { return null; }
  }

  function guardar(elecciones) {
    var d = { version: VERSION, fecha: Date.now() };
    CATEGORIAS.forEach(function (c) { d[c] = !!elecciones[c]; });
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) { /* navegador sin almacenamiento */ }
    estado = d;
    aplicar();
    document.dispatchEvent(new CustomEvent("klevor-cookies", { detail: d }));
  }

  var estado = leer();

  function permitido(categoria) {
    if (categoria === "necesarias") return true;
    return !!(estado && estado[categoria]);
  }

  /* Activa los scripts opcionales que ya tienen permiso (ahora mismo no hay ninguno). */
  function aplicar() {
    var esperando = document.querySelectorAll('script[type="text/plain"][data-cookies]');
    Array.prototype.forEach.call(esperando, function (viejo) {
      if (!permitido(viejo.getAttribute("data-cookies"))) return;
      var nuevo = document.createElement("script");
      if (viejo.getAttribute("data-src")) nuevo.src = viejo.getAttribute("data-src");
      else nuevo.text = viejo.text;
      viejo.parentNode.replaceChild(nuevo, viejo);
    });
  }

  // ------------------------------------------------------------------ interfaz
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  var aviso = null, fondo = null, ultimoFoco = null;

  function mostrarAviso() {
    if (aviso) return;
    aviso = el(
      '<section class="kc-aviso" role="region" aria-label="Aviso de cookies">' +
      '<h2>🍪 Tu privacidad, tu decisión</h2>' +
      '<p>Las cookies son pequeños archivos que una web guarda en tu navegador. KLEVOR usa lo ' +
      'imprescindible para funcionar (recordar lo que elijas aquí y, si inicias sesión, mantenerla) y, solo si lo ' +
      'aceptas, recuerda cómo prefieres ordenar las opiniones. No usamos cookies de estadísticas ni de publicidad. ' +
      '<a href="cookies.html">Política de cookies</a>.</p>' +
      '<div class="kc-botones">' +
      '<button type="button" class="kc-boton kc-rechazar" data-accion="rechazar">Rechazar las no necesarias</button>' +
      '<button type="button" class="kc-boton kc-configurar" data-accion="configurar">Configurar preferencias</button>' +
      '<button type="button" class="kc-boton kc-aceptar" data-accion="aceptar">Aceptar todas</button>' +
      '</div></section>');
    aviso.addEventListener("click", function (e) {
      var accion = e.target.getAttribute && e.target.getAttribute("data-accion");
      if (accion === "aceptar") terminar({ preferencias: true, analiticas: true, publicidad: true });
      if (accion === "rechazar") terminar({});
      if (accion === "configurar") abrirPanel();
    });
    document.body.appendChild(aviso);
  }

  function quitarAviso() {
    if (aviso) { aviso.remove(); aviso = null; }
  }

  function categoriaHTML(id, titulo, texto, nota, fija) {
    var control = fija
      ? '<span class="kc-estado">Siempre activas</span>'
      : '<label class="kc-interruptor"><input type="checkbox" data-categoria="' + id + '"' +
        (permitido(id) ? " checked" : "") + ' aria-label="' + titulo + '"><span></span></label>';
    return '<div class="kc-categoria"><div class="kc-fila"><h3>' + titulo + '</h3>' + control + '</div>' +
      '<p>' + texto + '</p>' + (nota ? '<span class="kc-nota">' + nota + '</span>' : '') + '</div>';
  }

  function abrirPanel() {
    if (fondo) return;
    ultimoFoco = document.activeElement;
    fondo = el(
      '<div class="kc-fondo"><div class="kc-panel" role="dialog" aria-modal="true" aria-labelledby="kc-titulo">' +
      '<div class="kc-cabecera"><h2 id="kc-titulo">Configurar cookies</h2>' +
      '<button type="button" class="kc-cerrar" data-accion="cerrar" aria-label="Cerrar">×</button></div>' +
      '<p class="kc-intro">Elige qué permites. Lo no necesario está apagado hasta que lo actives, y puedes ' +
      'cambiarlo cuando quieras desde «Configurar cookies», al final de la página.</p>' +
      categoriaHTML("necesarias", "Técnicas o necesarias",
        "Imprescindibles para que la web funcione: recordar lo que eliges en este aviso (12 meses) y, solo si " +
        "inicias sesión con Google, mantener tu sesión abierta.", "", true) +
      categoriaHTML("preferencias", "De preferencias",
        "Recuerdan ajustes tuyos de la web. Hoy solo una: cómo prefieres ordenar las opiniones de la comunidad.", "") +
      categoriaHTML("analiticas", "Analíticas",
        "Servirían para saber cómo se usa la página (visitas, secciones más vistas) y mejorarla.",
        "Ahora mismo no se usa ninguna") +
      categoriaHTML("publicidad", "Publicitarias",
        "Servirían para mostrar anuncios. KLEVOR no tiene anuncios.", "Ahora mismo no se usa ninguna") +
      '<div class="kc-botones">' +
      '<button type="button" class="kc-boton kc-rechazar" data-accion="rechazar">Rechazar las no necesarias</button>' +
      '<button type="button" class="kc-boton kc-configurar" data-accion="guardar">Guardar mi selección</button>' +
      '<button type="button" class="kc-boton kc-aceptar" data-accion="aceptar">Aceptar todas</button>' +
      '</div><p class="kc-pie">Más información en la <a href="cookies.html">política de cookies</a>.</p>' +
      '</div></div>');
    fondo.addEventListener("click", function (e) {
      if (e.target === fondo) return cerrarPanel();
      var accion = e.target.getAttribute && e.target.getAttribute("data-accion");
      if (accion === "cerrar") cerrarPanel();
      if (accion === "aceptar") terminar({ preferencias: true, analiticas: true, publicidad: true });
      if (accion === "rechazar") terminar({});
      if (accion === "guardar") {
        var elecciones = {};
        Array.prototype.forEach.call(fondo.querySelectorAll("input[data-categoria]"), function (i) {
          elecciones[i.getAttribute("data-categoria")] = i.checked;
        });
        terminar(elecciones);
      }
    });
    fondo.addEventListener("keydown", function (e) {
      if (e.key === "Escape") cerrarPanel();
      if (e.key === "Tab") { // el foco no se escapa del panel
        var focos = fondo.querySelectorAll("button, input, a[href]");
        var primero = focos[0], ultimo = focos[focos.length - 1];
        if (e.shiftKey && document.activeElement === primero) { ultimo.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { primero.focus(); e.preventDefault(); }
      }
    });
    document.body.appendChild(fondo);
    if (aviso) aviso.classList.add("kc-oculto"); // el aviso vuelve si se cierra el panel sin decidir
    fondo.querySelector(".kc-cerrar").focus();
  }

  function terminar(elecciones) {
    guardar(elecciones);
    quitarAviso();
    cerrarPanel();
    mostrarConfirmacion();
  }

  function cerrarPanel() {
    if (!fondo) return;
    fondo.remove();
    fondo = null;
    if (aviso) aviso.classList.remove("kc-oculto");
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function mostrarConfirmacion() {
    var nota = document.getElementById("kc-guardado");
    if (nota) { nota.textContent = "Preferencias guardadas el " + new Date().toLocaleDateString("es-ES") + "."; }
  }

  function retirar() {
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    estado = null;
    mostrarAviso();
  }

  window.KlevorCookies = { abrirPanel: abrirPanel, permitido: permitido, retirar: retirar,
                           estado: function () { return estado; } };

  function iniciar() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-kc-abrir]"), function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); abrirPanel(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-kc-retirar]"), function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); retirar(); });
    });
    aplicar();
    if (!estado) mostrarAviso();
    else {
      var nota = document.getElementById("kc-guardado");
      if (nota) nota.textContent = "Elegiste tus preferencias el " +
        new Date(estado.fecha).toLocaleDateString("es-ES") + ".";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
