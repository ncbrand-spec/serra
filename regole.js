// Le regole della Serra che valgono uguali sul Mac e sull'iPhone: posizioni delle schede, date, scadenze e
// routine (schede che si ripetono). Le stesse regole delle date sono in prima_data (server.py): se si cambia
// una, cambiare anche l'altra. Va caricato prima di bacheca.js (Mac) o di telefono.js (iPhone).
'use strict';

const PASSO = 16384;

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI_SETT = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const h = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nuovoId = (pre) => pre + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// Ora locale del Mac, nello stesso formato del motore (toISOString darebbe l'ora di Greenwich).
const adesso = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const perPos = (a, b) => a.pos - b.pos;
function tocca(s) { s.modificata = adesso(); }

// Fatta o di nuovo da fare, col momento in cui è stata fatta: servono ai numeri della Serra viva.
function cambiaFatta(s, si) {
  s.fatta = si;
  if (si) s.fattaIl = adesso(); else delete s.fattaIl;
  tocca(s);
}

function posTra(prima, dopo) {
  if (prima == null && dopo == null) return PASSO;
  if (prima == null) return dopo / 2;
  if (dopo == null) return prima + PASSO;
  return (prima + dopo) / 2;
}

// Quando due posizioni diventano troppo vicine si rinumera tutta la colonna (come fa Trello).
function rinumeraSeServe(elementi) {
  const ordinati = elementi.slice().sort(perPos);
  const stretti = ordinati.some((e, i) => i > 0 && e.pos - ordinati[i - 1].pos < 0.01);
  if (stretti || ordinati.some((e) => !(e.pos > 0))) ordinati.forEach((e, i) => { e.pos = PASSO * (i + 1); });
}

// ---------- Date ----------

function dataScadenza(str) {
  if (!str) return null;
  const [g, o] = str.split('T');
  const [a, m, d] = g.split('-').map(Number);
  if (!o) return new Date(a, m - 1, d, 23, 59);        // solo il giorno: vale fino a sera
  const [hh, mm] = o.split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm);
}

function statoScadenza(s) {
  if (!s.scadenza) return null;
  if (s.fatta) return 'fatta';
  const diff = dataScadenza(s.scadenza) - new Date();
  if (diff < 0) return 'scaduta';
  if (diff < 24 * 3600 * 1000) return 'vicina';
  return 'normale';
}

function testoData(str) {
  const d = dataScadenza(str);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const giorno = new Date(d); giorno.setHours(0, 0, 0, 0);
  const tra = Math.round((giorno - oggi) / 86400000);
  let t = tra === 0 ? 'Oggi' : tra === 1 ? 'Domani' : tra === -1 ? 'Ieri' : `${d.getDate()} ${MESI[d.getMonth()]}`;
  if (str.includes('T')) t += `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return t;
}

// ---------- Routine: schede che si ripetono ----------
// ripeti = {ogni: 'giorno', feriali?} | {ogni: 'settimana', giorno: 1–7 (lunedì = 1)} | {ogni: 'mese' | 'trimestre', giorno: 1–31}

const isoGiorno = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const giornoSett = (d) => ((d.getDay() + 6) % 7) + 1;

function testoRipeti(r, corto = false) {
  if (!r) return '';
  if (r.ogni === 'giorno') return r.feriali ? (corto ? 'Lun–ven' : 'Ogni giorno, dal lunedì al venerdì') : 'Ogni giorno';
  if (r.ogni === 'settimana') return 'Ogni ' + GIORNI_SETT[(r.giorno || 1) - 1];
  if (r.ogni === 'mese') return corto ? `Il ${r.giorno} del mese` : `Ogni mese, il giorno ${r.giorno}`;
  return corto ? 'Ogni 3 mesi' : `Ogni 3 mesi, il giorno ${r.giorno}`;
}

function giornoDelMese(anno, mese, giorno) {      // il 31 diventa l'ultimo giorno dei mesi più corti
  return new Date(anno, mese, Math.min(giorno, new Date(anno, mese + 1, 0).getDate()));
}

function ripetiDellaColonna(idLista) {
  const oggi = new Date();
  if (idLista === 'l-giorno') return { ogni: 'giorno', feriali: true };
  if (idLista === 'l-settimana') return { ogni: 'settimana', giorno: giornoSett(oggi) };
  if (idLista === 'l-mese') return { ogni: 'mese', giorno: oggi.getDate() };
  if (idLista === 'l-trimestre') return { ogni: 'trimestre', giorno: oggi.getDate() };
  return null;
}

// La prima volta, da oggi in poi.
function primaData(r) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (r.ogni === 'giorno') { while (r.feriali && giornoSett(d) > 5) d.setDate(d.getDate() + 1); return isoGiorno(d); }
  if (r.ogni === 'settimana') { while (giornoSett(d) !== r.giorno) d.setDate(d.getDate() + 1); return isoGiorno(d); }
  const mese = d.getDate() > r.giorno ? d.getMonth() + 1 : d.getMonth();
  return isoGiorno(giornoDelMese(d.getFullYear(), mese, r.giorno));
}

// La volta dopo una data.
function dopo(r, base) {
  const d = new Date(base);
  if (r.ogni === 'giorno') { do d.setDate(d.getDate() + 1); while (r.feriali && giornoSett(d) > 5); return d; }
  if (r.ogni === 'settimana') { do d.setDate(d.getDate() + 1); while (giornoSett(d) !== r.giorno); return d; }
  return giornoDelMese(d.getFullYear(), d.getMonth() + (r.ogni === 'trimestre' ? 3 : 1), r.giorno || d.getDate());
}

// La volta dopo la scadenza; se la routine si fa in ritardo, conta anche per oggi e torna dalla volta
// successiva a oggi (così non si accumulano arretrati e non ricompare subito).
function dataProssima(s) {
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  let base = s.scadenza ? dataScadenza(s.scadenza) : new Date(oggi);
  base.setHours(0, 0, 0, 0);
  if (base < oggi) base = oggi;
  const d = dopo(s.ripeti, base);
  const ora = s.scadenza && s.scadenza.includes('T') ? 'T' + s.scadenza.split('T')[1] : '';
  return isoGiorno(d) + ora;
}

function testoQuando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]} alle ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// La volta dopo di una routine fatta: una copia con la data nuova e la checklist pulita.
function prossimaVolta(s) {
  const nuova = JSON.parse(JSON.stringify(s));
  nuova.id = nuovoId('s');
  nuova.fatta = false;
  nuova.archiviata = false;
  nuova.creata = nuova.modificata = adesso();
  nuova.checklist = (s.checklist || []).map((v) => ({ ...v, id: nuovoId('v'), fatta: false }));
  nuova.scadenza = dataProssima(s);
  return nuova;
}

// Elimina una scheda da una bacheca e la segna fra le «eliminate», così il ponte non la fa tornare unendo
// le modifiche di un altro dispositivo. Torna una funzione che la rimette dov'era (per «Annulla»).
function eliminaScheda(doc, id) {
  const i = doc.schede.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const [tolta] = doc.schede.splice(i, 1);
  doc.eliminate = [...(doc.eliminate || []), { id, quando: adesso() }].slice(-500);
  return {
    tolta,
    annulla() {
      doc.schede.splice(Math.min(i, doc.schede.length), 0, tolta);
      doc.eliminate = (doc.eliminate || []).filter((t) => t.id !== id);
    },
  };
}
