/**
 * Bootstrap, stato globale, routing hash.
 *
 * Lo stato è un oggetto piccolo con un emettitore di eventi: mappa, timeline e
 * pannello lo osservano e non si parlano fra loro. L'unica sorgente di verità
 * dei contenuti resta `data/viaggi.json`.
 */

import { caricaViaggi, caricaMondo, statistiche, slugifica } from './dati.js';
import { creaMappa } from './mappa.js';
import { creaTimeline } from './timeline.js';
import { creaPannello } from './pannello.js';
import { creaGalleria } from './galleria.js';

/* ----------------------------------------------------------------- stato */

export function creaStato(dati) {
  const ascoltatori = new Map();

  const stato = {
    dati,
    luogoAttivo: null,
    paeseAttivo: null,
    panoramicaAperta: false,
    // intervallo temporale visibile: null = tutto
    intervallo: null,
    inRiproduzione: false,

    on(evento, funzione) {
      if (!ascoltatori.has(evento)) ascoltatori.set(evento, new Set());
      ascoltatori.get(evento).add(funzione);
      return () => ascoltatori.get(evento).delete(funzione);
    },

    emetti(evento, carico) {
      for (const funzione of ascoltatori.get(evento) ?? []) {
        try {
          funzione(carico);
        } catch (errore) {
          console.error(`Listener for "${evento}" failed:`, errore);
        }
      }
    },

    /** I luoghi compresi nell'intervallo attivo, in ordine cronologico. */
    get luoghiVisibili() {
      const tutti = dati.cronologia;
      if (!this.intervallo) return tutti;
      const { da, a } = this.intervallo;
      return tutti.filter((luogo) => luogo.inizio <= a && luogo.fine >= da);
    },

    get paesiVisibili() {
      const visti = new Map();
      for (const luogo of this.luoghiVisibili) {
        if (!visti.has(luogo.paese.id)) visti.set(luogo.paese.id, []);
        visti.get(luogo.paese.id).push(luogo);
      }
      return visti;
    },

    apriPanoramica() {
      this.luogoAttivo = null;
      this.paeseAttivo = null;
      this.panoramicaAperta = true;
      this.emetti('selezione', { luogo: null, paese: null, panoramica: true });
    },

    apriLuogo(luogo, opzioni = {}) {
      if (!luogo) return;
      this.luogoAttivo = luogo;
      this.paeseAttivo = luogo.paese;
      this.panoramicaAperta = false;
      this.emetti('selezione', { luogo, paese: luogo.paese, ...opzioni });
    },

    apriPaese(paese, opzioni = {}) {
      if (!paese) return;
      this.luogoAttivo = null;
      this.paeseAttivo = paese;
      this.panoramicaAperta = false;
      this.emetti('selezione', { luogo: null, paese, ...opzioni });
    },

    chiudi(opzioni = {}) {
      // la panoramica non ha né luogo né paese: senza tenerne conto qui, la X
      // del pannello non chiudeva niente
      if (!this.luogoAttivo && !this.paeseAttivo && !this.panoramicaAperta) return;
      this.luogoAttivo = null;
      this.paeseAttivo = null;
      this.panoramicaAperta = false;
      this.emetti('selezione', { luogo: null, paese: null, ...opzioni });
    },

    impostaIntervallo(intervallo, opzioni = {}) {
      this.intervallo = intervallo;
      this.emetti('intervallo', { intervallo, ...opzioni });
    }
  };

  return stato;
}

/* --------------------------------------------------------------- avvisi */

const nodoAvviso = document.querySelector('[data-avviso]');
const contenutoAvviso = document.querySelector('[data-avviso-contenuto]');

function mostraAvviso(titolo, html, { invito = false } = {}) {
  contenutoAvviso.innerHTML = `<h2>${titolo}</h2>${html}`;
  nodoAvviso.firstElementChild.classList.toggle('avviso__contenuto--invito', invito);
  nodoAvviso.hidden = false;
}

function nascondiAvviso() {
  nodoAvviso.hidden = true;
}

/* ------------------------------------------------------------- numeri §9.1 */

const PAROLE = {
  paesi: ['country', 'countries'],
  luoghi: ['place', 'places'],
  continenti: ['continent', 'continents']
};

function collegaNumeri(stato) {
  const contenitore = document.querySelector('[data-numeri]');
  contenitore.addEventListener('click', () => stato.apriPanoramica());
  contenitore.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    evento.preventDefault();
    stato.apriPanoramica();
  });

  function aggiorna() {
    const conti = statistiche(stato.luoghiVisibili);
    for (const chiave of Object.keys(PAROLE)) {
      contenitore.querySelector(`[data-numero="${chiave}"]`).textContent = conti[chiave];
      contenitore.querySelector(`[data-etichetta="${chiave}"]`).textContent =
        PAROLE[chiave][conti[chiave] === 1 ? 0 : 1];
    }
    contenitore.hidden = conti.luoghi === 0;
  }

  stato.on('intervallo', aggiorna);
  aggiorna();
}

/* ------------------------------------------------------------ ricerca */

/** `/` apre la ricerca, Enter apre il primo risultato, Esc chiude. */
function collegaRicerca(stato) {
  const contenitore = document.querySelector('[data-ricerca]');
  const campo = document.querySelector('[data-ricerca-campo]');
  const esiti = document.querySelector('[data-ricerca-esiti]');
  let trovati = [];
  let ultimoFuoco = null;

  const normalizza = (testo) => slugifica(testo).replace(/-/g, ' ');

  function apri() {
    if (!contenitore.hidden) return;
    ultimoFuoco = document.activeElement;
    contenitore.hidden = false;
    campo.value = '';
    disegna('');
    campo.focus();
  }

  function chiudi() {
    if (contenitore.hidden) return;
    contenitore.hidden = true;
    esiti.replaceChildren();
    if (ultimoFuoco?.isConnected) ultimoFuoco.focus();
  }

  function cerca(testo) {
    const ago = normalizza(testo).trim();
    if (!ago) return [];
    const risultati = [];
    for (const paese of stato.dati.paesi) {
      if (normalizza(paese.nome).includes(ago)) {
        risultati.push({ tipo: 'paese', nome: paese.nome, dettaglio: paese.continente, paese });
      }
    }
    for (const luogo of stato.dati.cronologia) {
      if (normalizza(luogo.nome).includes(ago)) {
        risultati.push({ tipo: 'luogo', nome: luogo.nome, dettaglio: luogo.paese.nome, luogo });
      }
    }
    return risultati.slice(0, 8);
  }

  function disegna(testo) {
    trovati = cerca(testo);
    esiti.replaceChildren();
    for (const [posizione, esito] of trovati.entries()) {
      const voce = document.createElement('li');
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = 'ricerca__esito';
      if (posizione === 0) bottone.classList.add('ricerca__esito--primo');
      bottone.append(
        pezzoTesto('span', esito.nome, 'ricerca__nome'),
        pezzoTesto('span', esito.dettaglio, 'ricerca__dettaglio')
      );
      bottone.addEventListener('click', () => scegli(esito));
      voce.append(bottone);
      esiti.append(voce);
    }
  }

  function scegli(esito) {
    chiudi();
    if (esito.tipo === 'paese') stato.apriPaese(esito.paese);
    else stato.apriLuogo(esito.luogo);
  }

  campo.addEventListener('input', () => disegna(campo.value));
  campo.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && trovati.length) {
      evento.preventDefault();
      scegli(trovati[0]);
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      esiti.querySelector('button')?.focus();
    }
  });

  contenitore.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      chiudi();
    }
  });
  contenitore.addEventListener('click', (evento) => {
    if (evento.target === contenitore) chiudi();
  });

  addEventListener('keydown', (evento) => {
    if (evento.key !== '/' || evento.metaKey || evento.ctrlKey) return;
    const attivo = document.activeElement;
    if (attivo && /^(input|textarea|select)$/i.test(attivo.tagName)) return;
    evento.preventDefault();
    apri();
  });

  return { apri, chiudi };
}

function pezzoTesto(tag, testo, classe) {
  const nodo = document.createElement(tag);
  nodo.className = classe;
  nodo.textContent = testo;
  return nodo;
}

/* ---------------------------------------------------------- ricorrenze */

const ANNI_A_PAROLE = [
  '', 'one year', 'two years', 'three years', 'four years', 'five years',
  'six years', 'seven years', 'eight years', 'nine years', 'ten years'
];

/**
 * Se oggi è l'anniversario di un viaggio, una riga discreta nell'header.
 * Se non lo è, niente: nessun segnaposto vuoto.
 */
function collegaRicorrenza(stato) {
  const nodo = document.querySelector('[data-ricorrenza]');
  const oggi = new Date();
  const mese = oggi.getMonth() + 1;
  const giorno = oggi.getDate();

  const ricorrenze = stato.dati.cronologia.filter((luogo) => {
    if (luogo.tempo.precisione !== 'giorno') return false;
    const anni = oggi.getFullYear() - luogo.tempo.anno;
    return anni >= 1 && luogo.tempo.mese === mese && luogo.tempo.giorno === giorno;
  });
  if (!ricorrenze.length) return;

  const luogo = ricorrenze[0];
  const anni = oggi.getFullYear() - luogo.tempo.anno;
  const quanto = ANNI_A_PAROLE[anni] ?? `${anni} years`;

  const collegamento = document.createElement('button');
  collegamento.type = 'button';
  collegamento.className = 'ricorrenza__link';
  collegamento.textContent = luogo.nome;
  collegamento.addEventListener('click', () => stato.apriLuogo(luogo));

  nodo.append(document.createTextNode(`${quanto} ago, `), collegamento);
  nodo.hidden = false;
}

/* -------------------------------------------------------------- routing */

function leggiHash() {
  const grezzo = decodeURIComponent(location.hash.replace(/^#\/?/, '')).trim();
  if (!grezzo) return { tipo: 'nessuno' };
  const parti = grezzo.split('/').filter(Boolean);
  if (parti[0] === 't') {
    return { tipo: 'tempo', valore: parti[1] ?? '' };
  }
  return { tipo: 'luogo', paese: parti[0], luogo: parti[1] ?? null };
}

function scriviHash(stato, { sostituisci = false } = {}) {
  let hash = '';
  if (stato.luogoAttivo) {
    hash = `#/${stato.luogoAttivo.paese.slug}/${stato.luogoAttivo.slug}`;
  } else if (stato.paeseAttivo) {
    hash = `#/${stato.paeseAttivo.slug}`;
  } else if (stato.intervallo?.etichetta) {
    hash = `#/t/${stato.intervallo.etichetta}`;
  }

  const nuovo = `${location.pathname}${location.search}${hash}`;
  if (nuovo === `${location.pathname}${location.search}${location.hash}`) return;
  if (sostituisci) history.replaceState(null, '', nuovo);
  else history.pushState(null, '', nuovo);
}

function applicaRotta(stato, rotta) {
  if (rotta.tipo === 'nessuno') {
    stato.chiudi({ daRotta: true });
    return;
  }
  if (rotta.tipo === 'tempo') {
    stato.emetti('rotta-tempo', { valore: rotta.valore });
    return;
  }
  const paese = stato.dati.paesiPerSlug.get(slugifica(rotta.paese));
  if (!paese) {
    stato.chiudi({ daRotta: true });
    return;
  }
  if (!rotta.luogo) {
    stato.apriPaese(paese, { daRotta: true });
    return;
  }
  const luogo = paese.luoghiPerSlug.get(slugifica(rotta.luogo));
  if (luogo) stato.apriLuogo(luogo, { daRotta: true });
  else stato.apriPaese(paese, { daRotta: true });
}

function collegaRouting(stato) {
  // pushState non emette hashchange: per non riapplicare una rotta che abbiamo
  // appena scritto noi basta ricordare l'ultimo hash visto.
  let ultimoHash = location.hash;

  function sincronizza() {
    if (location.hash === ultimoHash) return;
    ultimoHash = location.hash;
    applicaRotta(stato, leggiHash());
  }

  stato.on('selezione', (evento) => {
    if (evento.daRotta) return;
    scriviHash(stato);
    ultimoHash = location.hash;
  });

  stato.on('intervallo', (evento) => {
    if (evento.daRotta) return;
    if (stato.luogoAttivo || stato.paeseAttivo) return;
    scriviHash(stato, { sostituisci: true });
    ultimoHash = location.hash;
  });

  // hashchange copre l'URL modificato a mano, popstate il tasto "indietro"
  addEventListener('hashchange', sincronizza);
  addEventListener('popstate', sincronizza);

  applicaRotta(stato, leggiHash());
}

/* ------------------------------------------------------------------ avvio */

async function avvia() {
  let dati;
  try {
    dati = await caricaViaggi();
  } catch (errore) {
    mostraAvviso(
      'I cannot read the diary',
      `<p>${errore.message}</p>
       <p>The content lives in <code>data/viaggi.json</code>. If you opened this page by
       double-clicking it, serve the folder instead with
       <code>python -m http.server</code>.</p>`
    );
    return;
  }

  document.title = dati.meta.titolo || document.title;
  const titolo = document.querySelector('[data-titolo]');
  if (dati.meta.titolo) titolo.textContent = dati.meta.titolo;
  const sottotitolo = document.querySelector('[data-sottotitolo]');
  if (dati.meta.sottotitolo) {
    sottotitolo.textContent = dati.meta.sottotitolo;
    sottotitolo.hidden = false;
  }

  let geo;
  try {
    geo = await caricaMondo();
  } catch (errore) {
    mostraAvviso(
      'The world map is missing',
      `<p>${errore.message}</p>
       <p>Country geometries live in <code>data/mondo.json</code>. Regenerate them with
       <code>python tools/converti_geometrie.py</code> from
       <code>tools/countries-110m.topo.json</code>.</p>`
    );
    return;
  }

  const stato = creaStato(dati);
  window.diario = stato; // comodo da console, non usato dal sito

  // il pannello si registra prima della mappa: quando la mappa vola su un luogo
  // deve gia' sapere quanto spazio le resta libero
  const galleria = creaGalleria({ elemento: document.querySelector('[data-lightbox]'), stato });
  creaPannello({
    elemento: document.querySelector('[data-pannello]'),
    corpo: document.querySelector('[data-pannello-corpo]'),
    chiudiBottone: document.querySelector('[data-chiudi-pannello]'),
    stato,
    galleria
  });
  const mappa = creaMappa({ elemento: document.getElementById('mappa'), stato, geo });
  creaTimeline({ elemento: document.querySelector('[data-timeline]'), stato });
  collegaNumeri(stato);
  collegaRicerca(stato);
  collegaRicorrenza(stato);
  collegaRouting(stato);

  // il deep link ha la precedenza sulla vista d'insieme: due animazioni
  // contemporanee finiscono in uno zoom a caso
  if (!stato.luogoAttivo && !stato.paeseAttivo) mappa.inquadraTutto({ animate: false });

  if (!dati.paesi.length) {
    mostraAvviso(
      'Nothing here yet',
      `<p>There are no trips in <code>data/viaggi.json</code> so far.</p>
       <p>Add the first one by importing a folder of photographs:<br>
       <code>python tools/importa_foto.py ~/Photos/FirstTrip/ --lingua en</code></p>
       <p>Or by hand, for a place without photographs:<br>
       <code>python tools/aggiungi_luogo.py "Lisbon, Portugal" --data 2023-04 --lingua en</code></p>`,
      { invito: true }
    );
  } else {
    nascondiAvviso();
  }
}

avvia();
