// La Serra sull'iPhone: oggi (agenda e cose in scadenza), le mie cose da fare, le routine dei clienti.
// Parla direttamente con il ponte (window.PONTE: indirizzo e chiave, aperti dal lucchetto). Le regole delle
// date e delle routine sono quelle di regole.js, le stesse del Mac. Senza rete si vede l'ultima copia
// salvata sul telefono, e quello che si cambia parte appena torna la rete.
'use strict';
(() => {
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const COPIA = 'serra-copia';
  const IC = {
    spunta: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    orologio: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    checklist: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
    ripeti: '<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    piu: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    archivio: '<svg viewBox="0 0 24 24"><path d="M3 7h18v13H3zM3 7l2-4h14l2 4M10 12h4"/></svg>',
    cestino: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };

  const T = {
    bacheche: {},          // b → doc, come nel ponte
    agenda: null,
    vista: 'oggi',
    cliente: null,
    lista: {},             // b → lista scelta
    sospese: {},           // b → true se c'è da mandare al ponte
    aperta: null,          // {b, id} della scheda aperta nel foglio
    nuova: null,           // b mentre si scrive una scheda nuova
  };
  const $ = (q) => document.querySelector(q);

  // ---------- Il ponte ----------

  async function ponte(azione, dati = {}) {
    const r = await fetch(window.PONTE.indirizzo, {
      method: 'POST', body: JSON.stringify({ ...dati, azione, chiave: window.PONTE.chiave }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    const j = await r.json();
    if (j.errore) throw new Error(j.errore);
    return j;
  }

  function memorizza() {
    try { localStorage.setItem(COPIA, JSON.stringify({ bacheche: T.bacheche, agenda: T.agenda, sospese: T.sospese })); } catch (e) { /* telefono pieno */ }
  }

  function rete(c) {
    const el = $('#rete');
    const sospese = Object.keys(T.sospese).length;
    el.hidden = c && !sospese;
    el.textContent = c ? 'Mando le modifiche…' : (sospese ? 'Manca la rete: le modifiche partono appena torna.' : 'Manca la rete: questa è l\'ultima copia.');
  }

  async function aggiorna() {
    let ok = true;
    try {
      const fuori = (await ponte('tutte')).bacheche;
      for (const [b, doc] of Object.entries(fuori)) if (!T.sospese[b]) T.bacheche[b] = doc;
      memorizza();
    } catch (e) { ok = false; }
    try { T.agenda = await ponte('agenda', { giorni: 8 }); memorizza(); } catch (e) { ok = false; }
    rete(ok);
    for (const b of Object.keys(T.sospese)) invia(b);
    disegna();
  }

  const volo = {}, timer = {};
  function salva(b) {
    T.sospese[b] = true;
    memorizza();
    clearTimeout(timer[b]);
    timer[b] = setTimeout(() => invia(b), 600);
  }

  async function invia(b) {
    if (volo[b] || !T.sospese[b]) return;
    volo[b] = true;
    delete T.sospese[b];
    const doc = T.bacheche[b];
    try {
      const r = await ponte('scrivi', { b, doc });
      if (r.unita) {
        T.bacheche[b] = r.doc;
        disegna();
        if (T.aperta && T.aperta.b === b) disegnaFoglio();
      } else {
        doc.rev = r.rev;
      }
      rete(true);
    } catch (e) {
      T.sospese[b] = true;
      rete(false);
      setTimeout(() => invia(b), 20000);
    }
    volo[b] = false;
    memorizza();
    if (T.sospese[b] && navigator.onLine) setTimeout(() => invia(b), 1500);
    else if (!Object.keys(T.sospese).length) $('#rete').hidden = true;
  }

  window.addEventListener('online', () => Object.keys(T.sospese).forEach(invia));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !T.aperta) aggiorna(); });

  // ---------- Avviso in basso ----------

  let timerAvviso = null;
  function avviso(testo, annulla) {
    const el = $('#avviso');
    el.innerHTML = `<span>${h(testo)}</span>${annulla ? '<button type="button">Annulla</button>' : ''}`;
    el.hidden = false;
    if (annulla) el.querySelector('button').onclick = () => { annulla(); el.hidden = true; };
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // ---------- Data e saluto ----------

  function testa() {
    const d = new Date();
    $('#giorno-sett').textContent = GIORNI[d.getDay()];
    $('#data').textContent = `${d.getDate()} ${MESI_LUNGHI[d.getMonth()]}`;
    const ora = d.getHours();
    const saluto = ora < 5 ? 'Buonanotte.' : ora < 13 ? 'Buongiorno.' : ora < 18 ? 'Buon pomeriggio.' : 'Buonasera.';
    $('#saluto').innerHTML = `<b>${saluto}</b> ${h(fraseAgenda())}`;
  }

  const dataEvento = (s) => (s.length === 10 ? dataScadenza(s) : new Date(s));
  const giornoDi = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  function fraseAgenda() {
    if (!T.agenda || !T.agenda.eventi) return '';
    const ora = new Date();
    const domani = giornoDi(new Date(ora.getTime() + 86400000));
    const ancora = T.agenda.eventi.filter((e) => !e.giornata && giornoDi(dataEvento(e.inizio)) === giornoDi(ora) && dataEvento(e.inizio) > ora).length;
    if (ancora) return ancora === 1 ? 'Oggi hai ancora un appuntamento.' : `Oggi hai ancora ${ancora} appuntamenti.`;
    const dom = T.agenda.eventi.filter((e) => giornoDi(dataEvento(e.inizio)) === domani).length;
    if (dom) return dom === 1 ? 'Domani hai un appuntamento.' : `Domani hai ${dom} appuntamenti.`;
    return '';
  }

  // ---------- Le schede ----------

  const doc = (b) => T.bacheche[b];
  const schedaDi = (b, id) => doc(b).schede.find((s) => s.id === id);
  const etichettaDi = (b, id) => (doc(b).etichette || []).find((e) => e.id === id);
  const listeDi = (b) => doc(b).liste.filter((l) => !l.archiviata).sort(perPos);
  const schedeDi = (b, l) => doc(b).schede.filter((s) => s.idLista === l && !s.archiviata).sort(perPos);
  const clientiAttivi = () => Object.entries(T.bacheche).filter(([b, d]) => b.startsWith('cliente-') && d && !d.archiviato)
    .map(([b, d]) => ({ b, nome: d.nome })).sort((x, y) => x.nome.localeCompare(y.nome));

  function htmlScheda(b, s, conCliente = false) {
    const cl = s.checklist || [];
    const fatte = cl.filter((v) => v.fatta).length;
    const stato = statoScadenza(s);
    const dist = [];
    if (conCliente) dist.push(`<span class="dist chi">${h(doc(b).nome)}</span>`);
    if (s.scadenza) dist.push(`<span class="dist ${stato}">${IC.orologio}${h(testoData(s.scadenza))}</span>`);
    if (s.ripeti) dist.push(`<span class="dist ripete">${IC.ripeti}${h(testoRipeti(s.ripeti, true))}</span>`);
    if (cl.length) dist.push(`<span class="dist${fatte === cl.length ? ' completa' : ''}">${IC.checklist}${fatte}/${cl.length}</span>`);
    const eti = (s.etichette || []).map((id) => etichettaDi(b, id)).filter(Boolean);
    return `<article class="scheda${s.fatta ? ' fatta' : ''}" data-b="${b}" data-id="${s.id}">
      ${eti.length ? `<div class="etichette">${eti.map((e) => `<span class="eti ${e.colore}">${h(e.nome)}</span>`).join('')}</div>` : ''}
      <div class="riga"><button class="spunta" type="button" data-spunta aria-label="${s.fatta ? 'Rimetti da fare' : 'Segna come fatta'}">${IC.spunta}</button>
        <span class="titolo">${h(s.titolo)}</span></div>
      ${dist.length ? `<div class="distintivi">${dist.join('')}</div>` : ''}
    </article>`;
  }

  function linguette(b) {
    const liste = listeDi(b);
    if (!T.lista[b] || !liste.some((l) => l.id === T.lista[b])) T.lista[b] = liste.length ? liste[0].id : null;
    return `<div class="linguette" role="tablist">${liste.map((l) => `<button type="button" class="${l.id === T.lista[b] ? 'attiva' : ''}" data-lista="${l.id}" data-b="${b}">
      ${h(l.nome)} <b>${schedeDi(b, l.id).length}</b></button>`).join('')}</div>`;
  }

  function colonna(b) {
    const l = T.lista[b];
    const schede = l ? schedeDi(b, l) : [];
    return `<div class="schede">${schede.map((s) => htmlScheda(b, s)).join('') || '<p class="vuota">Niente qui.</p>'}</div>
      ${T.nuova === b ? `<form class="compositore" data-b="${b}"><textarea placeholder="Scrivi e premi Invio" rows="2" aria-label="Titolo della scheda"></textarea>
        <div class="riga-azioni"><button class="bottone pieno" type="submit">Aggiungi</button><button class="bottone vuoto" type="button" data-chiudi-nuova>Annulla</button></div></form>`
      : `<button class="aggiungi" type="button" data-nuova="${b}">${IC.piu}Aggiungi una scheda</button>`}`;
  }

  // ---------- Le tre viste ----------

  function vistaOggi() {
    const oggi = new Date(); oggi.setHours(23, 59, 0, 0);
    const scadute = [];
    for (const [b, d] of Object.entries(T.bacheche)) {
      if (!d || d.archiviato) continue;
      for (const s of d.schede) if (!s.archiviata && !s.fatta && s.scadenza && dataScadenza(s.scadenza) <= oggi) scadute.push([b, s]);
    }
    scadute.sort(([, a], [, z]) => dataScadenza(a.scadenza) - dataScadenza(z.scadenza));
    let agenda = '<p class="vuota">Carico l\'agenda…</p>';
    if (T.agenda && T.agenda.eventi) {
      const ora = new Date();
      const giorni = new Map();
      for (const e of T.agenda.eventi) {
        const inizio = dataEvento(e.inizio), fine = dataEvento(e.fine || e.inizio);
        if (e.giornata && fine <= ora && giornoDi(fine) !== giornoDi(ora)) continue;
        const k = giornoDi(inizio);
        if (!giorni.has(k)) giorni.set(k, { data: inizio, eventi: [] });
        giorni.get(k).eventi.push({ ...e, inizioD: inizio, passato: !e.giornata && fine < ora });
      }
      const nome = (d) => {
        const o = new Date();
        if (giornoDi(d) === giornoDi(o)) return 'Oggi';
        if (giornoDi(d) === giornoDi(new Date(o.getTime() + 86400000))) return `Domani · ${GIORNI[d.getDay()]} ${d.getDate()}`;
        return `${GIORNI[d.getDay()]} ${d.getDate()}`;
      };
      const ore = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      agenda = giorni.size ? [...giorni.values()].slice(0, 4).map((g) => `<div class="giorno"><h3>${nome(g.data)}</h3>
        ${g.eventi.map((e) => `<div class="evento${e.passato ? ' passato' : ''}"><span class="ora">${e.giornata ? '·' : ore(e.inizioD)}</span>
          <span>${h(e.titolo)}${e.giornata ? '<small>tutto il giorno</small>' : ''}</span></div>`).join('')}</div>`).join('')
        : '<p class="vuota">Nessun appuntamento nei prossimi giorni.</p>';
    }
    return `<section class="blocco agenda"><h2>In agenda</h2>${agenda}</section>
      <section class="blocco"><h2>Da fare oggi</h2>
        <div class="schede">${scadute.map(([b, s]) => htmlScheda(b, s, b !== 'mie')).join('') || '<p class="vuota">Oggi niente in scadenza.</p>'}</div>
      </section>
      <svg class="vaso-fondo" data-pianta="begonia" data-stile="colore" data-vaso="crema"></svg>`;
  }

  function vistaMie() {
    if (!doc('mie')) return '<p class="vuota">Carico…</p>';
    return `<section class="blocco"><h2>Le mie cose da fare</h2>${linguette('mie')}${colonna('mie')}</section>`;
  }

  function vistaClienti() {
    const clienti = clientiAttivi();
    if (!clienti.length) return '<section class="blocco"><h2>Clienti</h2><p class="vuota">Nessun cliente attivo. I clienti nuovi si creano sul Mac.</p></section>';
    if (!clienti.some((c) => c.b === T.cliente)) T.cliente = clienti[0].b;
    return `<section class="blocco"><h2>Clienti</h2>
      <div class="chip-riga">${clienti.map((c) => `<button type="button" class="chip${c.b === T.cliente ? ' attivo' : ''}" data-cliente="${c.b}">${h(c.nome)}</button>`).join('')}</div>
      ${linguette(T.cliente)}${colonna(T.cliente)}</section>`;
  }

  function disegna() {
    testa();
    const vista = $('#vista');
    const scorri = window.scrollY;
    vista.innerHTML = T.vista === 'oggi' ? vistaOggi() : T.vista === 'mie' ? vistaMie() : vistaClienti();
    vista.querySelectorAll('svg[data-pianta]').forEach((s) => window.Piante.riempi(s));
    window.scrollTo(0, scorri);
    document.querySelectorAll('.schede-basso button').forEach((b) => b.classList.toggle('attiva', b.dataset.vista === T.vista));
    const ta = vista.querySelector('.compositore textarea');
    if (ta) ta.focus();
  }

  // ---------- Fare le cose ----------

  function segnaFatta(b, s) {
    if (!s.fatta && s.ripeti) {
      const nuova = prossimaVolta(s);
      s.archiviata = true;
      cambiaFatta(s, true);
      doc(b).schede.push(nuova);
      if (T.aperta && T.aperta.id === s.id) T.aperta.id = nuova.id;
      salva(b);
      disegna();
      if (T.aperta) disegnaFoglio();
      const quando = testoData(nuova.scadenza).replace(/^(Oggi|Domani)/, (m) => m.toLowerCase());
      avviso(`Fatta! Torna ${/^\d/.test(quando) ? 'il ' + quando : quando}.`, () => {
        doc(b).schede = doc(b).schede.filter((x) => x.id !== nuova.id);
        s.archiviata = false;
        cambiaFatta(s, false);
        if (T.aperta && T.aperta.id === nuova.id) T.aperta.id = s.id;
        salva(b);
        disegna();
      });
      return;
    }
    cambiaFatta(s, !s.fatta);
    salva(b);
    disegna();
    if (T.aperta) disegnaFoglio();
  }

  function aggiungi(b, testo) {
    const titolo = testo.trim();
    if (!titolo) return;
    const l = T.lista[b];
    const ultime = schedeDi(b, l);
    const t = adesso();
    const nuova = { id: nuovoId('s'), idLista: l, pos: posTra(ultime.length ? ultime[ultime.length - 1].pos : null, null),
      titolo, descrizione: '', etichette: [], scadenza: null, fatta: false, checklist: [], archiviata: false, creata: t, modificata: t };
    const ripeti = doc(b).cliente && ripetiDellaColonna(l);
    if (ripeti) { nuova.ripeti = ripeti; nuova.scadenza = primaData(ripeti); }
    doc(b).schede.push(nuova);
    salva(b);
    disegna();
  }

  // ---------- Il foglio della scheda (dal basso, come sul telefono) ----------

  function apriFoglio(b, id) {
    T.aperta = { b, id };
    disegnaFoglio();
    $('#foglio').showModal();
  }

  function disegnaFoglio() {
    if (!T.aperta) return;
    const { b, id } = T.aperta;
    const s = schedaDi(b, id);
    const f = $('#foglio');
    if (!s) { f.close(); return; }
    const cl = (s.checklist || []).slice().sort(perPos);
    const r = s.ripeti;
    const ogni = !r ? '' : r.ogni === 'giorno' && r.feriali ? 'feriali' : r.ogni;
    f.innerHTML = `<form method="dialog" class="foglio-dentro">
      <div class="maniglia"></div>
      <div class="foglio-testa"><span>${h(doc(b).nome)} · ${h((doc(b).liste.find((l) => l.id === s.idLista) || {}).nome || '')}</span>
        <button class="icona-btn" type="button" data-chiudi-foglio aria-label="Chiudi">${IC.x}</button></div>
      <textarea class="foglio-titolo" data-campo="titolo" rows="2" aria-label="Titolo">${h(s.titolo)}</textarea>
      <button class="bottone largo ${s.fatta ? 'fatta' : 'pieno'}" type="button" data-fatta>${IC.spunta}${s.fatta ? 'Fatta' : 'Segna come fatta'}</button>
      <label class="campo">Lista<select data-campo="lista">${listeDi(b).map((l) => `<option value="${l.id}"${l.id === s.idLista ? ' selected' : ''}>${h(l.nome)}</option>`).join('')}</select></label>
      <label class="campo">Scadenza<input type="date" data-campo="giorno" value="${s.scadenza ? s.scadenza.slice(0, 10) : ''}"></label>
      <label class="campo">Si ripete<select data-campo="ripeti">
        ${[['', 'No'], ['feriali', 'Ogni giorno, da lunedì a venerdì'], ['giorno', 'Ogni giorno'], ['settimana', 'Ogni settimana'], ['mese', 'Ogni mese'], ['trimestre', 'Ogni 3 mesi']]
          .map(([v, t]) => `<option value="${v}"${v === ogni ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${r ? `<p class="spiega">${h(testoRipeti(r))}. Quando la segni come fatta, torna da sola.</p>` : ''}
      <div class="campo-eti">${(doc(b).etichette || []).map((e) => `<button type="button" class="eti ${e.colore}${(s.etichette || []).includes(e.id) ? ' scelta' : ''}" data-eti="${e.id}">${h(e.nome)}</button>`).join('')}</div>
      <label class="campo">Note<textarea data-campo="descrizione" rows="4" placeholder="Tutto quello che serve sapere">${h(s.descrizione || '')}</textarea></label>
      <div class="checklist"><h3>Checklist${cl.length ? ` · ${cl.filter((v) => v.fatta).length}/${cl.length}` : ''}</h3>
        ${cl.map((v) => `<label class="voce${v.fatta ? ' fatta' : ''}"><input class="casella" type="checkbox" data-voce="${v.id}"${v.fatta ? ' checked' : ''}><span>${h(v.testo)}</span></label>`).join('')}
        <div class="voce-nuova"><input data-campo="voce-nuova" placeholder="Aggiungi un passaggio" aria-label="Nuovo passaggio"><button class="bottone vuoto" type="button" data-aggiungi-voce>Aggiungi</button></div></div>
      <div class="foglio-piede"><button class="bottone vuoto" type="button" data-archivia>${IC.archivio}Archivia</button>
        <button class="bottone vuoto pericolo" type="button" data-elimina>${IC.cestino}Elimina</button></div>
    </form>`;
  }

  $('#foglio').addEventListener('close', () => { T.aperta = null; disegna(); });
  $('#foglio').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#foglio').close(); });

  $('#foglio').addEventListener('input', (e) => {
    if (!T.aperta) return;
    const s = schedaDi(T.aperta.b, T.aperta.id);
    const campo = e.target.dataset.campo;
    if (campo === 'titolo') s.titolo = e.target.value.replace(/\n/g, ' ');
    else if (campo === 'descrizione') s.descrizione = e.target.value;
    else return;
    tocca(s);
    salva(T.aperta.b);
  });

  $('#foglio').addEventListener('change', (e) => {
    if (!T.aperta) return;
    const { b } = T.aperta;
    const s = schedaDi(b, T.aperta.id);
    const campo = e.target.dataset.campo;
    if (campo === 'lista') {
      const ultime = schedeDi(b, e.target.value);
      s.idLista = e.target.value;
      s.pos = posTra(ultime.length ? ultime[ultime.length - 1].pos : null, null);
    } else if (campo === 'giorno') {
      s.scadenza = e.target.value || null;
    } else if (campo === 'ripeti') {
      const v = e.target.value;
      const base = s.scadenza ? dataScadenza(s.scadenza) : new Date();
      s.ripeti = !v ? null : v === 'feriali' ? { ogni: 'giorno', feriali: true } : v === 'giorno' ? { ogni: 'giorno' }
        : v === 'settimana' ? { ogni: 'settimana', giorno: giornoSett(base) } : { ogni: v, giorno: base.getDate() };
      if (s.ripeti && !s.scadenza) s.scadenza = primaData(s.ripeti);
    } else if (e.target.dataset.voce) {
      const v = s.checklist.find((x) => x.id === e.target.dataset.voce);
      v.fatta = e.target.checked;
    } else return;
    tocca(s);
    salva(b);
    disegnaFoglio();
  });

  // ---------- Tocchi ----------

  document.addEventListener('click', (e) => {
    const t = e.target;
    const vista = t.closest('.schede-basso [data-vista]');
    if (vista) { T.vista = vista.dataset.vista; T.nuova = null; disegna(); return window.scrollTo(0, 0); }
    const lista = t.closest('[data-lista]');
    if (lista && !t.closest('#foglio')) { T.lista[lista.dataset.b] = lista.dataset.lista; T.nuova = null; return disegna(); }
    const chip = t.closest('[data-cliente]');
    if (chip) { T.cliente = chip.dataset.cliente; T.nuova = null; return disegna(); }
    if (t.closest('[data-nuova]')) { T.nuova = t.closest('[data-nuova]').dataset.nuova; return disegna(); }
    if (t.closest('[data-chiudi-nuova]')) { T.nuova = null; return disegna(); }
    const scheda = t.closest('#vista .scheda');
    if (scheda) {
      const { b, id } = scheda.dataset;
      if (t.closest('[data-spunta]')) return segnaFatta(b, schedaDi(b, id));
      return apriFoglio(b, id);
    }
    if (!T.aperta) return;
    const { b } = T.aperta;
    const s = schedaDi(b, T.aperta.id);
    if (t.closest('[data-chiudi-foglio]')) return $('#foglio').close();
    if (t.closest('[data-fatta]')) return segnaFatta(b, s);
    if (t.closest('[data-eti]')) {
      const id = t.closest('[data-eti]').dataset.eti;
      s.etichette = (s.etichette || []).includes(id) ? s.etichette.filter((x) => x !== id) : [...(s.etichette || []), id];
      tocca(s); salva(b); return disegnaFoglio();
    }
    if (t.closest('[data-aggiungi-voce]')) {
      const input = $('#foglio [data-campo="voce-nuova"]');
      const testo = input.value.trim();
      if (!testo) return input.focus();
      const ultima = (s.checklist || []).slice().sort(perPos).pop();
      s.checklist = [...(s.checklist || []), { id: nuovoId('v'), testo, fatta: false, pos: posTra(ultima ? ultima.pos : null, null) }];
      tocca(s); salva(b); disegnaFoglio();
      return $('#foglio [data-campo="voce-nuova"]').focus();
    }
    if (t.closest('[data-archivia]')) {
      s.archiviata = true; tocca(s); salva(b);
      $('#foglio').close();
      return avviso('Scheda archiviata.', () => { s.archiviata = false; tocca(s); salva(b); disegna(); });
    }
    if (t.closest('[data-elimina]')) {
      const fatto = eliminaScheda(doc(b), s.id);
      salva(b);
      $('#foglio').close();
      return avviso('Scheda eliminata.', () => { fatto.annulla(); salva(b); disegna(); });
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.compositore');
    if (!form) return;
    e.preventDefault();
    aggiungi(form.dataset.b, form.querySelector('textarea').value);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.closest('.compositore textarea')) {
      e.preventDefault();
      aggiungi(e.target.closest('.compositore').dataset.b, e.target.value);
    }
  });

  // ---------- Avvio ----------

  try {
    const copia = JSON.parse(localStorage.getItem(COPIA));
    if (copia) { T.bacheche = copia.bacheche || {}; T.agenda = copia.agenda || null; T.sospese = copia.sospese || {}; }
  } catch (e) { /* niente copia: si aspetta il ponte */ }
  window.Piante.riempi(document.querySelector('.testa .appesa'));
  disegna();
  aggiorna();
  setInterval(testa, 30000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
