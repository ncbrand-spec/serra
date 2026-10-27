'use strict';
// L'indirizzo e la chiave del ponte sono pubblicati chiusi con la password di Natasha (AES-GCM, chiave dalla
// password con PBKDF2: lo stesso lucchetto di Velvet). La prima volta chiede la password, poi la chiave resta
// su questo telefono e la Serra si apre da sola. Poi carica telefono.js.
(() => {
  const SALVATA = 'serra-chiave';
  const daB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const aB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const form = document.getElementById('lucchetto');
  const errore = form.querySelector('.errore');
  let cassaforte = null;

  async function apri(chiave) {
    const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(cassaforte.iv) }, chiave, daB64(cassaforte.dati));
    return JSON.parse(new TextDecoder().decode(chiaro));
  }

  async function chiaveDallaPassword(password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: daB64(cassaforte.sale), iterations: cassaforte.iterazioni, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }

  function parti(ponte) {
    window.PONTE = ponte;
    form.remove();
    document.body.classList.remove('chiusa');
    document.getElementById('app').hidden = false;
    const s = document.createElement('script');
    s.src = 'telefono.js';
    document.body.appendChild(s);
  }

  function chiedi(messaggio) {
    errore.textContent = messaggio || '';
    form.hidden = false;
    form.elements.password.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = form.elements.password.value;
    if (!password) return;
    const bottone = form.querySelector('button');
    bottone.disabled = true;
    bottone.textContent = 'Apro…';
    errore.textContent = '';
    try {
      const chiave = await chiaveDallaPassword(password);
      const ponte = await apri(chiave);
      try { localStorage.setItem(SALVATA, JSON.stringify({ sale: cassaforte.sale, chiave: aB64(await crypto.subtle.exportKey('raw', chiave)) })); } catch (err) { /* si apre lo stesso */ }
      parti(ponte);
    } catch (err) {
      bottone.disabled = false;
      bottone.textContent = 'Apri';
      chiedi('Password sbagliata. Riprova.');
      form.elements.password.select();
    }
  });

  (async () => {
    // solo per le prove sul Mac: la Serra di prova parla col ponte finto senza lucchetto
    if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
      try {
        const prova = await (await fetch('ponte-prova.json', { cache: 'no-store' })).json();
        if (prova && prova.indirizzo) return parti(prova);
      } catch (err) { /* niente prova: lucchetto normale */ }
    }
    try {
      cassaforte = await (await fetch('chiave.cifrata.json', { cache: 'no-cache' })).json();
    } catch (err) {
      chiedi('Manca la rete. Apri la Serra con internet almeno una volta.');
      form.querySelector('button').disabled = true;
      return;
    }
    let salvata = null;
    try { salvata = JSON.parse(localStorage.getItem(SALVATA)); } catch (err) { /* niente chiave salvata */ }
    if (salvata && salvata.sale === cassaforte.sale) {
      try {
        const chiave = await crypto.subtle.importKey('raw', daB64(salvata.chiave), 'AES-GCM', true, ['decrypt']);
        return parti(await apri(chiave));
      } catch (err) { /* chiave vecchia: si chiede la password */ }
    }
    chiedi(salvata ? 'La Serra è stata aggiornata: scrivi di nuovo la password.' : '');
  })();
})();
