/**
 * Caricamento, validazione e indici derivati.
 *
 * `viaggi.json` è la sola fonte di verità: qui viene letto, controllato e
 * trasformato in strutture comode per il resto del sito. Nessun errore in un
 * luogo impedisce il rendering degli altri: i problemi si accumulano in una
 * lista e finiscono in console, il luogo rotto viene scartato.
 */

/* Il sito è in inglese; il codice resta nella lingua della specifica. */
const MESI = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/* ---------------------------------------------------------------- utilità */

export function slugifica(testo) {
  return String(testo)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // via gli accenti separati da NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Accetta "YYYY", "YYYY-MM" o "YYYY-MM-DD".
 * Restituisce { inizio, fine, precisione } in millisecondi UTC, dove `fine` è
 * l'ultimo istante del periodo indicato: una data parziale è un intervallo, e
 * l'ordinamento usa sempre `inizio` (cioè l'inizio del periodo).
 */
export function analizzaData(testo) {
  if (typeof testo !== 'string') return null;
  const m = testo.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;

  const anno = Number(m[1]);
  const mese = m[2] === undefined ? null : Number(m[2]);
  const giorno = m[3] === undefined ? null : Number(m[3]);

  if (mese !== null && (mese < 1 || mese > 12)) return null;
  if (giorno !== null && (giorno < 1 || giorno > 31)) return null;

  const precisione = giorno !== null ? 'giorno' : mese !== null ? 'mese' : 'anno';
  const inizio = Date.UTC(anno, (mese ?? 1) - 1, giorno ?? 1);

  let fine;
  if (precisione === 'giorno') fine = inizio + 86400000 - 1;
  else if (precisione === 'mese') fine = Date.UTC(anno, mese, 1) - 1;
  else fine = Date.UTC(anno + 1, 0, 1) - 1;

  // Date.UTC non valida il giorno del mese: 31 febbraio scivolerebbe a marzo.
  if (giorno !== null && new Date(inizio).getUTCDate() !== giorno) return null;

  return { inizio, fine, precisione, anno, mese, giorno, testo: testo.trim() };
}

/** "12 April 2023", "April 2023", "2023" — secondo la precisione della data. */
export function formattaData(tempo) {
  if (!tempo) return '';
  if (tempo.precisione === 'anno') return String(tempo.anno);
  if (tempo.precisione === 'mese') return `${MESI[tempo.mese - 1]} ${tempo.anno}`;
  return `${tempo.giorno} ${MESI[tempo.mese - 1]} ${tempo.anno}`;
}

/** Periodo di un luogo: compatta "12 April 2023 – 17 April 2023" in "12–17 April 2023". */
export function formattaPeriodo(luogo) {
  const a = luogo.tempo;
  const b = luogo.tempoFine;
  if (!b) return formattaData(a);
  if (a.anno === b.anno && a.mese === b.mese && a.precisione === 'giorno' && b.precisione === 'giorno') {
    return `${a.giorno}–${b.giorno} ${MESI[a.mese - 1]} ${a.anno}`;
  }
  if (a.anno === b.anno && a.precisione === 'giorno' && b.precisione === 'giorno') {
    return `${a.giorno} ${MESI[a.mese - 1]} – ${b.giorno} ${MESI[b.mese - 1]} ${a.anno}`;
  }
  return `${formattaData(a)} – ${formattaData(b)}`;
}

export function coordinataValida(coord) {
  return (
    Array.isArray(coord) &&
    coord.length === 2 &&
    Number.isFinite(coord[0]) && Number.isFinite(coord[1]) &&
    coord[0] >= -90 && coord[0] <= 90 &&
    coord[1] >= -180 && coord[1] <= 180
  );
}

/** Coordinate in stile carta nautica: 38.7223° N, 9.1393° W */
export function formattaCoord([lat, lon]) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

/** Distanza in linea d'aria fra due coordinate, in chilometri. */
export function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* ------------------------------------------------------------ caricamento */

async function leggiJson(percorso) {
  let risposta;
  try {
    risposta = await fetch(percorso, { cache: 'no-cache' });
  } catch (errore) {
    throw new Error(`Cannot reach ${percorso} (${errore.message}). Are you serving the folder with a static server?`);
  }
  if (!risposta.ok) {
    throw new Error(`${percorso} not found (HTTP ${risposta.status}).`);
  }
  try {
    return await risposta.json();
  } catch (errore) {
    throw new Error(`${percorso} is not valid JSON: ${errore.message}`);
  }
}

/* ------------------------------------------------------------ validazione */

function normalizzaFoto(grezza, luogo, problemi) {
  if (!grezza || typeof grezza.file !== 'string' || !grezza.file) {
    problemi.push(`${luogo.nome}: photo with no "file" field, skipped.`);
    return null;
  }
  const foto = {
    file: grezza.file,
    didascalia: typeof grezza.didascalia === 'string' ? grezza.didascalia : '',
    scattata: typeof grezza.scattata === 'string' ? grezza.scattata : null,
    coord: null,
    luogo,
    src: `${luogo.cartellaFoto}/${grezza.file}`,
    thumb: `${luogo.cartellaFoto}/thumb/${grezza.file}`
  };
  if (grezza.coord !== undefined) {
    if (coordinataValida(grezza.coord)) foto.coord = grezza.coord;
    else problemi.push(`${luogo.nome} / ${grezza.file}: invalid photo coordinates, ignored.`);
  }
  return foto;
}

function normalizzaLuogo(grezzo, paese, problemi) {
  const etichetta = `${paese.nome} / ${grezzo?.nome ?? grezzo?.slug ?? '(unnamed)'}`;

  if (!grezzo || typeof grezzo !== 'object') {
    problemi.push(`${paese.nome}: entry in "luoghi" is not an object, dropped.`);
    return null;
  }
  if (typeof grezzo.nome !== 'string' || !grezzo.nome.trim()) {
    problemi.push(`${etichetta}: missing "nome", place dropped.`);
    return null;
  }
  if (!coordinataValida(grezzo.coord)) {
    problemi.push(`${etichetta}: "coord" missing or out of range ([lat, lon] with lat ±90, lon ±180), place dropped.`);
    return null;
  }
  const tempo = analizzaData(grezzo.data);
  if (!tempo) {
    problemi.push(`${etichetta}: "data" missing or unparsable (${JSON.stringify(grezzo.data)}); expected "YYYY", "YYYY-MM" or "YYYY-MM-DD". Place dropped.`);
    return null;
  }

  let tempoFine = null;
  if (grezzo.data_fine !== undefined && grezzo.data_fine !== null && grezzo.data_fine !== '') {
    tempoFine = analizzaData(grezzo.data_fine);
    if (!tempoFine) {
      problemi.push(`${etichetta}: "data_fine" unparsable (${JSON.stringify(grezzo.data_fine)}), ignored.`);
    } else if (tempoFine.fine < tempo.inizio) {
      problemi.push(`${etichetta}: "data_fine" precedes "data", ignored.`);
      tempoFine = null;
    }
  }

  const slug = slugifica(grezzo.slug || grezzo.nome);
  const luogo = {
    slug,
    nome: grezzo.nome.trim(),
    coord: grezzo.coord,
    origineCoord: grezzo.origine_coord ?? null,
    tempo,
    tempoFine,
    // istante di inizio e di fine dell'esistenza del luogo sulla timeline
    inizio: tempo.inizio,
    fine: tempoFine ? tempoFine.fine : tempo.fine,
    descrizione: typeof grezzo.descrizione === 'string' ? grezzo.descrizione.trim() : '',
    nota: typeof grezzo.nota === 'string' && grezzo.nota.trim() ? grezzo.nota.trim() : null,
    fonte: grezzo.fonte && typeof grezzo.fonte.url === 'string' ? grezzo.fonte : null,
    paese,
    cartellaFoto: `./foto/${paese.slug}/${slug}`,
    foto: [],
    punti: []
  };

  const foto = Array.isArray(grezzo.foto) ? grezzo.foto : [];
  if (grezzo.foto !== undefined && !Array.isArray(grezzo.foto)) {
    problemi.push(`${etichetta}: "foto" is not a list, ignored.`);
  }
  luogo.foto = foto.map((f) => normalizzaFoto(f, luogo, problemi)).filter(Boolean);

  const punti = Array.isArray(grezzo.punti) ? grezzo.punti : [];
  for (const punto of punti) {
    if (!punto || typeof punto.nome !== 'string' || !coordinataValida(punto.coord)) {
      problemi.push(`${etichetta}: point with no "nome" or invalid coordinates, ignored.`);
      continue;
    }
    luogo.punti.push({ nome: punto.nome, coord: punto.coord, luogo });
  }

  return luogo;
}

function normalizzaPaese(grezzo, problemi) {
  const etichetta = grezzo?.nome ?? '(unnamed country)';

  if (!grezzo || typeof grezzo !== 'object') {
    problemi.push('Entry in "paesi" is not an object, dropped.');
    return null;
  }
  if (typeof grezzo.nome !== 'string' || !grezzo.nome.trim()) {
    problemi.push('Country with no "nome", dropped.');
    return null;
  }
  const id = Number(grezzo.id);
  if (!Number.isInteger(id) || id <= 0) {
    problemi.push(`${etichetta}: "id" missing or not numeric. It must be the ISO 3166-1 numeric code (e.g. 620 for Portugal): it is the join key with the geometries. Country dropped.`);
    return null;
  }

  const paese = {
    id,
    nome: grezzo.nome.trim(),
    slug: slugifica(grezzo.slug || grezzo.nome),
    continente: typeof grezzo.continente === 'string' ? grezzo.continente.trim() : '',
    luoghi: []
  };
  if (!paese.continente) {
    problemi.push(`${paese.nome}: missing "continente"; it will not be counted among the continents.`);
  }

  const luoghi = Array.isArray(grezzo.luoghi) ? grezzo.luoghi : [];
  if (!Array.isArray(grezzo.luoghi)) {
    problemi.push(`${paese.nome}: "luoghi" is not a list.`);
  }

  const slugVisti = new Set();
  for (const grezzoLuogo of luoghi) {
    const luogo = normalizzaLuogo(grezzoLuogo, paese, problemi);
    if (!luogo) continue;
    if (slugVisti.has(luogo.slug)) {
      problemi.push(`${paese.nome} / ${luogo.nome}: duplicate slug "${luogo.slug}"; deep links will point at the first one.`);
    }
    slugVisti.add(luogo.slug);
    paese.luoghi.push(luogo);
  }

  // l'ordine dentro il paese è cronologico, mai quello dell'array
  paese.luoghi.sort((a, b) => a.inizio - b.inizio);
  return paese;
}

/* --------------------------------------------------------------- derivati */

function costruisciIndici(paesi) {
  const cronologia = paesi
    .flatMap((p) => p.luoghi)
    .sort((a, b) => a.inizio - b.inizio || a.nome.localeCompare(b.nome, 'it'));

  cronologia.forEach((luogo, i) => {
    luogo.indice = i; // posizione nell'ordine cronologico globale
  });

  const paesiPerId = new Map(paesi.map((p) => [p.id, p]));
  const paesiPerSlug = new Map(paesi.map((p) => [p.slug, p]));

  for (const paese of paesi) {
    paese.luoghiPerSlug = new Map(paese.luoghi.map((l) => [l.slug, l]));
    paese.inizio = paese.luoghi.length ? Math.min(...paese.luoghi.map((l) => l.inizio)) : null;
    paese.fine = paese.luoghi.length ? Math.max(...paese.luoghi.map((l) => l.fine)) : null;
  }

  // i paesi si ciclano da tastiera in ordine cronologico di prima visita
  const paesiCronologici = paesi
    .filter((p) => p.luoghi.length)
    .sort((a, b) => a.inizio - b.inizio);

  return { cronologia, paesiPerId, paesiPerSlug, paesiCronologici };
}

/**
 * Statistiche su un sottoinsieme di luoghi (§9.1–9.3).
 * Riceve già i luoghi filtrati dalla timeline: non sa nulla del tempo.
 */
export function statistiche(luoghi) {
  const paesi = new Set();
  const continenti = new Set();
  for (const luogo of luoghi) {
    paesi.add(luogo.paese.id);
    if (luogo.paese.continente) continenti.add(luogo.paese.continente);
  }

  let distanza = 0;
  for (let i = 1; i < luoghi.length; i++) {
    distanza += haversine(luoghi[i - 1].coord, luoghi[i].coord);
  }

  let estremi = null;
  if (luoghi.length) {
    const per = (chiave, migliore) =>
      luoghi.reduce((a, b) => (migliore(valore(b, chiave), valore(a, chiave)) ? b : a));
    const valore = (luogo, chiave) => (chiave === 'lat' ? luogo.coord[0] : luogo.coord[1]);
    estremi = {
      nord: per('lat', (x, y) => x > y),
      sud: per('lat', (x, y) => x < y),
      est: per('lon', (x, y) => x > y),
      ovest: per('lon', (x, y) => x < y)
    };
  }

  return {
    paesi: paesi.size,
    luoghi: luoghi.length,
    continenti: continenti.size,
    distanza,
    estremi
  };
}

/* ------------------------------------------------------------------ carica */

export async function caricaViaggi(percorso = './data/viaggi.json') {
  const grezzo = await leggiJson(percorso);
  const problemi = [];

  const meta = grezzo?.meta && typeof grezzo.meta === 'object' ? grezzo.meta : {};
  const elenco = Array.isArray(grezzo?.paesi) ? grezzo.paesi : [];
  if (!Array.isArray(grezzo?.paesi)) {
    problemi.push('viaggi.json: missing top-level "paesi" list.');
  }

  const paesi = [];
  const idVisti = new Set();
  for (const grezzoPaese of elenco) {
    const paese = normalizzaPaese(grezzoPaese, problemi);
    if (!paese) continue;
    if (idVisti.has(paese.id)) {
      problemi.push(`Country id ${paese.id} appears twice: merge the entries, the places of the second one will not be shown.`);
      continue;
    }
    idVisti.add(paese.id);
    paesi.push(paese);
  }

  const indici = costruisciIndici(paesi);
  segnalaProblemi(problemi);

  return { meta, paesi, problemi, ...indici };
}

export async function caricaMondo(percorso = './data/mondo.json') {
  const geo = await leggiJson(percorso);
  if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
    throw new Error(`${percorso} is not a GeoJSON FeatureCollection. Regenerate it with: python tools/converti_geometrie.py`);
  }
  return geo;
}

function segnalaProblemi(problemi) {
  if (!problemi.length) return;
  const titolo = `viaggi.json: ${problemi.length} ${problemi.length === 1 ? 'problem' : 'problems'}`;
  if (console.groupCollapsed) {
    console.groupCollapsed(titolo);
    problemi.forEach((p) => console.warn(p));
    console.groupEnd();
  } else {
    console.warn(titolo);
    problemi.forEach((p) => console.warn(p));
  }
}
