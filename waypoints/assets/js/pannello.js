/**
 * Pannello di dettaglio: un componente, due modalità (paese e luogo).
 *
 * Le frecce "precedente / successivo" seguono l'ordine cronologico globale, non
 * quello alfabetico né quello per paese: il diario si legge come un percorso.
 *
 * Su schermo stretto è un bottom sheet a due stati: sbircia (solo il titolo) e
 * esteso (tutta la pagina).
 */

import { formattaPeriodo, formattaData, formattaCoord, statistiche } from './dati.js';

const PUNTI_CARDINALI = [
  ['nord', 'the northernmost point'],
  ['sud', 'the southernmost'],
  ['est', 'the easternmost'],
  ['ovest', 'the westernmost']
];

export function creaPannello({ elemento, corpo, chiudiBottone, stato, galleria }) {
  let ultimoFuoco = null;

  chiudiBottone.addEventListener('click', () => stato.chiudi());

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || elemento.hidden) return;
    if (!document.querySelector('[data-lightbox]')?.hidden) return; // prima chiude il lightbox
    stato.chiudi();
  });

  stato.on('selezione', ({ luogo, paese, panoramica }) => {
    if (panoramica) {
      mostra(contenutoPanoramica());
      return;
    }
    if (!luogo && !paese) {
      nascondi();
      return;
    }
    mostra(luogo ? contenutoLuogo(luogo) : contenutoPaese(paese));
  });

  // il pannello copre una parte della mappa: quando cambia il filtro temporale
  // e il luogo aperto esce dall'intervallo, il pannello va chiuso
  stato.on('intervallo', () => {
    if (!stato.luogoAttivo) return;
    if (!stato.luoghiVisibili.includes(stato.luogoAttivo)) stato.chiudi();
  });

  function mostra(contenuto) {
    const primaApertura = elemento.hidden;
    if (primaApertura) ultimoFuoco = document.activeElement;
    corpo.replaceChildren(contenuto);
    corpo.scrollTop = 0;
    elemento.hidden = false;
    elemento.classList.remove('pannello--sbircia');
    document.body.classList.add('con-pannello');
  }

  function nascondi() {
    if (elemento.hidden) return;
    elemento.hidden = true;
    corpo.replaceChildren();
    document.body.classList.remove('con-pannello');
    if (ultimoFuoco?.isConnected) ultimoFuoco.focus();
    ultimoFuoco = null;
  }

  /* ----------------------------------------------------- panoramica */

  /**
   * Statistiche cartografiche (§9.2, §9.3): gli estremi raggiunti e la
   * lunghezza della scia. Si apre dai tre numeri sotto il titolo e segue la
   * selezione temporale come tutto il resto.
   */
  function contenutoPanoramica() {
    const frammento = document.createDocumentFragment();
    const visibili = stato.luoghiVisibili;
    const conti = statistiche(visibili);

    frammento.append(titolo(stato.dati.meta.titolo || 'The diary', 'pannello-titolo'));

    const meta = document.createElement('p');
    meta.className = 'pannello__meta';
    meta.append(
      pezzo('span', `${conti.paesi} ${conti.paesi === 1 ? 'country' : 'countries'}`, 'mono'),
      pezzo('span', `${conti.luoghi} ${conti.luoghi === 1 ? 'place' : 'places'}`, 'mono'),
      pezzo('span', `${conti.continenti} ${conti.continenti === 1 ? 'continent' : 'continents'}`, 'mono')
    );
    frammento.append(meta);

    if (visibili.length > 1) {
      const distanza = document.createElement('p');
      distanza.className = 'pannello__distanza';
      distanza.append(
        pezzo('b', `${Math.round(conti.distanza).toLocaleString('en-GB')} km`, 'mono'),
        // etichetta onesta: non sono i chilometri percorsi
        pezzo('span', 'as the crow flies, between stops', 'pannello__distanza-nota')
      );
      frammento.append(distanza);
    }

    if (conti.estremi) {
      const elenco = document.createElement('dl');
      elenco.className = 'estremi';
      for (const [chiave, etichetta] of PUNTI_CARDINALI) {
        const luogo = conti.estremi[chiave];
        if (!luogo) continue;
        const termine = document.createElement('dt');
        termine.textContent = etichetta;
        const definizione = document.createElement('dd');
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'estremi__voce';
        bottone.append(
          pezzo('span', luogo.nome, 'estremi__nome'),
          pezzo('span', formattaCoord(luogo.coord), 'estremi__coord mono')
        );
        bottone.addEventListener('click', () => stato.apriLuogo(luogo));
        definizione.append(bottone);
        elenco.append(termine, definizione);
      }
      frammento.append(elenco);
    }

    return frammento;
  }

  /* --------------------------------------------------------- paese */

  function contenutoPaese(paese) {
    const frammento = document.createDocumentFragment();
    const luoghi = paese.luoghi;

    frammento.append(titolo(paese.nome, 'pannello-titolo'));

    const meta = document.createElement('p');
    meta.className = 'pannello__meta';
    const periodo = luoghi.length
      ? `${formattaData(luoghi[0].tempo)} – ${formattaData(luoghi.at(-1).tempoFine ?? luoghi.at(-1).tempo)}`
      : '';
    meta.append(
      pezzo('span', paese.continente),
      pezzo('span', periodo, 'mono'),
      pezzo('span', `${luoghi.length} ${luoghi.length === 1 ? 'place' : 'places'}`, 'mono')
    );
    frammento.append(meta);

    const elenco = document.createElement('ol');
    elenco.className = 'elenco-luoghi';
    for (const luogo of luoghi) {
      const voce = document.createElement('li');
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = 'elenco-luoghi__voce';
      bottone.append(
        pezzo('span', luogo.nome, 'elenco-luoghi__nome'),
        pezzo('span', formattaPeriodo(luogo), 'elenco-luoghi__data mono')
      );
      bottone.addEventListener('click', () => stato.apriLuogo(luogo));
      voce.append(bottone);
      elenco.append(voce);
    }
    frammento.append(elenco);
    return frammento;
  }

  /* --------------------------------------------------------- luogo */

  function contenutoLuogo(luogo) {
    const frammento = document.createDocumentFragment();

    const soprattitolo = document.createElement('p');
    soprattitolo.className = 'pannello__paese';
    const versoPaese = document.createElement('button');
    versoPaese.type = 'button';
    versoPaese.className = 'pannello__paese-link';
    versoPaese.textContent = luogo.paese.nome;
    versoPaese.addEventListener('click', () => stato.apriPaese(luogo.paese));
    soprattitolo.append(versoPaese);
    frammento.append(soprattitolo);

    frammento.append(titolo(luogo.nome, 'pannello-titolo'));

    const meta = document.createElement('p');
    meta.className = 'pannello__meta';
    meta.append(
      pezzo('span', formattaPeriodo(luogo), 'mono'),
      pezzo('span', formattaCoord(luogo.coord), 'mono')
    );
    frammento.append(meta);

    if (luogo.descrizione) {
      frammento.append(pezzo('p', luogo.descrizione, 'pannello__testo'));
    }

    if (luogo.nota) {
      const nota = document.createElement('blockquote');
      nota.className = 'pannello__nota';
      nota.append(pezzo('p', luogo.nota));
      frammento.append(nota);
    }

    const foto = galleria.griglia(luogo);
    if (foto) frammento.append(foto);

    if (luogo.punti.length) {
      const punti = document.createElement('p');
      punti.className = 'pannello__punti';
      punti.append(pezzo('span', 'Also: ', 'pannello__punti-etichetta'));
      punti.append(document.createTextNode(luogo.punti.map((p) => p.nome).join(' · ')));
      frammento.append(punti);
    }

    if (luogo.fonte?.url) {
      const fonte = document.createElement('p');
      fonte.className = 'pannello__fonte';
      const collegamento = document.createElement('a');
      collegamento.href = luogo.fonte.url;
      collegamento.textContent = luogo.fonte.testo || 'source';
      collegamento.rel = 'noopener noreferrer';
      collegamento.target = '_blank';
      fonte.append(collegamento);
      frammento.append(fonte);
    }

    frammento.append(frecce(luogo));
    return frammento;
  }

  /** Precedente e successivo nell'ordine cronologico globale. */
  function frecce(luogo) {
    const cronologia = stato.dati.cronologia;
    const posizione = cronologia.indexOf(luogo);
    const navigazione = document.createElement('nav');
    navigazione.className = 'pannello__frecce';
    navigazione.setAttribute('aria-label', 'Previous and next place');

    for (const [passo, etichetta, classe] of [
      [-1, 'previous', 'pannello__freccia--prec'],
      [1, 'next', 'pannello__freccia--succ']
    ]) {
      const altro = cronologia[posizione + passo];
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = `pannello__freccia ${classe}`;
      bottone.disabled = !altro;
      bottone.append(
        pezzo('span', etichetta, 'pannello__freccia-etichetta'),
        pezzo('span', altro ? altro.nome : '—', 'pannello__freccia-nome')
      );
      if (altro) bottone.addEventListener('click', () => stato.apriLuogo(altro));
      navigazione.append(bottone);
    }
    return navigazione;
  }

  /* ------------------------------------------------ bottom sheet mobile */

  collegaSbirciata(elemento, corpo);

  return { nascondi };
}

/* ------------------------------------------------------------- utilità */

function titolo(testo, id) {
  const nodo = document.createElement('h2');
  nodo.className = 'pannello__titolo';
  nodo.id = id;
  nodo.textContent = testo;
  return nodo;
}

function pezzo(tag, testo, classe) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  nodo.textContent = testo;
  return nodo;
}

/**
 * Su schermo stretto il pannello è un foglio trascinabile a due stati.
 * Il trascinamento parte dal bordo superiore, non dal contenuto, altrimenti si
 * litiga con lo scorrimento del testo.
 */
function collegaSbirciata(elemento, corpo) {
  const maniglia = document.createElement('button');
  maniglia.type = 'button';
  maniglia.className = 'pannello__maniglia';
  maniglia.setAttribute('aria-label', 'Expand or collapse the panel');
  elemento.prepend(maniglia);

  let trascinato = false;

  maniglia.addEventListener('click', () => {
    if (trascinato) {
      trascinato = false; // il trascinamento ha già deciso lo stato
      return;
    }
    elemento.classList.toggle('pannello--sbircia');
  });

  let partenzaY = null;
  maniglia.addEventListener('pointerdown', (evento) => {
    partenzaY = evento.clientY;
    maniglia.setPointerCapture(evento.pointerId);
  });
  maniglia.addEventListener('pointerup', (evento) => {
    if (partenzaY === null) return;
    const delta = evento.clientY - partenzaY;
    partenzaY = null;
    if (Math.abs(delta) < 24) return; // era un clic, ci pensa il gestore sopra
    trascinato = true;
    elemento.classList.toggle('pannello--sbircia', delta > 0);
    corpo.scrollTop = 0;
  });
}
