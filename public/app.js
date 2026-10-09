// State management
const state = {
  page: 1,
  limit: 24,
  query: '',
  sort: 'latest',
  view: 'feed', // 'feed' | 'bookmarks' | 'history'
  activeTag: '',
  totalPages: 1,
  totalVideos: 0,
  isLoading: false
};

// LocalStorage helpers
const storage = {
  getBookmarks: () => {
    try {
      return JSON.parse(localStorage.getItem('stream_bookmarks') || '[]');
    } catch {
      return [];
    }
  },
  saveBookmark: (video) => {
    const list = storage.getBookmarks();
    if (!list.some(v => v.id === video.id)) {
      list.unshift(video);
      localStorage.setItem('stream_bookmarks', JSON.stringify(list));
      showToast('Ditambahkan ke Favorit');
    }
  },
  removeBookmark: (id) => {
    const list = storage.getBookmarks().filter(v => v.id !== id);
    localStorage.setItem('stream_bookmarks', JSON.stringify(list));
    showToast('Dihapus dari Favorit');
  },
  isBookmarked: (id) => {
    return storage.getBookmarks().some(v => v.id === id);
  },
  getHistory: () => {
    try {
      return JSON.parse(localStorage.getItem('stream_history') || '[]');
    } catch {
      return [];
    }
  },
  addHistory: (video) => {
    let list = storage.getHistory().filter(v => v.id !== video.id);
    list.unshift({ ...video, watchedAt: Date.now() });
    if (list.length > 50) list = list.slice(0, 50);
    localStorage.setItem('stream_history', JSON.stringify(list));
  },
  clearHistory: () => {
    localStorage.removeItem('stream_history');
    showToast('Riwayat tontonan dibersihkan');
  }
};

// UI Elements
const videoGrid = document.getElementById('videoGrid');
const paginationContainer = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const totalCountBadge = document.getElementById('totalCountBadge');
const heroSection = document.getElementById('heroSection');
const heroTitle = document.getElementById('heroTitle');
const heroPlayBtn = document.getElementById('heroPlayBtn');
const heroRandomBtn = document.getElementById('heroRandomBtn');
const heroBookmarkBtn = document.getElementById('heroBookmarkBtn');
const pageTitle = document.getElementById('pageTitle');
const previewModal = document.getElementById('previewModal');
const previewIframe = document.getElementById('previewIframe');
const previewTitle = document.getElementById('previewTitle');
const previewWatchPageBtn = document.getElementById('previewWatchPageBtn');

let currentHeroVideo = null;
let searchTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initUrlParams();
  loadStats();
  loadFeaturedHero();
  renderTags();
  loadVideos();

  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.query = e.target.value.trim();
        state.page = 1;
        state.activeTag = '';
        highlightTag('');
        loadVideos();
      }, 350);
    });

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  // Sort change
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.page = 1;
      loadVideos();
    });
  }

  // Hero Random button
  if (heroRandomBtn) {
    heroRandomBtn.addEventListener('click', loadFeaturedHero);
  }

  // Hero Bookmark button
  if (heroBookmarkBtn) {
    heroBookmarkBtn.addEventListener('click', () => {
      if (!currentHeroVideo) return;
      if (storage.isBookmarked(currentHeroVideo.id)) {
        storage.removeBookmark(currentHeroVideo.id);
        updateHeroBookmarkBtn();
      } else {
        storage.saveBookmark(currentHeroVideo);
        updateHeroBookmarkBtn();
      }
    });
  }
});

function initUrlParams() {
  const url = new URL(window.location.href);
  const q = url.searchParams.get('q');
  const page = url.searchParams.get('page');
  const view = url.searchParams.get('view');

  if (q) {
    state.query = q;
    if (searchInput) searchInput.value = q;
  }
  if (page) state.page = parseInt(page) || 1;
  if (view && ['feed', 'bookmarks', 'history'].includes(view)) {
    state.view = view;
  }
}

// Fetch stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (totalCountBadge && data.totalVideos) {
      totalCountBadge.textContent = `${Number(data.totalVideos).toLocaleString()} Video`;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Fetch random video for Hero
async function loadFeaturedHero() {
  try {
    const res = await fetch('/api/random');
    const video = await res.json();
    if (!video || !video.id) return;
    
    currentHeroVideo = video;
    if (heroTitle) heroTitle.textContent = video.title;
    if (heroPlayBtn) heroPlayBtn.href = `/watch/${video.slug || video.id}`;
    
    // Background image
    if (heroSection) {
      const banner = heroSection.querySelector('.hero-backdrop');
      if (banner && video.image_url) {
        banner.style.backgroundImage = `url('${video.image_url}')`;
      }
    }
    updateHeroBookmarkBtn();
  } catch (err) {
    console.error('Failed to load hero random:', err);
  }
}

function updateHeroBookmarkBtn() {
  if (!heroBookmarkBtn || !currentHeroVideo) return;
  const isBookmarked = storage.isBookmarked(currentHeroVideo.id);
  heroBookmarkBtn.innerHTML = isBookmarked 
    ? `<i class="fa-solid fa-bookmark text-rose-500 mr-2"></i> Tersimpan`
    : `<i class="fa-regular fa-bookmark mr-2"></i> Simpan`;
}

// Quick filter tags
const POPULAR_TAGS = ['Semua', 'Viral', 'Cantik', 'Hot51', 'Mango', 'Dream', 'Janda', 'Tante', 'Pinay', 'Hijab', 'Live', 'Cosplay', 'Dildo', 'Tocil'];

function renderTags() {
  const container = document.getElementById('tagPills');
  if (!container) return;

  container.innerHTML = POPULAR_TAGS.map(tag => {
    const isActive = (tag === 'Semua' && !state.activeTag && !state.query) || (state.activeTag === tag);
    return `
      <button 
        type="button" 
        class="tag-pill px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition duration-200 ${isActive ? 'active' : ''}"
        onclick="selectTag('${tag}')"
      >
        ${tag}
      </button>
    `;
  }).join('');
}

function highlightTag(tag) {
  document.querySelectorAll('.tag-pill').forEach(btn => {
    if (btn.textContent.trim() === tag || (!tag && btn.textContent.trim() === 'Semua')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

window.selectTag = function(tag) {
  if (state.view !== 'feed') {
    setView('feed');
  }
  if (tag === 'Semua') {
    state.activeTag = '';
    state.query = '';
    if (searchInput) searchInput.value = '';
  } else {
    state.activeTag = tag;
    state.query = tag;
    if (searchInput) searchInput.value = tag;
  }
  state.page = 1;
  highlightTag(tag);
  loadVideos();
};

// Switch view: Feed / Bookmarks / History
window.setView = function(viewName) {
  state.view = viewName;
  state.page = 1;

  // Update tabs visual
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.view === viewName) {
      tab.classList.add('text-rose-500', 'border-rose-500');
      tab.classList.remove('text-zinc-400', 'border-transparent');
    } else {
      tab.classList.remove('text-rose-500', 'border-rose-500');
      tab.classList.add('text-zinc-400', 'border-transparent');
    }
  });

  if (viewName === 'bookmarks') {
    if (pageTitle) pageTitle.textContent = 'Daftar Favorit Saya';
    renderLocalList(storage.getBookmarks(), 'Belum ada video favorit yang disimpan.');
  } else if (viewName === 'history') {
    if (pageTitle) pageTitle.textContent = 'Riwayat Tontonan';
    renderLocalList(storage.getHistory(), 'Belum ada riwayat tontonan.');
  } else {
    if (pageTitle) pageTitle.textContent = state.query ? `Hasil Pencarian: "${state.query}"` : 'Katalog Video Terbaru';
    loadVideos();
  }
};

// Fetch and render videos from backend
async function loadVideos() {
  if (state.view !== 'feed') return;
  state.isLoading = true;
  renderSkeleton();

  try {
    const url = `/api/videos?page=${state.page}&limit=${state.limit}&q=${encodeURIComponent(state.query)}&sort=${state.sort}`;
    const res = await fetch(url);
    const data = await res.json();

    state.totalPages = data.pagination.totalPages;
    state.totalVideos = data.pagination.total;

    if (pageTitle) {
      if (state.query) {
        pageTitle.textContent = `Hasil Pencarian: "${state.query}" (${data.pagination.total.toLocaleString()} video)`;
      } else {
        pageTitle.textContent = `Katalog Video Terbaru (${data.pagination.total.toLocaleString()} video)`;
      }
    }

    renderGrid(data.items);
    renderPagination(data.pagination);
  } catch (err) {
    console.error('Failed to load videos:', err);
    if (videoGrid) {
      videoGrid.innerHTML = `
        <div class="col-span-full text-center py-16">
          <i class="fa-solid fa-triangle-exclamation text-4xl text-rose-500 mb-3"></i>
          <p class="text-zinc-400">Gagal memuat video. Silakan periksa koneksi atau coba beberapa saat lagi.</p>
        </div>
      `;
    }
  } finally {
    state.isLoading = false;
  }
}

// Render video cards
function renderGrid(videos) {
  if (!videoGrid) return;

  if (!videos || videos.length === 0) {
    videoGrid.innerHTML = `
      <div class="col-span-full text-center py-16">
        <i class="fa-solid fa-film text-4xl text-zinc-600 mb-3"></i>
        <h3 class="text-lg font-bold text-zinc-300">Tidak ada video ditemukan</h3>
        <p class="text-sm text-zinc-500 mt-1">Coba kata kunci pencarian yang lain.</p>
      </div>
    `;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  videoGrid.innerHTML = videos.map(video => {
    const bookmarked = storage.isBookmarked(video.id);
    const safeTitle = escapeHtml(video.title);
    const escapedVideoJson = encodeURIComponent(JSON.stringify(video));

    return `
      <div class="video-card rounded-xl overflow-hidden group flex flex-col justify-between" data-id="${video.id}">
        <!-- Poster & Play overlay -->
        <div class="video-thumb-wrapper cursor-pointer" onclick="handleCardClick('${video.slug || video.id}')">
          <img 
            src="${video.image_url || '/placeholder.svg'}" 
            alt="${safeTitle}" 
            loading="lazy" 
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='/placeholder.svg';"
          />
          <div class="play-overlay">
            <div class="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center transform group-hover:scale-110 transition duration-300 shadow-lg shadow-rose-600/50">
              <i class="fa-solid fa-play text-lg ml-0.5"></i>
            </div>
          </div>
          <span class="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded uppercase tracking-wider border border-white/10">
            HD
          </span>
          <span class="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md text-[11px] font-medium text-zinc-300 px-2 py-0.5 rounded border border-white/10">
            #${video.id}
          </span>
        </div>

        <!-- Info & Actions -->
        <div class="p-3.5 flex flex-col justify-between flex-1">
          <a href="/watch/${video.slug || video.id}" class="hover:text-rose-400 transition" title="${safeTitle}">
            <h4 class="text-sm font-semibold text-zinc-200 line-clamp-2 leading-snug mb-3">
              ${safeTitle}
            </h4>
          </a>

          <div class="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
            <button 
              type="button" 
              class="hover:text-white transition flex items-center gap-1.5"
              onclick="openPreviewModal('${escapedVideoJson}')"
              title="Preview Cepat"
            >
              <i class="fa-regular fa-eye text-zinc-400"></i>
              <span>Preview</span>
            </button>

            <button 
              type="button" 
              class="hover:scale-110 transition text-sm p-1 ${bookmarked ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}"
              onclick="toggleBookmarkCard(event, '${escapedVideoJson}')"
              title="${bookmarked ? 'Hapus Bookmark' : 'Simpan Bookmark'}"
            >
              <i class="${bookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Card click redirects to watch page
window.handleCardClick = function(idOrSlug) {
  window.location.href = `/watch/${idOrSlug}`;
};

// Toggle bookmark on card
window.toggleBookmarkCard = function(e, escapedVideoJson) {
  e.stopPropagation();
  const video = JSON.parse(decodeURIComponent(escapedVideoJson));
  const isBookmarked = storage.isBookmarked(video.id);

  if (isBookmarked) {
    storage.removeBookmark(video.id);
  } else {
    storage.saveBookmark(video);
  }

  // Update card icon
  const card = document.querySelector(`.video-card[data-id="${video.id}"]`);
  if (card) {
    const btn = card.querySelector('button[title*="Bookmark"]');
    if (btn) {
      if (!isBookmarked) {
        btn.classList.remove('text-zinc-500');
        btn.classList.add('text-rose-500');
        btn.innerHTML = `<i class="fa-solid fa-bookmark"></i>`;
        btn.title = 'Hapus Bookmark';
      } else {
        btn.classList.add('text-zinc-500');
        btn.classList.remove('text-rose-500');
        btn.innerHTML = `<i class="fa-regular fa-bookmark"></i>`;
        btn.title = 'Simpan Bookmark';
      }
    }
  }

  // If currently viewing bookmarks, re-render
  if (state.view === 'bookmarks') {
    renderLocalList(storage.getBookmarks(), 'Belum ada video favorit yang disimpan.');
  }
};

// Render LocalStorage list (Bookmarks / History)
function renderLocalList(items, emptyMsg) {
  if (paginationContainer) paginationContainer.innerHTML = '';
  if (!videoGrid) return;

  if (!items || items.length === 0) {
    videoGrid.innerHTML = `
      <div class="col-span-full text-center py-20">
        <i class="fa-solid fa-folder-open text-5xl text-zinc-700 mb-4"></i>
        <h3 class="text-base font-bold text-zinc-300">${emptyMsg}</h3>
        <button 
          type="button" 
          class="mt-4 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
          onclick="setView('feed')"
        >
          Jelajahi Video
        </button>
      </div>
    `;
    return;
  }

  renderGrid(items);
}

// Quick preview modal
window.openPreviewModal = function(escapedVideoJson) {
  const video = JSON.parse(decodeURIComponent(escapedVideoJson));
  if (!previewModal || !previewIframe) return;

  previewTitle.textContent = video.title;
  previewIframe.src = video.iframe_url;
  previewWatchPageBtn.href = `/watch/${video.slug || video.id}`;
  previewModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  storage.addHistory(video);
};

window.closePreviewModal = function() {
  if (!previewModal || !previewIframe) return;
  previewIframe.src = '';
  previewModal.classList.add('hidden');
  document.body.style.overflow = '';
};

// Skeleton loading effect
function renderSkeleton() {
  if (!videoGrid) return;
  const skeletons = Array.from({ length: 12 }).map(() => `
    <div class="rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40">
      <div class="aspect-video skeleton"></div>
      <div class="p-3 space-y-2">
        <div class="h-4 skeleton rounded w-5/6"></div>
        <div class="h-3 skeleton rounded w-2/3"></div>
      </div>
    </div>
  `).join('');
  videoGrid.innerHTML = skeletons;
}

// Pagination rendering
function renderPagination(pagination) {
  if (!paginationContainer) return;
  const { page, totalPages } = pagination;
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }

  let html = `<div class="flex flex-wrap items-center justify-center gap-1.5 text-xs font-medium">`;

  // First & Prev
  if (page > 1) {
    html += `
      <button class="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition" onclick="goToPage(1)" title="Halaman Pertama">
        <i class="fa-solid fa-angles-left"></i>
      </button>
      <button class="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition" onclick="goToPage(${page - 1})" title="Sebelumnya">
        <i class="fa-solid fa-chevron-left mr-1"></i> Prev
      </button>
    `;
  }

  // Calculate sliding page window
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  if (start > 1) {
    html += `<span class="px-2 text-zinc-600">...</span>`;
  }

  for (let i = start; i <= end; i++) {
    const isCurrent = i === page;
    html += `
      <button 
        class="w-8 h-8 rounded-lg flex items-center justify-center transition ${isCurrent ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30' : 'border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300'}"
        onclick="goToPage(${i})"
      >
        ${i}
      </button>
    `;
  }

  if (end < totalPages) {
    html += `<span class="px-2 text-zinc-600">...</span>`;
  }

  // Next & Last
  if (page < totalPages) {
    html += `
      <button class="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition" onclick="goToPage(${page + 1})" title="Selanjutnya">
        Next <i class="fa-solid fa-chevron-right ml-1"></i>
      </button>
      <button class="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition" onclick="goToPage(${totalPages})" title="Halaman Terakhir">
        <i class="fa-solid fa-angles-right"></i>
      </button>
    `;
  }

  // Jump to page input
  html += `
    <div class="ml-3 flex items-center gap-1.5">
      <span class="text-zinc-500">Hal</span>
      <input 
        type="number" 
        min="1" 
        max="${totalPages}" 
        value="${page}" 
        class="w-14 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-center text-zinc-200 text-xs focus:outline-none focus:border-rose-500"
        onkeydown="if(event.key === 'Enter') goToPage(this.value)"
      />
      <span class="text-zinc-500">/ ${totalPages.toLocaleString()}</span>
    </div>
  `;

  html += `</div>`;
  paginationContainer.innerHTML = html;
}

window.goToPage = function(p) {
  const pageNum = parseInt(p);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > state.totalPages) return;
  state.page = pageNum;
  loadVideos();
  window.scrollTo({ top: heroSection ? heroSection.offsetTop + heroSection.offsetHeight : 0, behavior: 'smooth' });
};

// Toast notification
function showToast(message) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-zinc-700/80 text-white text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 transform translate-y-10 opacity-0 transition duration-300';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<i class="fa-solid fa-circle-check text-rose-500 text-sm"></i> <span>${message}</span>`;
  toast.classList.remove('translate-y-10', 'opacity-0');

  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0');
  }, 2400);
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
