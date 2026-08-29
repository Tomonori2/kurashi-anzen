// Service Worker＝アプリを裏で支える小さなプログラム。
// ①一度開いたファイルを保存しておき、電波が悪くても画面が開けるようにする
// ②電話アプリなどの「共有」から送られてきた録音ファイルを受け取る
//
// 中身を変えて公開するときは、下の CACHE の数字（v1→v2…）を必ず1つ増やすこと。
// 増やさないと、スマホが古い版を使い続けます。
const CACHE = 'kurashi-anzen-v2';
const SHARE_CACHE = 'kurashi-anzen-share';
const SHARE_KEY = 'shared-audio-file';
const SHELL = [
  './', 'index.html', 'manifest.json',
  'icon-192.png', 'icon-512.png',
  'knowledge.js', 'news_data.js', 'curated_news.js', 'curated_danger_numbers.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)))
    )
  );
});

// 電話アプリなどの「共有」から音声ファイルが送られてきた時の受け口。
// 受け取ったファイルを一時的にキャッシュへ置き、画面側が拾いに来るのを待つ。
async function handleShare(e) {
  const formData = await e.request.formData();
  const file = formData.get('file');
  if (!file) return;

  const headers = {
    'Content-Type': file.type || 'application/octet-stream',
    'X-Shared-Filename': encodeURIComponent(file.name || '共有された録音')
  };
  const cache = await caches.open(SHARE_CACHE);
  await cache.put(SHARE_KEY, new Response(file, { headers }));

  // 遷移先の画面が確定していれば、すぐに合図を送る（画面側は ?shared=1 での起動チェックと
  // この合図の両方を見て、どちらか先に来た方で拾う）
  const client = await self.clients.get(e.resultingClientId).catch(() => null);
  if (client) client.postMessage({ type: 'shared-file-ready' });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target/')) {
    e.respondWith(Response.redirect('./?shared=1', 303));
    e.waitUntil(handleShare(e).catch(() => {}));
    return;
  }

  // AI（Gemini）との通信は保存せず、そのまま通す
  if (url.origin !== self.location.origin) return;

  // まずネットから取りに行き、つながらなければ保存版を出す。
  // この順番なので、知識を更新して公開すればスマホ側も自動で新しくなる。
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
