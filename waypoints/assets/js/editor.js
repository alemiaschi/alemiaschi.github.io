/**
 * Editor di posizionamento — gira solo in locale, con tools/editor_server.py.
 *
 * La coda a sinistra sono le foto che l'import non è riuscito a collocare,
 * raggruppate per giornata. Si trascina la foto sul punto della mappa; al
 * rilascio compare un marker con la miniatura e si conferma. Ogni salvataggio
 * riscrive viaggi.json e lo stato viene riletto dal file: niente stato
 * solo-in-memoria da perdere.
 *
 * Qui la mappa ha le strade e la ricerca per nome: senza, posizionare una foto
 * vecchia su poligoni muti è indovinare.
 */

import { slugifica } from './dati.js';

const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const GIORNI_VICINI = 30; // quanto cercare avanti e indietro nel diario

const stato = {
  viaggi: null,
  coda: [],
  selezionata: null,
  inAttesa: null, // { voci: [...], coord: [lat, lon] }
  modalitaClick: false
};

const nodo = {
  coda: document.querySelector('[data-coda]'),
  contatore: document.querySelector('[data-contatore]'),
  messaggi: document.querySelector('[data-messaggi]'),
  conferma: document.querySelector('[data-conferma]'),
  cerca: document.querySelector('[data-cerca]'),
  cercaCampo: document.querySelector('[data-cerca-campo]'),
  cercaEsiti: document.querySelector('[data-cerca-esiti]'),
  anteprima: document.querySelector('[data-anteprima]')
};

let mappa;
let livelloMarker;
let markerAttesa;

/* ------------------------------------------------------------------ avvio */

async function leggi(percorso) {
  const risposta = await fetch(percorso, { cache: 'no-store' });
  if (!risposta.ok) throw new Error(`${percorso}: HTTP ${risposta.status}`);
  return risposta.json();
}

async function avvia() {
  let geo;
  try {
    [stato.viaggi, geo] = await Promise.all([leggi('./data/viaggi.json'), leggi('./data/mondo.json')]);
  } catch (errore) {
    annuncia(`Non riesco a leggere i dati: ${errore.message}. Hai avviato tools/editor_server.py?`, true);
    return;
  }

  const stile = getComputedStyle(document.documentElement);
  const token = (nome, ripiego) => stile.getPropertyValue(nome).trim() || ripiego;

  mappa = L.map('mappa', {
    minZoom: 2,
    maxZoom: 19,
    center: [30, 5],
    zoom: 3,
    worldCopyJump: true,
    zoomControl: false // in alto a sinistra ci sta la ricerca
  });
  L.control.zoom({ position: 'bottomleft' }).addTo(mappa);

  // I poligoni danno il colpo d'occhio, le tile danno i nomi: servono
  // entrambi. Le strade entrano da zoom 5, dove i confini non bastano più.
  const strade = L.tileLayer(TILE, {
    attribution: '&copy; OpenStreetMap',
    className: 'strade-editor',
    maxZoom: 19
  });
  L.geoJSON(geo, {
    interactive: false,
    style: {
      color: token('--nebbia', '#7C8B99'),
      weight: 0.6,
      opacity: 0.35,
      fillColor: token('--carta', '#EDE6D6'),
      fillOpacity: 0.12
    }
  }).addTo(mappa);

  function aggiornaStrade() {
    const servono = mappa.getZoom() >= 5;
    if (servono && !mappa.hasLayer(strade)) strade.addTo(mappa);
    else if (!servono && mappa.hasLayer(strade)) strade.remove();
  }
  mappa.on('zoomend', aggiornaStrade);
  aggiornaStrade();

  livelloMarker = L.layerGroup().addTo(mappa);

  mappa.on('click', (evento) => {
    if (!stato.modalitaClick || !stato.selezionata) return;
    proponi([stato.selezionata], [evento.latlng.lat, evento.latlng.lng]);
  });

  collegaTrascinamento();
  collegaRicerca();
  collegaAnteprima();
  document.addEventListener('keydown', tastiera);
  aggiorna();
}

/* ------------------------------------------------------------------ stato */

function aggiorna() {
  stato.coda = [...(stato.viaggi.da_posizionare ?? [])].sort(ordinaPerScatto);
  disegnaCoda();
  disegnaMarker();
}

function ordinaPerScatto(a, b) {
  if (!a.scattata && !b.scattata) return a.file.localeCompare(b.file);
  if (!a.scattata) return 1; // senza data in fondo
  if (!b.scattata) return -1;
  return a.scattata.localeCompare(b.scattata);
}

function giorno(voce) {
  return voce.scattata ? voce.scattata.slice(0, 10) : null;
}

function oraLeggibile(voce) {
  if (!voce.scattata) return '';
  return (voce.scattata.split('T')[1] ?? '').slice(0, 5);
}

function giornoLeggibile(chiave) {
  if (!chiave) return 'senza data';
  const [a, m, g] = chiave.split('-').map(Number);
  const mesi = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${g} ${mesi[m - 1]} ${a}`;
}

/* --------------------------------------------- dove eri, in quei giorni */

/**
 * I luoghi già nel diario vicini nel tempo alla foto. Per uno scatto del 2013
 * spesso non c'è niente, e va bene così: meglio niente che un suggerimento
 * inventato. Quando c'è, è quasi sempre la risposta giusta.
 */
function luoghiVicini(voce) {
  const quando = voce.scattata ? Date.parse(voce.scattata) : null;
  if (!quando) return [];
  const vicini = [];
  for (const paese of stato.viaggi.paesi ?? []) {
    for (const luogo of paese.luoghi ?? []) {
      const da = Date.parse(`${luogo.data}T00:00:00`);
      const a = Date.parse(`${luogo.data_fine ?? luogo.data}T23:59:59`);
      if (Number.isNaN(da)) continue;
      const scarto = quando < da ? da - quando : quando > a ? quando - a : 0;
      const giorni = scarto / 86400000;
      if (giorni <= GIORNI_VICINI) vicini.push({ luogo, paese, giorni });
    }
  }
  return vicini.sort((x, y) => x.giorni - y.giorni).slice(0, 4);
}

/* ------------------------------------------------------------------- coda */

function disegnaCoda() {
  nodo.coda.replaceChildren();
  const quante = stato.coda.length;
  nodo.contatore.textContent = quante === 0
    ? 'niente da posizionare'
    : `${quante} da posizionare`;

  if (!quante) {
    const vuoto = document.createElement('p');
    vuoto.className = 'vuoto';
    vuoto.textContent = 'La coda è vuota. Le foto importate sono tutte sulla mappa.';
    nodo.coda.append(vuoto);
    return;
  }

  // raggruppate per giornata: una giornata sta quasi sempre nello stesso posto,
  // e ragionare su un giorno intero è molto più facile che su una foto sola
  const perGiorno = new Map();
  for (const voce of stato.coda) {
    const chiave = giorno(voce);
    if (!perGiorno.has(chiave)) perGiorno.set(chiave, []);
    perGiorno.get(chiave).push(voce);
  }

  for (const [chiave, voci] of perGiorno) {
    const gruppo = document.createElement('section');
    gruppo.className = 'giornata';

    const testa = document.createElement('h2');
    testa.className = 'giornata__testa';
    testa.append(
      pezzo('span', giornoLeggibile(chiave), 'giornata__data'),
      pezzo('span', `${voci.length}`, 'giornata__quante')
    );
    gruppo.append(testa);

    const vicini = luoghiVicini(voci[0]);
    if (vicini.length) {
      const suggerimenti = document.createElement('p');
      suggerimenti.className = 'giornata__vicini';
      suggerimenti.append(pezzo('span', 'in quei giorni eri a:', 'giornata__vicini-etichetta'));
      for (const { luogo, paese, giorni } of vicini) {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'vicino';
        bottone.textContent = luogo.nome;
        bottone.title = `${luogo.nome}, ${paese.nome} — ${
          giorni === 0 ? 'proprio in quei giorni' : `a ${Math.round(giorni)} giorni di distanza`}`;
        bottone.addEventListener('click', () => {
          mappa.setView(luogo.coord, Math.max(mappa.getZoom(), 11));
          annuncia(`${luogo.nome}: ${bottone.title.split('— ')[1]}. Trascina qui le foto se è il posto giusto.`);
        });
        suggerimenti.append(bottone);
      }
      gruppo.append(suggerimenti);
    }

    const griglia = document.createElement('div');
    griglia.className = 'giornata__foto';
    for (const voce of voci) griglia.append(schedaFoto(voce));
    gruppo.append(griglia);
    nodo.coda.append(gruppo);
  }
  evidenziaScelta();
}

function schedaFoto(voce) {
  const elemento = document.createElement('div');
  elemento.className = 'scheda';
  elemento.draggable = true;
  elemento.dataset.file = voce.file;
  elemento.tabIndex = 0;
  elemento.setAttribute('role', 'button');
  elemento.title = `${voce.originale ?? voce.file} — clic per ingrandire, trascina sulla mappa`;

  const immagine = document.createElement('img');
  immagine.src = `./foto/_da-posizionare/thumb/${voce.file}`;
  immagine.alt = voce.originale ?? voce.file;
  immagine.loading = 'lazy';
  immagine.draggable = false;
  immagine.addEventListener('error', () => immagine.remove());

  const ora = pezzo('span', oraLeggibile(voce), 'scheda__ora');
  elemento.append(immagine, ora);
  if (voce.coord) elemento.append(pezzo('span', 'GPS', 'scheda__gps'));

  // clic = guardala grande (per le foto vecchie è l'unico modo di capire dove
  // sono state scattate); la selezione la fa il trascinamento o Invio
  elemento.addEventListener('click', () => mostraAnteprima(voce));

  elemento.addEventListener('dragstart', (evento) => {
    // NON ridisegnare la coda qui: sostituire i nodi durante il dragstart
    // distrugge l'elemento che si sta trascinando e il browser annulla tutto.
    stato.selezionata = voce;
    stato.modalitaClick = false;
    evidenziaScelta();
    evento.dataTransfer.setData('text/plain', voce.file);
    evento.dataTransfer.effectAllowed = 'move';
  });

  return elemento;
}

/** Aggiorna le classi senza ricostruire il DOM: il drag non sopravvive a un rebuild. */
function evidenziaScelta() {
  for (const scheda of nodo.coda.querySelectorAll('.scheda')) {
    scheda.classList.toggle('scheda--scelta', scheda.dataset.file === stato.selezionata?.file);
  }
}

/* -------------------------------------------------------- anteprima grande */

function mostraAnteprima(voce) {
  const immagine = nodo.anteprima.querySelector('img');
  const didascalia = nodo.anteprima.querySelector('[data-anteprima-testo]');
  immagine.src = `./foto/_da-posizionare/${voce.file}`;
  immagine.alt = voce.originale ?? voce.file;
  didascalia.textContent = `${voce.originale ?? voce.file} — ${giornoLeggibile(giorno(voce))} ${oraLeggibile(voce)}`;
  nodo.anteprima.hidden = false;
  nodo.anteprima.querySelector('[data-anteprima-chiudi]').focus();
}

function collegaAnteprima() {
  const chiudi = () => { nodo.anteprima.hidden = true; };
  nodo.anteprima.querySelector('[data-anteprima-chiudi]').addEventListener('click', chiudi);
  nodo.anteprima.addEventListener('click', (evento) => {
    if (evento.target === nodo.anteprima) chiudi();
  });
}

/* ---------------------------------------------------------------- ricerca */

function collegaRicerca() {
  let ultimaRicerca = 0;

  async function cerca() {
    const testo = nodo.cercaCampo.value.trim();
    if (!testo) return;
    const mia = ++ultimaRicerca;
    nodo.cercaEsiti.replaceChildren(pezzo('li', 'cerco…', 'cerca__attesa'));
    let risposta;
    try {
      risposta = await (await fetch(`./cerca?q=${encodeURIComponent(testo)}`)).json();
    } catch (errore) {
      nodo.cercaEsiti.replaceChildren(pezzo('li', `ricerca fallita: ${errore.message}`, 'cerca__attesa'));
      return;
    }
    if (mia !== ultimaRicerca) return; // è arrivata una ricerca più recente

    nodo.cercaEsiti.replaceChildren();
    const posti = risposta.posti ?? [];
    if (!posti.length) {
      nodo.cercaEsiti.append(pezzo('li', 'niente. Prova con più contesto ("Lisbon, Portugal").', 'cerca__attesa'));
      return;
    }
    for (const posto of posti) {
      const voce = document.createElement('li');
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = 'cerca__esito';
      bottone.append(
        pezzo('span', posto.nome, 'cerca__nome'),
        pezzo('span', posto.etichetta, 'cerca__dettaglio')
      );
      bottone.addEventListener('click', () => {
        mappa.setView(posto.coord, 13);
        nodo.cercaEsiti.replaceChildren();
        nodo.cercaCampo.value = '';
      });
      voce.append(bottone);
      nodo.cercaEsiti.append(voce);
    }
  }

  nodo.cercaCampo.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      cerca();
    } else if (evento.key === 'Escape') {
      nodo.cercaEsiti.replaceChildren();
      nodo.cercaCampo.value = '';
    }
  });
  nodo.cerca.querySelector('[data-cerca-vai]').addEventListener('click', cerca);
}

/* ---------------------------------------------------------------- tastiera */

function tastiera(evento) {
  if (evento.key === 'Escape') {
    if (!nodo.anteprima.hidden) {
      nodo.anteprima.hidden = true;
      return;
    }
    annullaProposta();
    stato.modalitaClick = false;
    aggiornaSuggerimento();
    return;
  }
  if (evento.key !== 'Enter') return;
  const attivo = document.activeElement;
  if (!attivo?.classList.contains('scheda')) return;
  const voce = stato.coda.find((v) => v.file === attivo.dataset.file);
  if (!voce) return;
  evento.preventDefault();
  stato.selezionata = voce;
  stato.modalitaClick = true;
  evidenziaScelta();
  aggiornaSuggerimento();
}

function aggiornaSuggerimento() {
  document.body.classList.toggle('in-posizionamento', stato.modalitaClick);
  if (stato.modalitaClick) {
    annuncia('Clicca sulla mappa il punto dove è stata scattata. Esc annulla.');
  }
}

/* ------------------------------------------------------------ trascinamento */

function collegaTrascinamento() {
  const contenitore = document.getElementById('mappa');
  contenitore.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'move';
  });
  contenitore.addEventListener('drop', (evento) => {
    evento.preventDefault();
    const file = evento.dataTransfer.getData('text/plain');
    const voce = stato.coda.find((v) => v.file === file);
    if (!voce) return;
    const rettangolo = contenitore.getBoundingClientRect();
    const punto = L.point(evento.clientX - rettangolo.left, evento.clientY - rettangolo.top);
    const posizione = mappa.containerPointToLatLng(punto);
    proponi([voce], [posizione.lat, posizione.lng]);
  });
}

/* ------------------------------------------------------------- proposta */

function proponi(voci, coord) {
  annullaProposta();
  stato.inAttesa = { voci, coord };
  stato.modalitaClick = false;
  aggiornaSuggerimento();

  markerAttesa = L.marker(coord, {
    draggable: true,
    icon: iconaFoto(voci[0], 'in-attesa')
  }).addTo(mappa);
  markerAttesa.on('dragend', () => {
    const posizione = markerAttesa.getLatLng();
    stato.inAttesa.coord = [posizione.lat, posizione.lng];
    disegnaConferma();
  });

  disegnaConferma();
}

function disegnaConferma() {
  const { voci, coord } = stato.inAttesa;
  const stessoGiorno = compagneDiGiornata(voci[0]);

  nodo.conferma.hidden = false;
  nodo.conferma.replaceChildren();

  const testo = document.createElement('p');
  testo.className = 'conferma__testo';
  testo.append(
    pezzo('b', voci.length === 1 ? (voci[0].originale ?? voci[0].file) : `${voci.length} foto`),
    pezzo('span', `${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}`, 'mono'),
    pezzo('span', 'Trascina il marker per correggere il punto.', 'conferma__nota')
  );
  nodo.conferma.append(testo);

  if (stessoGiorno.length && voci.length === 1) {
    const etichetta = document.createElement('label');
    etichetta.className = 'conferma__insieme';
    const spunta = document.createElement('input');
    spunta.type = 'checkbox';
    spunta.dataset.insieme = '';
    spunta.checked = true;
    etichetta.append(spunta, document.createTextNode(
      ` posiziona qui anche le altre ${stessoGiorno.length} del ${giornoLeggibile(giorno(voci[0]))}`));
    nodo.conferma.append(etichetta);
  }

  const azioni = document.createElement('div');
  azioni.className = 'conferma__azioni';

  const conferma = document.createElement('button');
  conferma.type = 'button';
  conferma.className = 'bottone bottone--primario';
  conferma.textContent = 'Posiziona';
  conferma.addEventListener('click', () => {
    const insieme = nodo.conferma.querySelector('[data-insieme]');
    const tutte = insieme?.checked ? [...voci, ...compagneDiGiornata(voci[0])] : voci;
    salva(tutte.map((voce) => ({ tipo: 'posiziona', file: voce.file, coord: stato.inAttesa.coord })));
  });

  const annulla = document.createElement('button');
  annulla.type = 'button';
  annulla.className = 'bottone';
  annulla.textContent = 'Annulla';
  annulla.addEventListener('click', annullaProposta);

  azioni.append(conferma, annulla);
  nodo.conferma.append(azioni);
  conferma.focus();
}

function compagneDiGiornata(voce) {
  const quando = giorno(voce);
  if (!quando) return [];
  return stato.coda.filter((altra) => altra.file !== voce.file && giorno(altra) === quando);
}

function annullaProposta() {
  if (markerAttesa) {
    markerAttesa.remove();
    markerAttesa = null;
  }
  stato.inAttesa = null;
  nodo.conferma.hidden = true;
  nodo.conferma.replaceChildren();
}

/* -------------------------------------------------------------- marker */

function iconaFoto(voce, variante) {
  const sorgente = voce.file
    ? `./foto/_da-posizionare/thumb/${voce.file}`
    : voce.src;
  return L.divIcon({
    className: `foto-marker foto-marker--${variante}`,
    html: `<img src="${sorgente}" alt="" width="48" height="48">`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
}

function disegnaMarker() {
  livelloMarker.clearLayers();

  for (const paese of stato.viaggi.paesi ?? []) {
    for (const luogo of paese.luoghi ?? []) {
      const cartella = `./foto/${slugifica(paese.nome)}/${luogo.slug}`;

      L.circleMarker(luogo.coord, {
        radius: 5,
        color: '#C6402F',
        weight: 2,
        fillOpacity: 0.6
      })
        .bindTooltip(`${luogo.nome} — ${luogo.data}`, { direction: 'top' })
        .addTo(livelloMarker);

      for (const foto of luogo.foto ?? []) {
        if (!foto.coord) continue;
        const marker = L.marker(foto.coord, {
          draggable: true,
          icon: iconaFoto({ src: `${cartella}/thumb/${foto.file}` }, 'posizionata')
        }).addTo(livelloMarker);
        marker.bindTooltip(`${luogo.nome} / ${foto.file} — trascina per correggere`, {
          direction: 'top'
        });
        marker.on('dragend', () => {
          const posizione = marker.getLatLng();
          salva([
            {
              tipo: 'sposta',
              paese_id: paese.id,
              luogo: luogo.slug,
              file: foto.file,
              coord: [posizione.lat, posizione.lng]
            }
          ]);
        });
      }
    }
  }
}

/* ----------------------------------------------------------- salvataggio */

async function salva(operazioni) {
  if (!operazioni.length) return;
  annuncia('Salvo…');
  document.body.classList.add('occupato');

  let risposta;
  try {
    const chiamata = await fetch('./salva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operazioni })
    });
    risposta = await chiamata.json();
  } catch (errore) {
    document.body.classList.remove('occupato');
    annuncia(`Salvataggio fallito: ${errore.message}. Il server locale è ancora acceso?`, true);
    return;
  }

  document.body.classList.remove('occupato');
  annullaProposta();

  // lo stato si rilegge dal file appena scritto, non dalla memoria
  try {
    stato.viaggi = await leggi('./data/viaggi.json');
  } catch (errore) {
    annuncia(`Salvato, ma non riesco a rileggere viaggi.json: ${errore.message}`, true);
    return;
  }
  stato.selezionata = null;
  aggiorna();

  const errori = risposta.errori ?? [];
  const fatti = risposta.fatti ?? [];
  if (errori.length) annuncia(errori.join(' · '), true);
  else if (fatti.length) annuncia(fatti.join(' · '));
  else annuncia('Niente da salvare.');
}

function annuncia(testo, errore = false) {
  nodo.messaggi.textContent = testo;
  nodo.messaggi.classList.toggle('messaggi--errore', errore);
}

function pezzo(tag, testo, classe) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  elemento.textContent = testo;
  return elemento;
}

avvia();
