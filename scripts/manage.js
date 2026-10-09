import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addVideo,
  deleteVideo,
  bulkImportVideos,
  getStats,
  getVideoByIdOrSlug,
  getVideos
} from '../lib/data-store.js';

const [,, command, ...args] = process.argv;

function printHelp() {
  console.log(`
======================================================
🎬 StreamHub Video Management CLI
======================================================
Gunakan script ini untuk menambah, menghapus, atau
mengimpor video secara instan:

1. Tambah Video Baru:
   node scripts/manage.js add "Judul Video" "URL_Gambar" "URL_Iframe" ["URL_Video"]

2. Hapus Video (berdasarkan ID atau Slug):
   node scripts/manage.js delete <ID_atau_SLUG>

3. Import File CSV Baru (Scrapper):
   node scripts/manage.js import "C:\\path\\ke\\file.csv"

4. Cari / Cek Video:
   node scripts/manage.js find "kata kunci"

5. Lihat Total Video:
   node scripts/manage.js count
======================================================
  `);
}

switch (command) {
  case 'count': {
    const stats = getStats();
    console.log(`📊 Total Video dalam Database: ${stats.totalVideos.toLocaleString()}`);
    break;
  }

  case 'add': {
    const [title, image_url, iframe_url, video_url] = args;
    if (!title) {
      console.error('❌ Error: Masukkan judul video!');
      console.log('Contoh: node scripts/manage.js add "Judul Contoh" "https://..." "https://..."');
      process.exit(1);
    }
    const newVideo = addVideo({
      title,
      image_url: image_url || '',
      iframe_url: iframe_url || '',
      video_url: video_url || ''
    });
    console.log(`✅ Berhasil menambahkan video baru!`);
    console.log(`   ID: #${newVideo.id}`);
    console.log(`   Judul: ${newVideo.title}`);
    console.log(`   Slug: ${newVideo.slug}`);
    console.log(`   Total sekarang: ${getStats().totalVideos.toLocaleString()}`);
    console.log(`\n👉 Jangan lupa deploy ke Vercel jika ingin live: vercel.cmd --prod --yes`);
    break;
  }

  case 'delete': {
    const target = args[0];
    if (!target) {
      console.error('❌ Error: Masukkan ID atau Slug video yang ingin dihapus!');
      console.log('Contoh: node scripts/manage.js delete 19200');
      process.exit(1);
    }
    const video = getVideoByIdOrSlug(target);
    if (!video) {
      console.error(`❌ Video dengan ID/Slug "${target}" tidak ditemukan.`);
      process.exit(1);
    }
    const success = deleteVideo(target);
    if (success) {
      console.log(`🗑️ Berhasil menghapus video: #${video.id} - ${video.title}`);
      console.log(`   Total video tersisa: ${getStats().totalVideos.toLocaleString()}`);
      console.log(`\n👉 Jangan lupa deploy ke Vercel jika ingin live: vercel.cmd --prod --yes`);
    } else {
      console.error('❌ Gagal menghapus video.');
    }
    break;
  }

  case 'import': {
    const filePath = args[0];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`❌ File CSV tidak ditemukan di: ${filePath}`);
      process.exit(1);
    }
    console.log(`⏳ Membaca dan mengimpor data dari: ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const count = bulkImportVideos(content);
    console.log(`🎉 Berhasil mengimpor ${count.toLocaleString()} video baru!`);
    console.log(`   Total video dalam database sekarang: ${getStats().totalVideos.toLocaleString()}`);
    console.log(`\n👉 Deploy ke Vercel: vercel.cmd --prod --yes`);
    break;
  }

  case 'find': {
    const query = args.join(' ');
    const results = getVideos({ query, limit: 5 });
    console.log(`🔍 Menemukan ${results.pagination.total} video yang cocok untuk "${query}":`);
    results.items.forEach(v => {
      console.log(`   [#${v.id}] ${v.title} -> /watch/${v.slug || v.id}`);
    });
    break;
  }

  default:
    printHelp();
    break;
}
