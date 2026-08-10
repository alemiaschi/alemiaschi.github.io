/**
 * Mappa Leaflet: layer dei paesi, marker dei luoghi, scia, soglie di zoom.
 *
 * Nessuna tile di sfondo: poligoni disegnati su fondo scuro. La granularità
 * cambia con lo zoom e non ci sono controlli da smanettare.
 */

import { formattaData } from './dati.js';

/* Soglie di dettaglio (§6). L'isteresi evita lo sfarfallio quando lo zoom si
   ferma esattamente sul confine fra due livelli. */
const LIVELLI = [
  { nome: 'paesi', da: 0 },
  { nome: 'luoghi', da: 4 },
  { nome: 'punti', da: 9 },
  { nome: 'foto', da: 13 }
];
const ISTERESI = 0.35;

/* Il mondo intero, in Mercator. Serve sia come limite di pan sia per calcolare
   lo zoom minimo con cui la mappa riempie la finestra. */
const LIMITI_MONDO = L.latLngBounds([[-85, -180], [85, 180]]);

/* Le vie compaiono solo quando compaiono le foto (§7). È l'unica dipendenza di
   rete del sito: se il server tace, resta la mappa disegnata e basta. */
const TILE_STRADE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUZIONE = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/* Quattro gradini di riempimento, non un gradiente continuo. */
const GRADINI = [1, 2, 3, 5];
const OPACITA_LONTANO = [0.4, 0.54, 0.68, 0.84];
// da vicino il paese è solo una velatura: le foto sono l'unica cosa che deve
// risaltare, e a zoom alto il poligono occupa tutto lo schermo
const OPACITA_VICINO = [0.07, 0.1, 0.13, 0.17];

/**
 * Leaflet scrive i colori come attributi di presentazione SVG, dove `var(--x)`
 * non viene risolto da nessun browser: i token vanno letti qui e passati come
 * valori. Il CSS resta l'unica definizione, questa è solo una lettura.
 */
function leggiTavolozza() {
  const stile = getComputedStyle(document.documentElement);
  const prendi = (nome, ripiego) => stile.getPropertyValue(nome).trim() || ripiego;
  return {
    abisso: prendi('--abisso', '#0B1D2A'),
    carta: prendi('--carta', '#EDE6D6'),
    ottone: prendi('--ottone', '#C89B3C'),
    ottoneChiaro: prendi('--ottone-chiaro', '#E8C46A'),
    segnale: prendi('--segnale', '#C6402F'),
    nebbia: prendi('--nebbia', '#7C8B99')
  };
}

function gradino(numeroLuoghi) {
  let indice = 0;
  for (let i = 0; i < GRADINI.length; i++) {
    if (numeroLuoghi >= GRADINI[i]) indice = i;
  }
  return indice;
}

function anniCoperti(luoghi) {
  if (!luoghi.length) return '';
  const anni = luoghi.map((l) => l.tempo.anno);
  const primo = Math.min(...anni);
  const ultimo = Math.max(...anni);
  return primo === ultimo ? `${primo}` : `${primo}–${ultimo}`;
}

export function creaMappa({ elemento, stato, geo }) {
  const tavolozza = leggiTavolozza();

  const mappa = L.map(elemento, {
    minZoom: 1,
    maxZoom: 18,
    zoom: 2,
    center: [25, 10],
    maxBounds: LIMITI_MONDO,
    maxBoundsViscosity: 1,
    // l'attribuzione compare da sola quando entrano le tile stradali (§7)
    attributionControl: true,
    zoomControl: false,
    // il rendering SVG serve: i paesi devono essere elementi focalizzabili
    preferCanvas: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(mappa);
  mappa.attributionControl.setPrefix(false); // niente "Leaflet", solo la fonte dei dati

  /**
   * Lo zoom minimo dipende dalla finestra: sotto una certa soglia il mondo non
   * riempie più il viewport e restano bande vuote ai lati, che su un fondo del
   * colore del mare sembrano una mappa tagliata. `getBoundsZoom(…, true)` dà il
   * primo zoom in cui il mondo copre la vista.
   */
  function adattaZoomMinimo() {
    const minimo = mappa.getBoundsZoom(LIMITI_MONDO, true);
    if (minimo === mappa.getMinZoom()) return;
    mappa.setMinZoom(minimo);
    if (mappa.getZoom() < minimo) mappa.setZoom(minimo);
  }

  adattaZoomMinimo();
  mappa.on('resize', adattaZoomMinimo);

  mappa.createPane('terre').style.zIndex = 200;
  mappa.createPane('visitati').style.zIndex = 300;
  mappa.createPane('scia').style.zIndex = 350;
  mappa.createPane('punti').style.zIndex = 380;
  mappa.createPane('luoghi').style.zIndex = 400;
  mappa.getPane('terre').style.pointerEvents = 'none';
  mappa.getPane('scia').style.pointerEvents = 'none';

  /* ---------------------------------------------------- layer di sfondo */

  const visitati = new Set(stato.dati.paesi.map((p) => p.id));

  L.geoJSON(geo, {
    pane: 'terre',
    interactive: false,
    style: {
      color: tavolozza.nebbia,
      weight: 0.6,
      opacity: 0.35,
      fillColor: tavolozza.carta,
      fillOpacity: 0.12
    }
  }).addTo(mappa);

  /* ------------------------------------------------- layer dei visitati */

  const forme = new Map(); // id paese → layer
  const geometriePerId = new Map(geo.features.map((f) => [f.id, f]));
  const senzaGeometria = [];

  // in ordine cronologico: è anche l'ordine in cui il Tab li percorre
  for (const paese of stato.dati.paesiCronologici) {
    const feature = geometriePerId.get(paese.id);
    if (!feature) {
      senzaGeometria.push(paese);
      continue;
    }
    const forma = L.geoJSON(feature, {
      pane: 'visitati',
      style: {
        color: tavolozza.ottoneChiaro,
        weight: 1,
        opacity: 0.7,
        fillColor: tavolozza.ottone
      },
      className: 'paese'
    }).addTo(mappa);

    forma.paese = paese;
    forme.set(paese.id, forma);

    forma.on('click', (evento) => {
      L.DomEvent.stop(evento);
      stato.apriPaese(paese);
    });
    forma.on('mouseover', () => forma.setStyle({ weight: 1.6, opacity: 1 }));
    forma.on('mouseout', () => forma.setStyle({ weight: 1, opacity: 0.7 }));

    rendiFocalizzabile(forma, paese, stato);
  }

  if (senzaGeometria.length) {
    console.warn(
      `These countries have no geometry in mondo.json and will not appear on the map: ` +
        senzaGeometria.map((p) => `${p.nome} (id ${p.id})`).join(', ') +
        `. Check that "id" is the ISO 3166-1 numeric code.`
    );
  }

  /* ------------------------------------------- luoghi, punti, foto, scia */

  const livelloLuoghi = L.layerGroup([], { pane: 'luoghi' }).addTo(mappa);
  const livelloPunti = L.layerGroup([], { pane: 'punti' }).addTo(mappa);
  const livelloFoto = L.layerGroup([], { pane: 'luoghi' }).addTo(mappa);
  const markerPerLuogo = new Map();

  /* -------------------------------------------------------- tile stradali */

  const strade = L.tileLayer(TILE_STRADE, {
    attribution: ATTRIBUZIONE,
    className: 'strade',
    maxZoom: 19,
    crossOrigin: true
  });

  function aggiornaStrade() {
    const servono = livello === 'foto';
    if (servono && !mappa.hasLayer(strade)) strade.addTo(mappa);
    else if (!servono && mappa.hasLayer(strade)) strade.remove();
    elemento.classList.toggle('mappa--con-strade', servono);
  }

  /* ---------------------------------------------------------------- scia */

  let scia = null;
  let sciaDaAnimare = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * La scia ha senso quando il tempo è in gioco: durante la riproduzione e
   * quando la timeline sta filtrando un periodo. A riposo la mappa è un atlante,
   * non un grafo: le linee fra un continente e l'altro non dicono niente.
   */
  function sciaVisibile() {
    return stato.inRiproduzione || Boolean(stato.intervallo);
  }

  function ridisegnaScia(luoghi) {
    if (scia) {
      scia.remove();
      scia = null;
    }
    if (!sciaVisibile()) return;
    if (luoghi.length < 2) return;
    scia = L.polyline(luoghi.map((l) => l.coord), {
      pane: 'scia',
      className: 'scia',
      color: tavolozza.segnale,
      weight: 1.5,
      opacity: 0.55,
      dashArray: '6 7',
      interactive: false,
      lineJoin: 'round'
    }).addTo(mappa);

    // Si disegna progressivamente al primo caricamento. Durante la riproduzione
    // non serve: la scia cresce già da sola, tappa dopo tappa.
    if (sciaDaAnimare && !stato.inRiproduzione) {
      sciaDaAnimare = false;
      disegnaProgressivamente(scia.getElement());
    }
  }

  function ridisegnaLuoghi(luoghi) {
    livelloLuoghi.clearLayers();
    livelloPunti.clearLayers();
    livelloFoto.clearLayers();
    markerPerLuogo.clear();
    if (livello === 'paesi') return;

    for (const luogo of luoghi) {
      const marker = L.circleMarker(luogo.coord, {
        pane: 'luoghi',
        className: 'luogo',
        radius: 6,
        color: tavolozza.segnale,
        weight: 2,
        opacity: 1,
        fillColor: tavolozza.segnale,
        fillOpacity: 0.35
      });
      marker.bindTooltip(luogo.nome, {
        permanent: true,
        direction: 'right',
        offset: [8, 0],
        className: 'etichetta etichetta--luogo'
      });
      marker.on('click', (evento) => {
        L.DomEvent.stop(evento);
        stato.apriLuogo(luogo);
      });
      marker.addTo(livelloLuoghi);
      markerPerLuogo.set(luogo, marker);

      if (livello === 'punti' || livello === 'foto') {
        for (const punto of luogo.punti) {
          L.circleMarker(punto.coord, {
            pane: 'punti',
            className: 'punto',
            radius: 3,
            color: tavolozza.ottoneChiaro,
            weight: 1.5,
            opacity: 0.9,
            fillColor: tavolozza.ottoneChiaro,
            fillOpacity: 0.5,
            interactive: false
          })
            .bindTooltip(punto.nome, {
              permanent: true,
              direction: 'right',
              offset: [6, 0],
              className: 'etichetta etichetta--punto'
            })
            .addTo(livelloPunti);
        }
      }

      if (livello === 'foto') {
        for (const foto of luogo.foto) {
          if (!foto.coord) continue;
          const immagine = L.marker(foto.coord, {
            pane: 'luoghi',
            icon: L.divIcon({
              className: 'foto-marker',
              html: `<img src="${foto.thumb}" alt="${testoSicuro(foto.didascalia || luogo.nome)}" width="56" height="56" loading="lazy">`,
              iconSize: [56, 56],
              iconAnchor: [28, 28]
            }),
            keyboard: true,
            alt: foto.didascalia || luogo.nome,
            riseOnHover: true
          });
          immagine.on('click', (evento) => {
            L.DomEvent.stop(evento);
            stato.emetti('foto', { luogo, foto, indice: luogo.foto.indexOf(foto) });
          });
          immagine.on('add', () => {
            // se il file manca, il marker sparisce: niente icona rotta sulla mappa
            const nodoImmagine = immagine.getElement()?.querySelector('img');
            nodoImmagine?.addEventListener('error', () => immagine.remove());
          });
          immagine.addTo(livelloFoto);
        }
      }
    }
  }

  /* -------------------------------------------------------- dettaglio */

  let livello = livelloPerZoom(mappa.getZoom(), null);
  elemento.dataset.dettaglio = livello;

  mappa.on('zoomend', () => {
    const nuovo = livelloPerZoom(mappa.getZoom(), livello);
    if (nuovo === livello) return;
    livello = nuovo;
    elemento.dataset.dettaglio = livello;
    aggiornaStrade();
    stato.emetti('dettaglio', { livello, zoom: mappa.getZoom() });
    ridipingi();
  });

  /* ----------------------------------------------------- ridisegno */

  function ridipingi() {
    const visibili = stato.luoghiVisibili;
    const perPaese = stato.paesiVisibili;
    const vicino = livello !== 'paesi';

    ridisegnaScia(visibili);
    ridisegnaLuoghi(visibili);
    evidenzia();

    const suStrade = livello === 'foto';

    for (const [id, forma] of forme) {
      const luoghi = perPaese.get(id) ?? [];
      const scala = vicino ? OPACITA_VICINO : OPACITA_LONTANO;
      forma.setStyle({
        // sopra la mappa stradale la velatura d'ottone sporcherebbe le vie
        fillOpacity: suStrade || !luoghi.length ? 0 : scala[gradino(luoghi.length)],
        opacity: luoghi.length ? (vicino ? 0.35 : 0.7) : 0.12,
        weight: luoghi.length ? 1 : 0.6
      });

      const elementoForma = elementoDi(forma);
      if (elementoForma) {
        elementoForma.classList.toggle('paese--spento', luoghi.length === 0);
        elementoForma.setAttribute('tabindex', luoghi.length ? '0' : '-1');
      }

      const paese = forma.paese;
      forma.unbindTooltip();
      if (luoghi.length) {
        const quanti = `${luoghi.length} ${luoghi.length === 1 ? 'place' : 'places'}`;
        forma.bindTooltip(
          `<b>${paese.nome}</b><span class="etichetta__dati">${quanti} · ${anniCoperti(luoghi)}</span>`,
          { className: 'etichetta etichetta--paese', sticky: true, direction: 'top' }
        );
      }
    }
  }

  /* ------------------------------------------------------- selezione */

  function evidenzia() {
    for (const [id, forma] of forme) {
      const attivo = stato.paeseAttivo?.id === id;
      const elementoForma = elementoDi(forma);
      if (elementoForma) elementoForma.classList.toggle('paese--attivo', attivo);
    }
    for (const [luogo, marker] of markerPerLuogo) {
      const attivo = stato.luogoAttivo === luogo;
      marker.getElement()?.classList.toggle('luogo--attivo', attivo);
      marker.setStyle({ radius: attivo ? 8 : 6, fillOpacity: attivo ? 0.85 : 0.35 });
    }
  }

  stato.on('selezione', ({ luogo, paese }) => {
    evidenzia();
    if (luogo) volaSuLuogo(luogo);
    else if (paese) inquadraPaese(paese);
  });

  /* "Segui la scia": durante la riproduzione la mappa vola sul luogo appena
     comparso, poi allarga per tenere dentro tutto il percorso finora. */
  let allargaFraPoco = null;

  function segui(visibili) {
    const ultimo = visibili.at(-1);
    if (!ultimo) return;
    clearTimeout(allargaFraPoco);
    mappa.flyTo(ultimo.coord, Math.max(mappa.getZoom(), 5), { duration: 0.8 });
    allargaFraPoco = setTimeout(() => {
      if (!stato.inRiproduzione || visibili.length < 2) return;
      mappa.flyToBounds(L.latLngBounds(visibili.map((l) => l.coord)), {
        ...bordi(),
        maxZoom: 6,
        duration: 1
      });
    }, 1100);
  }

  stato.on('intervallo', () => {
    ridipingi();
    if (stato.inRiproduzione && stato.seguiScia) segui(stato.luoghiVisibili);
  });

  stato.on('riproduzione-finita', () => {
    clearTimeout(allargaFraPoco);
    if (stato.seguiScia) inquadraTutto();
  });

  function bordi() {
    const intestazione = document.querySelector('.intestazione');
    const pannello = document.querySelector('[data-pannello]');
    const altezzaIntestazione = intestazione ? intestazione.offsetHeight : 0;
    const largo = window.innerWidth > 720 && pannello && !pannello.hidden ? pannello.offsetWidth : 0;
    const alto = window.innerWidth > 720 ? altezzaIntestazione : altezzaIntestazione + 120;
    return {
      paddingTopLeft: L.point(largo + 24, alto + 16),
      paddingBottomRight: L.point(24, 24)
    };
  }

  function inquadraPaese(paese) {
    const forma = forme.get(paese.id);
    const opzioni = { ...bordi(), maxZoom: 7, animate: true };
    if (forma) {
      mappa.fitBounds(forma.getBounds(), opzioni);
    } else if (paese.luoghi.length) {
      mappa.fitBounds(L.latLngBounds(paese.luoghi.map((l) => l.coord)), opzioni);
    }
  }

  function volaSuLuogo(luogo) {
    const zoom = Math.max(mappa.getZoom(), 11);
    // flyTo non conosce il padding di fitBounds: il centro va spostato a mano,
    // altrimenti il luogo finisce sotto il pannello.
    const spazio = bordi();
    const scarto = spazio.paddingTopLeft.x - spazio.paddingBottomRight.x;
    const punto = mappa.project(luogo.coord, zoom).subtract(L.point(scarto / 2, 0));
    mappa.flyTo(mappa.unproject(punto, zoom), zoom, { duration: 0.9 });
  }

  /* ------------------------------------------------------------ avvio */

  aggiornaStrade();
  ridipingi();

  /** Vista iniziale: tutto il percorso. La chiama app.js solo se il deep link
      non ha già scelto un luogo, altrimenti le due animazioni si accavallano. */
  function inquadraTutto(opzioni = {}) {
    const tutte = stato.luoghiVisibili;
    if (!tutte.length) return;
    mappa.fitBounds(L.latLngBounds(tutte.map((l) => l.coord)), {
      ...bordi(),
      maxZoom: 5,
      ...opzioni
    });
  }

  /* ---------------------------------------------------------- poster §9.7 */

  /**
   * Ricostruisce la vista corrente come SVG autonomo: niente interfaccia, solo
   * mare, terre, paesi visitati, scia e tappe. Non si serializza l'SVG di
   * Leaflet perché è pieno di trasformazioni e classi che fuori dalla pagina
   * non vogliono dire niente.
   */
  function costruisciPoster() {
    const dimensione = mappa.getSize();
    const larghezza = dimensione.x;
    const altezza = dimensione.y;
    const visibili = stato.luoghiVisibili;
    const perPaese = stato.paesiVisibili;

    const punto = (coord) => {
      const p = mappa.latLngToContainerPoint(coord);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    };

    const tracciato = (geometria) => {
      const poligoni = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
      let d = '';
      for (const poligono of poligoni) {
        for (const anello of poligono) {
          d += `M${anello.map(([lon, lat]) => punto([lat, lon])).join('L')}Z`;
        }
      }
      return d;
    };

    const pezzi = [];
    pezzi.push(`<rect width="${larghezza}" height="${altezza}" fill="${tavolozza.abisso}"/>`);

    for (const feature of geo.features) {
      const luoghiPaese = perPaese.get(feature.id) ?? [];
      const riempimento = luoghiPaese.length ? tavolozza.ottone : tavolozza.carta;
      const opacita = luoghiPaese.length ? OPACITA_LONTANO[gradino(luoghiPaese.length)] : 0.12;
      pezzi.push(
        `<path d="${tracciato(feature.geometry)}" fill="${riempimento}" fill-opacity="${opacita}"` +
          ` stroke="${luoghiPaese.length ? tavolozza.ottoneChiaro : tavolozza.nebbia}"` +
          ` stroke-width="${luoghiPaese.length ? 1 : 0.5}" stroke-opacity="0.5"/>`
      );
    }

    if (visibili.length > 1) {
      pezzi.push(
        `<polyline points="${visibili.map((l) => punto(l.coord)).join(' ')}" fill="none"` +
          ` stroke="${tavolozza.segnale}" stroke-width="1.5" stroke-dasharray="6 7"` +
          ` stroke-linejoin="round" stroke-opacity="0.85"/>`
      );
    }

    // Le etichette che si sovrapporrebbero non si scrivono: su un foglio da
    // stampare due nomi accavallati sono peggio di un nome mancante.
    const occupato = [];
    const libero = (x, y, larghezzaTesto) => {
      const scatola = { x, y: y - 10, x2: x + larghezzaTesto, y2: y + 4 };
      const sovrapposto = occupato.some(
        (altro) => scatola.x < altro.x2 && scatola.x2 > altro.x && scatola.y < altro.y2 && scatola.y2 > altro.y
      );
      if (!sovrapposto) occupato.push(scatola);
      return !sovrapposto;
    };

    for (const luogo of visibili) {
      const [x, y] = punto(luogo.coord).split(',').map(Number);
      pezzi.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="${tavolozza.segnale}"/>`);
      if (libero(x + 7, y + 4, luogo.nome.length * 6.2)) {
        pezzi.push(
          `<text x="${x + 7}" y="${y + 4}" fill="${tavolozza.carta}"` +
            ` font-family="Georgia, serif" font-size="12">${testoSicuro(luogo.nome)}</text>`
        );
      }
    }

    const titolo = stato.dati.meta.titolo || 'Waypoints';
    pezzi.push(
      `<text x="24" y="40" fill="${tavolozza.carta}" font-family="Georgia, serif"` +
        ` font-size="24">${testoSicuro(titolo)}</text>`
    );

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${larghezza}" height="${altezza}" viewBox="0 0 ${larghezza} ${altezza}">${pezzi.join('')}</svg>`;
  }

  function scarica(contenuto, nome, tipo) {
    const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
    const collegamento = document.createElement('a');
    collegamento.href = url;
    collegamento.download = nome;
    collegamento.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function esportaPoster() {
    const svg = costruisciPoster();
    const base = `diario-${new Date().toISOString().slice(0, 10)}`;
    scarica(svg, `${base}.svg`, 'image/svg+xml');

    // stessa immagine rasterizzata, per chi deve solo stamparla
    const dimensione = mappa.getSize();
    const scala = 2;
    const tela = document.createElement('canvas');
    tela.width = dimensione.x * scala;
    tela.height = dimensione.y * scala;
    const contesto = tela.getContext('2d');
    const immagine = new Image();
    immagine.onload = () => {
      contesto.scale(scala, scala);
      contesto.drawImage(immagine, 0, 0);
      tela.toBlob((blob) => {
        if (blob) scarica(blob, `${base}.png`, 'image/png');
      }, 'image/png');
    };
    immagine.onerror = () => console.warn('Poster: the PNG could not be generated; the SVG is still there.');
    immagine.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const controlloPoster = L.control({ position: 'bottomright' });
  controlloPoster.onAdd = () => {
    const contenitore = L.DomUtil.create('div', 'leaflet-bar poster-controllo');
    const bottone = L.DomUtil.create('a', '', contenitore);
    bottone.href = '#';
    bottone.title = 'Export this view as a poster (SVG and PNG)';
    bottone.setAttribute('role', 'button');
    bottone.textContent = '⤓';
    L.DomEvent.on(bottone, 'click', (evento) => {
      L.DomEvent.stop(evento);
      esportaPoster();
    });
    return contenitore;
  };
  controlloPoster.addTo(mappa);

  return {
    mappa,
    ridipingi,
    inquadraTutto,
    inquadraPaese,
    volaSuLuogo,
    esportaPoster,
    get livello() {
      return livello;
    }
  };
}

/* ---------------------------------------------------------------- interni */

function livelloPerZoom(zoom, corrente) {
  let scelto = LIVELLI[0].nome;
  for (const livello of LIVELLI) {
    const soglia = corrente && indiceLivello(corrente) >= indiceLivello(livello.nome)
      ? livello.da - ISTERESI // per scendere serve superare la soglia di un margine
      : livello.da;
    if (zoom >= soglia) scelto = livello.nome;
  }
  return scelto;
}

function indiceLivello(nome) {
  return LIVELLI.findIndex((l) => l.nome === nome);
}

/**
 * L'unica animazione vistosa del sito: la scia si scrive da sola in ~2s.
 * Alla fine si ripulisce lo stile inline e torna il tratteggio dell'attributo.
 */
function disegnaProgressivamente(percorso) {
  if (!percorso || typeof percorso.getTotalLength !== 'function') return;
  const lunghezza = percorso.getTotalLength();
  if (!lunghezza) return;

  percorso.style.strokeDasharray = `${lunghezza}`;
  percorso.style.strokeDashoffset = `${lunghezza}`;
  percorso.getBoundingClientRect(); // forza il reflow prima della transizione
  percorso.style.transition = 'stroke-dashoffset 2s linear';
  percorso.style.strokeDashoffset = '0';

  setTimeout(() => {
    percorso.style.transition = '';
    percorso.style.strokeDasharray = '';
    percorso.style.strokeDashoffset = '';
  }, 2100);
}

function testoSicuro(testo) {
  return String(testo ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function elementoDi(forma) {
  const primo = forma.getLayers()[0];
  return primo && primo.getElement ? primo.getElement() : null;
}

function rendiFocalizzabile(forma, paese, stato) {
  const elementoForma = elementoDi(forma);
  if (!elementoForma) return;
  elementoForma.setAttribute('tabindex', '0');
  elementoForma.setAttribute('role', 'button');
  const quando = paese.luoghi.length ? `, ${formattaData(paese.luoghi[0].tempo)}` : '';
  elementoForma.setAttribute('aria-label', `${paese.nome}${quando}`);
  elementoForma.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      stato.apriPaese(paese);
    }
  });
}
