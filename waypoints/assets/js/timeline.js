/**
 * Asse temporale: tick, scrubber, intervalli, riproduzione.
 *
 * La timeline e la scia sono lo stesso oggetto in due proiezioni: la scia è il
 * percorso nello spazio, questo è lo stesso percorso disteso nel tempo.
 * Condividono colore, stato e selezione.
 *
 * Le due maniglie sono un solo meccanismo: quella di destra da sola è lo
 * scrubber (mostra "tutto fino a qui"), le due insieme selezionano un periodo.
 */

import { formattaPeriodo } from './dati.js';

const ANNO = 365.2425 * 86400000;
const MS_PER_ANNO = 2000; // velocità di riproduzione: ~2 secondi per anno
const SEPARAZIONE = 0.011; // quanto devono distare due tick prima di impilarsi
const RIGHE = 3;

export function creaTimeline({ elemento, stato }) {
  const luoghi = stato.dati.cronologia;
  if (!luoghi.length) {
    elemento.hidden = true;
    return null;
  }
  elemento.hidden = false;

  /* --------------------------------------------------------------- asse */

  const primoAnno = new Date(Math.min(...luoghi.map((l) => l.inizio))).getUTCFullYear();
  const ultimoAnno = new Date(Math.max(...luoghi.map((l) => l.fine))).getUTCFullYear();
  const asseDa = Date.UTC(primoAnno, 0, 1);
  const asseA = Date.UTC(ultimoAnno + 1, 0, 1) - 1;
  const durata = Math.max(asseA - asseDa, ANNO);

  const frazione = (t) => Math.min(1, Math.max(0, (t - asseDa) / durata));
  const istante = (f) => asseDa + Math.min(1, Math.max(0, f)) * durata;

  const unicoViaggio = luoghi.length === 1;
  const ridottoMovimento = matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------ scheletro */

  elemento.innerHTML = `
    <div class="timeline__comandi">
      <button class="timeline__play" data-play type="button" aria-label="Play the diary">
        <span class="timeline__play-segno" aria-hidden="true">▶</span>
      </button>
      <button class="timeline__tutto" data-tutto type="button" hidden
              title="Back to the whole diary">show all</button>
      <label class="timeline__segui">
        <input type="checkbox" data-segui checked> <span>follow the trail</span>
      </label>
    </div>
    <div class="timeline__asse" data-asse>
      <div class="asse__anni" data-anni></div>
      <div class="asse__linea"></div>
      <div class="asse__selezione" data-selezione></div>
      <div class="asse__tick" data-tick></div>
      <button class="maniglia maniglia--da" data-maniglia="da" type="button"
              role="slider" aria-label="Start of the period shown"
              aria-valuemin="${primoAnno}" aria-valuemax="${ultimoAnno + 1}"></button>
      <button class="maniglia maniglia--a" data-maniglia="a" type="button"
              role="slider" aria-label="End of the period shown"
              aria-valuemin="${primoAnno}" aria-valuemax="${ultimoAnno + 1}"></button>
    </div>
    <label class="timeline__dovero">
      <span>where was I on</span>
      <input type="date" data-dovero
             min="${new Date(asseDa).toISOString().slice(0, 10)}"
             max="${new Date(asseA).toISOString().slice(0, 10)}">
    </label>
    <button class="timeline__apri" data-apri type="button" aria-expanded="false">
      <span data-apri-testo>${primoAnno === ultimoAnno ? primoAnno : `${primoAnno}–${ultimoAnno}`}</span>
    </button>`;

  const nodo = {
    asse: elemento.querySelector('[data-asse]'),
    anni: elemento.querySelector('[data-anni]'),
    tick: elemento.querySelector('[data-tick]'),
    selezione: elemento.querySelector('[data-selezione]'),
    play: elemento.querySelector('[data-play]'),
    segui: elemento.querySelector('[data-segui]'),
    maniglie: {
      da: elemento.querySelector('[data-maniglia="da"]'),
      a: elemento.querySelector('[data-maniglia="a"]')
    },
    apri: elemento.querySelector('[data-apri]'),
    tutto: elemento.querySelector('[data-tutto]')
  };

  if (unicoViaggio) nodo.play.hidden = true; // non c'è niente da riprodurre

  /* --------------------------------------------------------------- tick */

  const tickPerLuogo = new Map();

  function disegnaTick() {
    nodo.tick.replaceChildren();
    tickPerLuogo.clear();

    const ultimaX = new Array(RIGHE).fill(-Infinity);
    for (const luogo of luoghi) {
      const da = frazione(luogo.inizio);
      const a = frazione(luogo.fine);
      let riga = 0;
      while (riga < RIGHE - 1 && da - ultimaX[riga] < SEPARAZIONE) riga++;
      ultimaX[riga] = Math.max(a, da);

      const segno = document.createElement('button');
      segno.type = 'button';
      segno.className = a - da > SEPARAZIONE / 2 ? 'tick tick--soggiorno' : 'tick';
      segno.style.left = `${da * 100}%`;
      segno.style.width = a - da > 0.002 ? `${(a - da) * 100}%` : '';
      segno.style.setProperty('--riga', riga);
      segno.title = `${luogo.nome} — ${formattaPeriodo(luogo)}`;
      segno.setAttribute('aria-label', segno.title);
      segno.addEventListener('click', (evento) => {
        evento.stopPropagation();
        stato.apriLuogo(luogo);
      });
      nodo.tick.append(segno);
      tickPerLuogo.set(luogo, segno);
    }
  }

  function disegnaAnni() {
    nodo.anni.replaceChildren();
    const quanti = ultimoAnno - primoAnno + 1;
    const larghezza = nodo.asse.clientWidth || 800;
    const passo = Math.max(1, Math.ceil((quanti * 42) / larghezza));
    for (let anno = primoAnno; anno <= ultimoAnno; anno += passo) {
      const etichetta = document.createElement('span');
      etichetta.className = 'asse__anno';
      etichetta.style.left = `${frazione(Date.UTC(anno, 0, 1)) * 100}%`;
      etichetta.textContent = anno;
      nodo.anni.append(etichetta);
    }
  }

  /* ------------------------------------------------------------ selezione */

  let da = asseDa;
  let a = asseA;
  let ultimaChiave = '';
  let inSelezione = false; // true quando la maniglia sinistra è stata mossa

  function insieme(daT, aT) {
    return luoghi.filter((luogo) => luogo.inizio <= aT && luogo.fine >= daT);
  }

  function etichettaRotta(daT, aT) {
    if (daT <= asseDa && aT >= asseA) return null;
    const annoDa = new Date(daT).getUTCFullYear();
    const annoA = new Date(aT).getUTCFullYear();
    return annoDa === annoA ? `${annoDa}` : `${annoDa}-${annoA}`;
  }

  /**
   * Aggiorna sempre la grafica; avvisa il resto del sito solo quando l'insieme
   * dei luoghi visibili cambia davvero. Trascinare lo scrubber non deve
   * ridisegnare marker e scia sessanta volte al secondo.
   */
  function applica({ daRotta = false } = {}) {
    if (a < da) [da, a] = [a, da];
    const fDa = frazione(da);
    const fA = frazione(a);

    nodo.maniglie.da.style.left = `${fDa * 100}%`;
    nodo.maniglie.a.style.left = `${fA * 100}%`;
    nodo.selezione.style.left = `${fDa * 100}%`;
    nodo.selezione.style.width = `${(fA - fDa) * 100}%`;
    // Confronto sugli istanti, non sulle frazioni: con un diario di un anno solo
    // `durata` è arrotondata all'anno medio e la frazione non tocca mai 1.
    const tutto = da <= asseDa && a >= asseA;
    // niente banda evidenziata quando è selezionato tutto: non è una selezione
    nodo.selezione.hidden = tutto;
    nodo.maniglie.da.setAttribute('aria-valuenow', new Date(da).getUTCFullYear());
    nodo.maniglie.a.setAttribute('aria-valuenow', new Date(a).getUTCFullYear());

    const visibili = insieme(da, a);
    const dentro = new Set(visibili);
    // il modo per tornare indietro deve essere visibile quando serve e sparire
    // quando non serve più: un filtro attivo senza uscita è una trappola
    nodo.tutto.hidden = tutto;
    for (const [luogo, segno] of tickPerLuogo) {
      segno.classList.toggle('tick--fuori', !dentro.has(luogo));
    }

    // "tutto" fa parte della chiave: alla fine della riproduzione l'insieme dei
    // luoghi non cambia più, ma lo stato deve tornare a "nessun filtro" (null).
    const chiave = `${tutto}|${visibili.length}:${visibili[0]?.slug ?? ''}:${visibili.at(-1)?.slug ?? ''}`;
    if (chiave === ultimaChiave) return;
    ultimaChiave = chiave;

    stato.impostaIntervallo(tutto ? null : { da, a, etichetta: etichettaRotta(da, a) }, { daRotta });
  }

  /* ------------------------------------------------------ trascinamento */

  function istanteDaEvento(evento) {
    const rettangolo = nodo.asse.getBoundingClientRect();
    return istante((evento.clientX - rettangolo.left) / rettangolo.width);
  }

  function collegaManiglia(quale) {
    const maniglia = nodo.maniglie[quale];
    maniglia.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      maniglia.setPointerCapture(evento.pointerId);
      fermaRiproduzione();
      const muovi = (e) => {
        if (quale === 'da') {
          da = istanteDaEvento(e);
          inSelezione = true;
        } else {
          a = istanteDaEvento(e);
        }
        applica();
      };
      const lascia = () => {
        maniglia.removeEventListener('pointermove', muovi);
        maniglia.removeEventListener('pointerup', lascia);
        maniglia.removeEventListener('pointercancel', lascia);
      };
      maniglia.addEventListener('pointermove', muovi);
      maniglia.addEventListener('pointerup', lascia);
      maniglia.addEventListener('pointercancel', lascia);
    });

    maniglia.addEventListener('keydown', (evento) => {
      const passo = evento.shiftKey ? ANNO : ANNO / 12;
      let delta = 0;
      if (evento.key === 'ArrowLeft') delta = -passo;
      else if (evento.key === 'ArrowRight') delta = passo;
      else if (evento.key === 'Home') delta = -Infinity;
      else if (evento.key === 'End') delta = Infinity;
      else return;
      evento.preventDefault();
      fermaRiproduzione();
      const valore = Math.min(asseA, Math.max(asseDa, (quale === 'da' ? da : a) + delta));
      if (quale === 'da') {
        da = valore;
        inSelezione = true;
      } else {
        a = valore;
      }
      applica();
    });
  }

  collegaManiglia('da');
  collegaManiglia('a');

  // clic sull'asse: porta lo scrubber lì
  nodo.asse.addEventListener('pointerdown', (evento) => {
    if (evento.target.closest('.maniglia, .tick')) return;
    fermaRiproduzione();
    a = istanteDaEvento(evento);
    applica();
  });

  /* ---------------------------------------------------- riproduzione */

  let animazione = null;

  function fermaRiproduzione() {
    if (animazione === null) return;
    cancelAnimationFrame(animazione);
    animazione = null;
    stato.inRiproduzione = false;
    elemento.classList.remove('timeline--in-riproduzione');
    nodo.play.setAttribute('aria-label', 'Play the diary');
  }

  function riproduci() {
    if (animazione !== null) {
      fermaRiproduzione();
      return;
    }
    if (ridottoMovimento.matches) {
      // niente animazione: un anno per clic, e dalla fine si ricomincia.
      // `a` è l'ultimo istante dell'anno, quindi l'anno corrente si legge da
      // `a + 1`: su 2018-12-31T23:59:59.999 getUTCFullYear() direbbe ancora 2018.
      const annoCorrente = new Date(a + 1).getUTCFullYear();
      a = a >= asseA
        ? Date.UTC(primoAnno + 1, 0, 1) - 1
        : Math.min(asseA, Date.UTC(annoCorrente + 1, 0, 1) - 1);
      da = asseDa;
      inSelezione = false;
      applica();
      return;
    }

    da = asseDa;
    inSelezione = false;
    a = asseDa;
    applica();

    stato.inRiproduzione = true;
    elemento.classList.add('timeline--in-riproduzione');
    nodo.play.setAttribute('aria-label', 'Stop playing');

    const totale = ((ultimoAnno - primoAnno + 1) * MS_PER_ANNO);
    const avvio = performance.now();
    const passo = (adesso) => {
      const avanzamento = Math.min(1, (adesso - avvio) / totale);
      a = istante(avanzamento);
      applica();
      if (avanzamento < 1) {
        animazione = requestAnimationFrame(passo);
        return;
      }
      fermaRiproduzione();
      // si ferma alla fine e torna allo stato "tutto visibile"
      da = asseDa;
      a = asseA;
      applica();
      stato.emetti('riproduzione-finita', {});
    };
    animazione = requestAnimationFrame(passo);
  }

  nodo.play.addEventListener('click', riproduci);

  function mostraTutto() {
    fermaRiproduzione();
    da = asseDa;
    a = asseA;
    inSelezione = false;
    applica();
  }

  nodo.tutto.addEventListener('click', mostraTutto);

  // "segui la scia": lo stato lo legge la mappa durante la riproduzione
  stato.seguiScia = nodo.segui.checked;
  nodo.segui.addEventListener('change', () => {
    stato.seguiScia = nodo.segui.checked;
  });

  /* -------------------------------------------------- "dov'ero il…" §9.4 */

  const campoData = elemento.querySelector('[data-dovero]');
  campoData.addEventListener('change', () => {
    if (!campoData.value) return;
    const quando = Date.parse(`${campoData.value}T12:00:00Z`);
    if (Number.isNaN(quando)) return;
    // il luogo più vicino nel tempo: se quel giorno eri lì, è quello stesso
    const vicino = luoghi.reduce((migliore, luogo) => {
      const scarto = quando < luogo.inizio ? luogo.inizio - quando
        : quando > luogo.fine ? quando - luogo.fine : 0;
      return scarto < migliore.scarto ? { luogo, scarto } : migliore;
    }, { luogo: null, scarto: Infinity });
    if (vicino.luogo) stato.apriLuogo(vicino.luogo);
  });

  /* --------------------------------------------------- mobile: espandi */

  nodo.apri.addEventListener('click', () => {
    const aperta = elemento.classList.toggle('timeline--aperta');
    nodo.apri.setAttribute('aria-expanded', String(aperta));
  });

  /* ------------------------------------------------------- ascoltatori */

  stato.on('selezione', ({ luogo }) => {
    for (const [altro, segno] of tickPerLuogo) {
      segno.classList.toggle('tick--attivo', altro === luogo);
    }
  });

  stato.on('rotta-tempo', ({ valore }) => {
    const numeri = String(valore).match(/(\d{4})(?:-(\d{4}))?/);
    if (!numeri) return;
    const annoDa = Number(numeri[1]);
    const annoA = numeri[2] ? Number(numeri[2]) : annoDa;
    da = Date.UTC(annoDa, 0, 1);
    a = Date.UTC(annoA + 1, 0, 1) - 1;
    inSelezione = true;
    applica({ daRotta: true });
  });

  addEventListener('resize', disegnaAnni);

  /* ------------------------------------------------------------- avvio */

  disegnaTick();
  disegnaAnni();
  applica({ daRotta: true });

  return {
    riproduci,
    fermaRiproduzione,
    mostraTutto,
    get seguiLaScia() {
      return nodo.segui.checked;
    }
  };
}
