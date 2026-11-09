// Tema oscuro (predeterminado, «Materia viva») o claro.
// Se carga en <head> para aplicar el tema guardado antes de pintar y evitar el parpadeo.
(function () {
  var raiz = document.documentElement;

  // La etiqueta color-scheme le dice al navegador qué colores usa la página.
  // "only light" impide que el modo oscuro forzado (Opera GX, Chrome) invierta la versión clara.
  function sincronizarMeta(claro) {
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', claro ? 'only light' : 'dark');
  }

  try { if (localStorage.getItem('tema') === 'light') raiz.dataset.theme = 'light'; } catch (_) {}
  sincronizarMeta(raiz.dataset.theme === 'light');

  window.Tema = {
    esClaro: function () { return raiz.dataset.theme === 'light'; },
    alternar: function () {
      var claro = !this.esClaro();
      if (claro) raiz.dataset.theme = 'light'; else delete raiz.dataset.theme;
      sincronizarMeta(claro);
      try { localStorage.setItem('tema', claro ? 'light' : 'dark'); } catch (_) {}
      return claro;
    },
    // Crea el botón de cambio de tema (luna/sol) y lo mantiene etiquetado
    boton: function (clase) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = clase;
      b.innerHTML =
        '<svg class="tema-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
        '<svg class="tema-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
      var self = this;
      var etiquetar = function () { b.setAttribute('aria-label', self.esClaro() ? 'Cambiar a colores oscuros' : 'Cambiar a colores claros'); b.title = b.getAttribute('aria-label'); };
      etiquetar();
      b.addEventListener('click', function () { self.alternar(); etiquetar(); });
      return b;
    },
  };
})();
