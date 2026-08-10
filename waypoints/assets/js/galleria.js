/**
 * Griglia delle foto e lightbox a piena pagina.
 *
 * Se un file manca, il nodo sparisce invece di lasciare un'icona rotta: un
 * luogo senza foto resta un luogo valido, con il suo testo e le sue coordinate.
 */

const SOGLIA_SWIPE = 45; // px

export function creaGalleria({ elemento, stato }) {
  let foto = [];
  let indice = 0;
  let ultimoFuoco = null;

  elemento.innerHTML = `
    <button class="lightbox__chiudi" data-chiudi type="button" aria-label="Close (Esc)">✕</button>
    <button class="lightbox__freccia lightbox__freccia--prec" data-prec type="button" aria-label="Previous photograph">‹</button>
    <figure class="lightbox__figura">
      <img data-immagine alt="">
      <figcaption class="lightbox__didascalia" data-didascalia></figcaption>
    </figure>
    <button class="lightbox__freccia lightbox__freccia--succ" data-succ type="button" aria-label="Next photograph">›</button>`;

  const nodo = {
    chiudi: elemento.querySelector('[data-chiudi]'),
    prec: elemento.querySelector('[data-prec]'),
    succ: elemento.querySelector('[data-succ]'),
    immagine: elemento.querySelector('[data-immagine]'),
    didascalia: elemento.querySelector('[data-didascalia]'),
    figura: elemento.querySelector('.lightbox__figura')
  };

  /* --------------------------------------------------------------- apri */

  function apri(elenco, partenza = 0) {
    if (!elenco?.length) return;
    foto = elenco;
    indice = Math.min(Math.max(0, partenza), foto.length - 1);
    ultimoFuoco = document.activeElement;
    elemento.hidden = false;
    document.body.classList.add('con-lightbox');
    mostra();
    nodo.chiudi.focus();
  }

  function chiudi() {
    if (elemento.hidden) return;
    elemento.hidden = true;
    document.body.classList.remove('con-lightbox');
    if (ultimoFuoco?.isConnected) ultimoFuoco.focus();
    ultimoFuoco = null;
  }

  function mostra() {
    const corrente = foto[indice];
    nodo.immagine.src = corrente.src;
    nodo.immagine.alt = corrente.didascalia || `Photograph of ${corrente.luogo.nome}`;
    nodo.didascalia.textContent = corrente.didascalia || '';
    nodo.didascalia.hidden = !corrente.didascalia;
    const sola = foto.length < 2;
    nodo.prec.hidden = sola;
    nodo.succ.hidden = sola;
    elemento.setAttribute('aria-label', corrente.didascalia || corrente.luogo.nome);
  }

  function scorri(passo) {
    if (foto.length < 2) return;
    indice = (indice + passo + foto.length) % foto.length;
    mostra();
  }

  nodo.chiudi.addEventListener('click', chiudi);
  nodo.prec.addEventListener('click', () => scorri(-1));
  nodo.succ.addEventListener('click', () => scorri(1));
  elemento.addEventListener('click', (evento) => {
    if (evento.target === elemento) chiudi(); // clic sullo sfondo
  });

  /* ------------------------------------------------- tastiera e trappola */

  elemento.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      chiudi();
      return;
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      scorri(-1);
      return;
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      scorri(1);
      return;
    }
    if (evento.key !== 'Tab') return;

    // trappola del fuoco: dentro il lightbox si gira in tondo
    const focalizzabili = [...elemento.querySelectorAll('button:not([hidden])')];
    if (!focalizzabili.length) return;
    const primo = focalizzabili[0];
    const ultimo = focalizzabili.at(-1);
    if (evento.shiftKey && document.activeElement === primo) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primo.focus();
    }
  });

  /* ------------------------------------------------------------- swipe */

  let partenzaX = null;
  nodo.figura.addEventListener('pointerdown', (evento) => {
    partenzaX = evento.clientX;
  });
  nodo.figura.addEventListener('pointerup', (evento) => {
    if (partenzaX === null) return;
    const delta = evento.clientX - partenzaX;
    partenzaX = null;
    if (Math.abs(delta) > SOGLIA_SWIPE) scorri(delta < 0 ? 1 : -1);
  });

  /* ---------------------------------------------- foto-marker sulla mappa */

  stato.on('foto', ({ luogo, indice: partenza }) => {
    apri(luogo.foto, partenza);
  });

  /* ------------------------------------------------------------ griglia */

  /** Costruisce la griglia delle miniature di un luogo, o null se non ce ne sono. */
  function griglia(luogo) {
    if (!luogo.foto.length) return null;

    const contenitore = document.createElement('div');
    contenitore.className = 'galleria';

    for (const [posizione, immagine] of luogo.foto.entries()) {
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = 'galleria__voce';

      const miniatura = document.createElement('img');
      miniatura.src = immagine.thumb;
      miniatura.alt = immagine.didascalia || `Photograph of ${luogo.nome}`;
      miniatura.width = 160;
      miniatura.height = 160;
      miniatura.loading = 'lazy';
      miniatura.decoding = 'async';
      // file mancante: via il nodo, e se non ne resta nessuno via la griglia
      miniatura.addEventListener('error', () => {
        bottone.remove();
        if (!contenitore.children.length) contenitore.remove();
      });

      bottone.append(miniatura);
      bottone.addEventListener('click', () => apri(luogo.foto, posizione));
      contenitore.append(bottone);
    }

    return contenitore;
  }

  return { apri, chiudi, griglia };
}
