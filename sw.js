// ── نسخه رو هر بار که index.html تغییر می‌کنی، یه عدد بالاتر بذار ──────────
var CACHE_VERSION = "v11";
var CACHE_NAME    = "ahoora-pwa-" + CACHE_VERSION;

// فقط آیکون و manifest کش میشن — index.html هیچوقت کش نمیشه
var STATIC_ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

// ── install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(STATIC_ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

// ── activate: کش‌های قدیمی رو پاک کن ─────────────────────────────────────────
self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

// ── fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;

  var url = req.url;

  // Firebase و API‌ها → هیچوقت کش نکن، همیشه network
  if(
    url.indexOf("firebasedatabase.app") !== -1 ||
    url.indexOf("firebase") !== -1 ||
    url.indexOf("jsonbin.io") !== -1 ||
    url.indexOf("imgbb.com") !== -1 ||
    url.indexOf("ocr.space") !== -1 ||
    url.indexOf("api.") !== -1
  ){
    event.respondWith(fetch(req));
    return;
  }

  // index.html → همیشه از network بگیر (network-first بدون کش)
  var isHTML = req.mode === "navigate" ||
               (req.headers.get("accept")||"").indexOf("text/html") !== -1 ||
               url.indexOf("index.html") !== -1;

  if(isHTML){
    event.respondWith(
      fetch(req).catch(function(){
        // فقط اگه آفلاین بود، از کش بده
        return caches.match("./index.html") || caches.match("./");
      })
    );
    return;
  }

  // بقیه (آیکون، فونت، leaflet CSS) → cache-first
  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        if(res && res.status === 200){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return new Response("", {status:408, statusText:"offline"});
      });
    })
  );
});
