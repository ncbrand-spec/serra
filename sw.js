// Tiene la Serra sul telefono per aprirla anche senza rete. Il numero di VERSIONE lo cambia la pubblicazione.
const VERSIONE = 'serra-202610271317';
const FILE = ['./', 'index.html', 'telefono.css', 'telefono.js', 'lucchetto.js', 'regole.js', 'piante.js', 'chiave.cifrata.json',
  'manifest.webmanifest', 'icone/icona-180.png', 'icone/icona-192.png', 'icone/icona-512.png', 'icone/monogramma.png'];
const CARATTERI = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSIONE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;               // le richieste al ponte (POST) non si toccano
  const origine = new URL(e.request.url).origin;
  if (CARATTERI.includes(origine)) {                      // i caratteri non cambiano: presi una volta, poi dal telefono
    e.respondWith(caches.open(VERSIONE).then(async (c) => {
      const tenuto = await c.match(e.request);
      if (tenuto) return tenuto;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (origine !== location.origin) return;
  e.respondWith(caches.open(VERSIONE).then(async (c) => {   // la copia tenuta subito, e dietro la versione nuova per la prossima volta
    const tenuto = await c.match(e.request, { ignoreSearch: true });
    const rete = fetch(new Request(e.request.url, { cache: 'no-cache' })).then((r) => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }).catch(() => tenuto);
    return tenuto || rete;
  }));
});
