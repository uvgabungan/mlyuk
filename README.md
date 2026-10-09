# StreamHub - Video Streaming Portal & Auto Indexing Engine

Portal website streaming video performa tinggi dengan **19,200+ Video**, dibangun dan di-deploy langsung ke **Vercel** dengan dukungan penuh **Auto Indexing (Google, Microsoft Bing, Yandex)**.

---

## 🌐 Live Production URL (Vercel)

- **Website Utama**: [https://streaming-web-zeta.vercel.app](https://streaming-web-zeta.vercel.app)
- **Auto Indexing Control Center**: [https://streaming-web-zeta.vercel.app/indexing](https://streaming-web-zeta.vercel.app/indexing)
- **Sitemap Index XML**: [https://streaming-web-zeta.vercel.app/sitemap.xml](https://streaming-web-zeta.vercel.app/sitemap.xml)
- **Robots.txt**: [https://streaming-web-zeta.vercel.app/robots.txt](https://streaming-web-zeta.vercel.app/robots.txt)
- **IndexNow Key**: [https://streaming-web-zeta.vercel.app/streamhubindexnow2026auto789.txt](https://streaming-web-zeta.vercel.app/streamhubindexnow2026auto789.txt)

---

## 🚀 Fitur Utama

### 1. Streaming & Video Experience
- **19,200 Video Terindeks**: Seluruh data dari dataset CSV telah dikonversi dan diindeks secara in-memory dengan pencarian instan (<4ms).
- **Dark Cinematic UI**: Desain antarmuka modern bernuansa gelap (Netflix / Cinema theme) responsif untuk smartphone, tablet, dan desktop.
- **Embedded Player Responfif**: Mendukung pemutar video fleksibel dengan mode Theater, Fullscreen, mode Reload, dan Anti-Popup sandbox toggle.
- **Fitur Favorit & Riwayat**: Penyimpanan lokal (LocalStorage) untuk video favorit dan riwayat tontonan tanpa perlu login.
- **Video Terkait & Mode Acak**: Rekomendasi video terkait berbasis kata kunci judul dan tombol acak (*Surprise Me*).

### 2. Dukungan Penuh Auto Indexing (Yandex, Bing, Google)
- **Protokol IndexNow (Microsoft Bing & Yandex)**:
  - Mengirim URL baru/update secara real-time langsung ke API `api.indexnow.org`, `bing.com/indexnow`, dan `yandex.com/indexnow`.
  - Berhasil terverifikasi dengan respon live `HTTP 202 Accepted`!
  - Key verifikasi otomatis tersedia di `/streamhubindexnow2026auto789.txt`.
- **Google Video SEO & Rich Snippets**:
  - Injeksi Server-Side Rendering (SSR) untuk tag `<script type="application/ld+json">` berskema **`VideoObject`** pada setiap halaman tontonan (`/watch/:slug`).
  - Mendukung Open Graph Video (`og:video`), Twitter Player Cards (`twitter:card=player`), canonical tags, dan meta deskripsi unik.
- **Dynamic XML Sitemaps**:
  - `/sitemap.xml`: Master Sitemap Index.
  - `/sitemap/pages.xml`: Sitemap halaman statis.
  - `/sitemap/videos-1.xml` s/d `videos-4.xml`: Chunk sitemap lengkap dengan ekstensi `<video:video>` (Google Video Sitemap 1.1).
  - `/sitemap-all.xml`: Seluruh 19,200 URL dalam satu file sitemap terpadu.
- **Dynamic Robots.txt**:
  - Konfigurasi ramah perayap untuk Googlebot, Googlebot-Video, Yandex, YandexBot, dan Bingbot.
- **Dashboard Kontrol Auto-Indexing (`/indexing`)**:
  - Antarmuka web satu-klik untuk mengirim 50, 500, hingga ribuan URL sekaligus ke Bing & Yandex via IndexNow.
  - Konsol log live untuk memantau status respon HTTP dari mesin pencari.
  - Tombol salin sitemap untuk pendaftaran di Google Search Console & Yandex Webmaster.

---

## 💻 Menjalankan Secara Lokal

```bash
cd streaming-web
npm install
npm start
```
Buka browser di `http://localhost:3000`.

---

## 📦 Deploy ke Vercel

```bash
vercel --prod
```
Proyek sudah terkonfigurasi dengan `vercel.json` dan siap di-deploy kapan saja.
