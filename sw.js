// ============================================
// SERVICE WORKER — PWA OFFLINE + KESH
// ============================================

const CACHE_NAME = 'kv-boshqaruv-v1';

// Keshga olinadigan fayllar
const CACHE_FILES = [
  'index.html',
  'asosiy.css',
  'asosiy.js',
  'ijarachi.html',
  'ijarachi.css',
  'ijarachi.js',
  'xarajat.html',
  'xarajat.css',
  'xarajat.js',
  'hisobot.html',
  'hisobot.css',
  'hisobot.js',
  'navbatchi.html',
  'navbatchi.css',
  'navbatchi.js',
  'config.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// O'rnatish — fayllarni keshga olish
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_FILES).catch(err => {
        console.warn('Ba\'zi fayllar keshga olinmadi:', err);
      });
    })
  );
  self.skipWaiting();
});

// Faollashtirish — eski keshlarni tozalash
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// So'rovlarni ushlash
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase so'rovlari — faqat online (keshlamaymiz)
  if (url.hostname.includes('supabase.co')) {
    return; // brauzer o'zi hal qiladi
  }

  // Boshqa so'rovlar — avval kesh, keyin tarmoq
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Muvaffaqiyatli javobni keshga ol
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline — asosiy.html ni qaytarish
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});