/**
 * Editor di posizionamento — gira solo in locale, con tools/editor_server.py.
 *
 * La coda a sinistra sono le foto che l'import non è riuscito a collocare.
 * Si trascina la foto sul punto della mappa; al rilascio compare un marker con
 * la miniatura e si conferma. Ogni salvataggio riscrive viaggi.json e lo stato
 * viene riletto dal file: niente stato solo-in-memoria da perdere.
 */

import { slugifica } from './dati.js';

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
  conferma: document.querySelector('[data-conferma]')
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
    maxZoom: 18,
    center: [30, 5],
    zoom: 3,
    worldCopyJump: true,
    attributionControl: false
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

  livelloMarker = L.layerGroup().addTo(mappa);

  mappa.on('click', (evento) => {
    if (!stato.modalitaClick || !stato.selezionata) return;
    proponi([stato.selezionata], [evento.latlng.lat, evento.latlng.lng]);
  });

  collegaTrascinamento();
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

function dataLeggibile(voce) {
  if (!voce.scattata) return 'senza data';
  const [data, ora] = voce.scattata.split('T');
  return `${data} ${(ora ?? '').slice(0, 5)}`.trim();
}

/* ------------------------------------------------------------------- coda */

function disegnaCoda() {
  nodo.coda.replaceChildren();
  const quante = stato.coda.length;
  nodo.contatore.textContent = quante === 0
    ? 'niente da posizionare'
    : `${quante} ${quante === 1 ? 'foto' : 'foto'} da posizionare`;

  if (!quante) {
    const vuoto = document.createElement('p');
    vuoto.className = 'vuoto';
    vuoto.textContent = 'La coda è vuota. Le foto importate sono tutte sulla mappa.';
    nodo.coda.append(vuoto);
    return;
  }

  for (const voce of stato.coda) {
    const elemento = document.createElement('button');
    elemento.type = 'button';
    elemento.className = 'scheda';
    elemento.draggable = true;
    elemento.dataset.file = voce.file;
    elemento.setAttribute('aria-pressed', String(stato.selezionata?.file === voce.file));
    if (stato.selezionata?.file === voce.file) elemento.classList.add('scheda--scelta');

    const immagine = document.createElement('img');
    immagine.src = `./foto/_da-posizionare/thumb/${voce.file}`;
    immagine.alt = voce.originale ?? voce.file;
    immagine.width = 96;
    immagine.height = 72;
    immagine.loading = 'lazy';
    immagine.draggable = false;
    immagine.addEventListener('error', () => immagine.remove());

    const testo = document.createElement('span');
    testo.className = 'scheda__testo';
    testo.innerHTML =
      `<b>${voce.originale ?? voce.file}</b>` +
      `<span class="scheda__data">${dataLeggibile(voce)}</span>` +
      (voce.coord ? '<span class="scheda__nota">ha il GPS, paese non riconosciuto</span>' : '');

    elemento.append(immagine, testo);
    elemento.addEventListener('click', () => scegli(voce));
    elemento.addEventListener('dragstart', (evento) => {
      scegli(voce);
      evento.dataTransfer.setData('text/plain', voce.file);
      evento.dataTransfer.effectAllowed = 'move';
    });
    nodo.coda.append(elemento);
  }
}

function scegli(voce) {
  stato.selezionata = stato.selezionata?.file === voce.file ? null : voce;
  stato.modalitaClick = false;
  disegnaCoda();
  if (stato.selezionata?.coord) {
    mappa.setView(stato.selezionata.coord, Math.max(mappa.getZoom(), 9));
  }
}

/* ---------------------------------------------------------------- tastiera */

function tastiera(evento) {
  if (evento.key === 'Escape') {
    annullaProposta();
    stato.modalitaClick = false;
    aggiornaSuggerimento();
    return;
  }
  if (evento.key !== 'Enter') return;
  if (document.activeElement?.classList.contains('scheda')) {
    const file = document.activeElement.dataset.file;
    const voce = stato.coda.find((v) => v.file === file);
    if (!voce) return;
    evento.preventDefault();
    stato.selezionata = voce;
    stato.modalitaClick = true;
    disegnaCoda();
    aggiornaSuggerimento();
  }
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
  testo.innerHTML =
    `<b>${voci.length === 1 ? (voci[0].originale ?? voci[0].file) : `${voci.length} foto`}</b>` +
    `<span class="mono">${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}</span>` +
    `<span class="conferma__nota">Trascina il marker per correggere il punto.</span>`;
  nodo.conferma.append(testo);

  if (stessoGiorno.length && voci.length === 1) {
    const etichetta = document.createElement('label');
    etichetta.className = 'conferma__insieme';
    etichetta.innerHTML =
      `<input type="checkbox" data-insieme checked> posiziona qui anche le altre ` +
      `${stessoGiorno.length} foto del ${giorno(voci[0])}`;
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

avvia();
