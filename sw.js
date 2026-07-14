/* Service worker — «στρώμα» PWA. Δεν αγγίζει τη λογική της εφαρμογής.
   Στρατηγική: network-first (η εφαρμογή χρειάζεται ίντερνετ για OSRM /
   Overpass / Nominatim / tiles), αλλά cache-άρει το «κέλυφος» ώστε να
   ανοίγει γρήγορα και να παραμένει εγκαταστάσιμη.
   ΟΛΕΣ οι διαδρομές είναι ΣΧΕΤΙΚΕΣ ώστε να δουλεύουν μέσα από τον
   υποφάκελο /routes-with-speed-limit/. */

const CACHE = "nxd-shell-v1";

/* Το «κέλυφος» της εφαρμογής — μόνο τοπικά, same-origin αρχεία. */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  /* Μόνο GET· αφήνουμε ό,τι δεν είναι GET (π.χ. POST στο Overpass) να περάσει. */
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* Network-first: προσπαθούμε δίκτυο, με fallback στην cache όταν είμαστε
     offline ή ο server δεν αποκρίνεται. Cache-άρουμε μόνο same-origin
     επιτυχείς απαντήσεις (το κέλυφος), όχι τα εξωτερικά API/tiles. */
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (sameOrigin && res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          /* Για πλοήγηση offline, γυρνάμε το cached index ως fallback. */
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        })
      )
  );
});
