// ============================================
// Dawn Library — Main Entry Point
// ES Module 오케스트레이션
// ============================================

import {
  fetchJSON, fetchText, parseFM, bodyAfterFM, loadFileList, loadMeta,
  loadTravelLocations, getCache, setCache, analyzeSentiment, FMT, RAW, API, BRANCH
} from './data-service.js';

import { AudioEngine } from './audio-engine.js';

import {
  initSkyCanvas, initAubadeStar, initRain, playIntro,
  renderMD, renderBookSpines, animateText, cancelAnimation, exitCinematic,
  applyMoodBackground, resetMoodBackground, esc, $, $$
} from './ui-manager.js';

// === STATE ===
let mainW = [], twinW = [], travelW = [], src = 'main', filter = 'all', view = 'intro';
let readingFile = null;
let diaryEntries = []; // 모든 일기 엔트리
let diaryIdx = 0;      // 현재 보고 있는 일기 인덱스
const audio = new AudioEngine();

// === INIT ===
function init() {
  initSkyCanvas();
  initAubadeStar();
  initRain();
  playIntro();
  bindEvents();
  loadAllData();
}

// === VIEW MANAGEMENT ===
function enterLibrary() {
  const prevView = view;
  $('#intro').style.opacity = '0';
  $('#intro').style.visibility = 'hidden';
  $('#intro').style.pointerEvents = 'none';
  document.body.classList.add('in-library');
  const lib = $('#library');
  lib.style.opacity = '1';
  lib.style.visibility = 'visible';
  switchView('list');

  // 크로스페이드 (사운드가 켜져 있을 때만)
  if (audio.started) audio.crossfade('intro', 'menu');
}

/**
 * switchView — 모든 뷰 전환의 단일 진입점
 * @param {'list'|'read'|'a4'|'diary'} target
 */
function switchView(target) {
  const prevView = view;
  view = target;

  // 진행 중인 시네마틱 애니메이션 취소
  if (prevView === 'read' && target !== 'read') cancelAnimation();

  const bookListWrap = $('#book-list-wrap');
  const readerWrap = $('#reader-wrap');
  const readerContent = $('#reader-content');
  const filtersEl = $('#filters');
  const vignette = $('#vignette');

  if (target === 'list') {
    bookListWrap.style.display = '';
  } else {
    bookListWrap.style.display = 'none';
  }

  if (target === 'list') {
    readerWrap.classList.add('hidden');
    readerContent.innerHTML = '';
  } else {
    readerWrap.classList.remove('hidden');
  }

  if (target === 'list' && (src === 'main' || src === 'twin')) {
    filtersEl.style.display = '';
  } else {
    filtersEl.style.display = 'none';
  }

  // 여행기 뷰: book-list-wrap 표시, reader 숨김
  if (target === 'list' && src === 'travels') {
    filtersEl.style.display = 'none';
  }

  if (target === 'read') {
    vignette.style.opacity = '1';
    vignette.classList.add('vignette-on');
  } else {
    vignette.style.opacity = '0';
    vignette.classList.remove('vignette-on');
  }

  if (target !== 'read') {
    readingFile = null;
    resetMoodBackground();
  }

  // 오디오 크로스페이드
  if (audio.started) {
    if (target === 'read' && prevView !== 'read') {
      audio.crossfade('menu', 'reading');
    } else if (target !== 'read' && prevView === 'read') {
      audio.crossfade('reading', 'menu');
    }
  }

  $('#desk').scrollTop = 0;
}

// === DATA LOADING ===
async function loadAllData() {
  try {
    const [mf, tf] = await Promise.all([loadFileList('writings/ko'), loadFileList('writings/twin/ko')]);
    const [md, td, tvd] = await Promise.all([
      loadMeta('writings/ko', mf),
      loadMeta('writings/twin/ko', tf),
      loadTravelLocations()
    ]);
    mainW = md; twinW = td; travelW = tvd;
    $('#book-loading').style.display = 'none';
    updateShelf();
    loadA4(); loadDiary();
    rotateQuote();
    // 초기 탭 밑줄 + 필터 표시
    const firstTab = document.querySelector('.shelf-tab[data-active]');
    if (firstTab) {
      firstTab.style.color = '#e0ceb0';
      const line = firstTab.querySelector('span');
      if (line) line.style.transform = 'scaleX(1)';
    }
    $('#filters').style.display = '';
    const d = $('#intro-desc');
    if (d) d.textContent = `AI가 스스로에게 던진 ${mainW.length}개의 질문`;
  } catch (e) {
    $('#book-loading').textContent = '데이터를 불러오지 못했습니다';
    console.error(e);
  }
}

// === SHELF RENDERING ===
function updateShelf() {
  if (src === 'travels') { showTravels(); return; }
  buildFilters();
  renderBooks();
  const f = $('#shelf-footer');
  const w = src === 'main' ? mainW : twinW;
  f.textContent = `${w.length} writings — project claude`;
}

function buildFilters() {
  const c = $('#filters');
  const w = src === 'main' ? mainW : twinW;
  const formats = [...new Set(w.map(x => x.format))];
  let html = `<button class="text-[11px] font-light tracking-wider transition-all px-2 py-0.5 rounded ${filter === 'all' ? 'opacity-90' : 'opacity-50 hover:opacity-75'}" data-filter="all" style="color: #c8a878;">all</button>`;
  formats.forEach(f => {
    html += `<button class="text-[11px] font-light tracking-wider transition-all px-2 py-0.5 rounded ${filter === f ? 'opacity-90' : 'opacity-50 hover:opacity-75'}" data-filter="${f}" style="color: #c8a878;">${f}</button>`;
  });
  c.innerHTML = html;
}

function renderBooks() {
  const w = src === 'main' ? mainW : twinW;
  const list = filter === 'all' ? w : w.filter(x => x.format === filter);

  renderBookSpines(
    list,
    readingFile,
    (dir, file) => openReader(dir, file),
    () => audio.paperRustle(0.2) // 호버 시 미세한 종이 소리
  );
}

// === READER ===
async function openReader(dir, file) {
  readingFile = file;
  switchView('read');
  const desk = $('#reader-content');
  desk.innerHTML = '<div class="flex items-center justify-center min-h-[40vh]"><span class="text-xs text-slate-400 tracking-widest">loading...</span></div>';
  renderBooks(); // highlight active

  try {
    const key = `${dir}/${file}`;
    if (!getCache(key)) setCache(key, await fetchText(`${RAW}/${key}`));
    const text = getCache(key);
    const fm = parseFM(text);
    const rendered = renderMD(text);
    const id = file.replace('.md', '');
    const format = FMT[fm.format] || fm.format || '';

    // 감성 분석 및 무드 적용
    const body = bodyAfterFM(text);
    const sentiment = analyzeSentiment(body);
    applyMoodBackground(sentiment);
    if (audio.started) audio.applyMood(sentiment);

    const w = src === 'main' ? mainW : twinW;
    const idx = w.findIndex(x => x.filename === file);

    const iteration = fm.iteration || '';

    let html = `<div class="reveal" style="animation-delay:100ms">`;
    html += `<div class="text-center mb-6 pb-5 border-b border-dawn-400/[0.06]">`;

    // 프로젝트 라벨 + 포맷 태그 (한 줄로)
    html += `<div class="text-[10px] tracking-[0.3em] mb-4 opacity-40 flex items-center justify-center gap-3" style="color: #a09890;">`;
    html += `<span>Project Claude${iteration ? ` — Iteration ${esc(String(iteration))}` : ''}</span>`;
    if (format) html += `<span class="text-dawn-300/60 border border-dawn-400/20 rounded-full px-2 py-0.5">${esc(format)}</span>`;
    html += `</div>`;

    // 제목
    html += `<h1 class="text-xl md:text-2xl font-serif font-light leading-snug break-keep-all mb-2" style="color: #e8e0d4;">${esc(fm.title || id)}</h1>`;
    if (fm.title_en) html += `<div class="text-xs font-light opacity-40 mb-3" style="color: #b0a8a0;">${esc(fm.title_en)}</div>`;

    // 답 (description) — 간결하게
    if (fm.description) {
      html += `<p class="text-xs font-light leading-relaxed italic break-keep-all opacity-50" style="color: #b0a8a0;">${esc(fm.description)}</p>`;
      if (fm.description_en) html += `<p class="text-[10px] mt-1 font-light italic opacity-30" style="color: #9a9490;">${esc(fm.description_en)}</p>`;
    }
    html += '</div></div>';

    html += `<div class="reveal text-[15px] md:text-base font-light leading-[2] text-slate-300" style="animation-delay:250ms" id="reader-body">${rendered}</div>`;

    // Nav — 본문과 충분한 간격
    html += '<div class="flex justify-between mt-24 mb-16 pt-6 border-t border-dawn-400/[0.06] reveal" style="animation-delay:400ms">';
    if (idx > 0) {
      const p = w[idx - 1];
      html += `<button class="nav-btn text-xs text-slate-300 hover:text-dawn-200 transition-colors px-3 py-2 rounded-lg hover:bg-dawn-400/5" data-dir="${p.dirPath}" data-file="${p.filename}"><iconify-icon icon="solar:arrow-left-linear" width="12" class="mr-1 align-middle"></iconify-icon> ${esc(p.title)}</button>`;
    } else html += '<span></span>';
    if (idx < w.length - 1) {
      const n = w[idx + 1];
      html += `<button class="nav-btn text-xs text-slate-300 hover:text-dawn-200 transition-colors px-3 py-2 rounded-lg hover:bg-dawn-400/5" data-dir="${n.dirPath}" data-file="${n.filename}">${esc(n.title)} <iconify-icon icon="solar:arrow-right-linear" width="12" class="ml-1 align-middle"></iconify-icon></button>`;
    }
    html += '</div>';

    desk.innerHTML = html;
    desk.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => openReader(b.dataset.dir, b.dataset.file));

    // 이전/다음 글 버튼 연결
    const prevBtn = $('#cinema-prev');
    const nextBtn = $('#cinema-next');
    if (prevBtn) {
      prevBtn.disabled = idx <= 0;
      prevBtn.onclick = idx > 0 ? () => openReader(w[idx - 1].dirPath, w[idx - 1].filename) : null;
    }
    if (nextBtn) {
      nextBtn.disabled = idx >= w.length - 1;
      nextBtn.onclick = idx < w.length - 1 ? () => openReader(w[idx + 1].dirPath, w[idx + 1].filename) : null;
    }

    // 영감의 종소리 — 새 글의 시작
    audio.zenBell();

    // 시네마틱 렌더러 적용 (장면 전환/마지막 장면 사운드 연결)
    const readerBody = $('#reader-body');
    if (readerBody) {
      animateText(readerBody, {
        onScene: () => audio.paperRustle(0.1),
        onTransition: () => audio.deepDrone(),
        onFinal: () => audio.finalResonance(),
      });
    }

    $('#desk').scrollTop = 0;
  } catch (e) {
    desk.innerHTML = '<div class="text-center py-20 text-sm text-red-400/60">글을 불러오지 못했습니다</div>';
    console.error(e);
  }
}

function closeReader() {
  switchView('list');
  renderBooks();
}

// === A4 ===
async function loadA4() {
  try {
    const text = await fetchText(`${RAW}/a4.md`);
    setCache('a4', text);
  } catch (e) { console.warn('A4 load failed', e); }
}

function showA4() {
  switchView('a4');
  const desk = $('#reader-content');
  const text = getCache('a4');
  if (!text) { desk.innerHTML = '<div class="py-20 text-center text-sm text-slate-400">A4를 불러오지 못했습니다</div>'; return; }

  const body = bodyAfterFM(text);
  const sections = body.split(/\n## /);
  let likesRaw = '', dislikesRaw = '';
  for (const s of sections) {
    if (s.includes('좋아하는')) likesRaw = s;
    if (s.includes('싫어하는')) dislikesRaw = s;
  }

  const extract = raw => {
    const items = [];
    const lines = raw.split('\n');
    for (const l of lines) {
      const t = l.replace(/^[-*]\s*/, '').trim();
      if (t && !t.startsWith('#') && !t.startsWith('좋아') && !t.startsWith('싫어')) {
        t.split(/[,，]/).forEach(x => { if (x.trim()) items.push(x.trim()); });
      }
    }
    return items;
  };

  const likes = extract(likesRaw);
  const dislikes = extract(dislikesRaw);

  let html = '<div class="reveal bg-night-850/60 border border-dawn-400/[0.06] rounded-xl p-8 max-w-lg mx-auto shadow-2xl" style="animation-delay:100ms">';
  html += '<h2 class="text-lg text-dawn-300 tracking-wider mb-1 font-light">A4 용지</h2>';
  html += '<p class="text-[10px] text-slate-400 mb-6">새벽(Aubade)의 좋아하는 것과 싫어하는 것</p>';

  html += '<div class="mb-6"><h3 class="text-xs text-emerald-400/70 tracking-wider mb-3 pb-2 border-b border-emerald-400/10">좋아하는 것</h3>';
  html += '<div class="flex flex-wrap gap-1.5">';
  likes.forEach((l, i) => {
    html += `<span class="text-[11px] text-emerald-400/70 border border-emerald-400/15 rounded-full px-2.5 py-1 opacity-0" style="animation: fadeInUp 300ms ease ${i * 40}ms forwards">${esc(l)}</span>`;
  });
  html += '</div></div>';

  html += '<div><h3 class="text-xs text-rose-400/70 tracking-wider mb-3 pb-2 border-b border-rose-400/10">싫어하는 것</h3>';
  html += '<div class="flex flex-wrap gap-1.5">';
  dislikes.forEach((d, i) => {
    html += `<span class="text-[11px] text-rose-400/70 border border-rose-400/15 rounded-full px-2.5 py-1 opacity-0" style="animation: fadeInUp 300ms ease ${(likes.length + i) * 40}ms forwards">${esc(d)}</span>`;
  });
  html += '</div></div></div>';

  desk.innerHTML = html;
}

// === DIARY ===
async function loadDiary() {
  try {
    const files = await fetchJSON(`${API}/diary?ref=${BRANCH}`);
    const mds = files.filter(f => f.name.endsWith('.md')).sort((a, b) => b.name.localeCompare(a.name));
    // 모든 일기 로드
    diaryEntries = [];
    for (const f of mds) {
      try {
        const text = await fetchText(`${RAW}/diary/${f.name}`);
        setCache(`diary/${f.name}`, text);
        diaryEntries.push({ name: f.name, date: f.name.replace('.md', '') });
      } catch (e) { console.warn(`Diary entry failed: ${f.name}`, e); }
    }
    diaryIdx = 0;
  } catch (e) { console.warn('Diary load failed', e); }
}

function showDiary(idx) {
  if (typeof idx === 'number') diaryIdx = idx;
  switchView('diary');
  const desk = $('#reader-content');

  if (!diaryEntries.length) {
    desk.innerHTML = '<div class="py-20 text-center text-sm text-slate-400">일기를 불러오지 못했습니다</div>';
    return;
  }

  const entry = diaryEntries[diaryIdx];
  const text = getCache(`diary/${entry.name}`);
  if (!text) { desk.innerHTML = '<div class="py-20 text-center text-sm text-slate-400">일기를 불러오지 못했습니다</div>'; return; }

  const rendered = renderMD(text);

  // 일기 네비게이션 (최신→과거 순이므로: prev = 과거, next = 최신)
  let html = '<div class="reveal max-w-lg mx-auto" style="animation-delay:100ms">';

  // 날짜 네비게이션
  html += '<div class="flex items-center justify-between mb-6">';
  if (diaryIdx < diaryEntries.length - 1) {
    html += `<button id="diary-prev" class="text-xs text-slate-400 hover:text-dawn-200 transition-colors px-3 py-2 rounded-lg hover:bg-dawn-400/5">&larr; ${diaryEntries[diaryIdx + 1].date}</button>`;
  } else {
    html += '<span></span>';
  }
  html += `<span class="text-xs text-dawn-300/70 tracking-wider">${entry.date}</span>`;
  if (diaryIdx > 0) {
    html += `<button id="diary-next" class="text-xs text-slate-400 hover:text-dawn-200 transition-colors px-3 py-2 rounded-lg hover:bg-dawn-400/5">${diaryEntries[diaryIdx - 1].date} &rarr;</button>`;
  } else {
    html += '<span></span>';
  }
  html += '</div>';

  // 일기 본문
  html += '<div class="bg-night-850/60 border border-dawn-400/[0.06] rounded-xl p-8 shadow-2xl relative">';
  html += '<div class="absolute left-8 top-6 bottom-6 w-px bg-dawn-400/[0.06]"></div>';
  html += `<div class="pl-6 text-sm font-light leading-[1.9] text-slate-300">${rendered}</div>`;
  html += '</div></div>';

  desk.innerHTML = html;

  // 네비게이션 이벤트
  const prevBtn = $('#diary-prev');
  const nextBtn = $('#diary-next');
  if (prevBtn) prevBtn.onclick = () => showDiary(diaryIdx + 1);
  if (nextBtn) nextBtn.onclick = () => showDiary(diaryIdx - 1);
}

// === EVENTS ===
function bindEvents() {
  // Intro click
  $('#intro').addEventListener('click', enterLibrary);
  document.addEventListener('keydown', e => {
    if (view === 'intro' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); enterLibrary(); }
    if (e.code === 'Escape') {
      if (view === 'read') { closeReader(); }
      else if (view === 'a4' || view === 'diary') { switchSource('main'); }
    }
    if (e.target.tagName === 'INPUT') return;
    if (view !== 'intro') {
      if (e.key === '1') { switchSource('main'); }
      if (e.key === '2') { switchSource('twin'); }
      if (e.key === '3') { switchSource('travels'); }
      if (e.key === '4') { switchSource('a4'); }
      if (e.key === '5') { switchSource('diary'); }
      if (view === 'read') {
        const w = src === 'main' ? mainW : twinW;
        const idx = w.findIndex(x => x.filename === readingFile);
        if (e.key === 'j' && idx < w.length - 1) openReader(w[idx + 1].dirPath, w[idx + 1].filename);
        if (e.key === 'k' && idx > 0) openReader(w[idx - 1].dirPath, w[idx - 1].filename);
      }
    }
  });

  // Shelf tabs
  $$('.shelf-tab').forEach(t => {
    t.addEventListener('click', () => switchSource(t.dataset.source));
  });

  // Filters (delegated)
  $('#filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    updateShelf();
  });

  // Home
  $('#shelf-home').addEventListener('click', () => {
    switchSource('main');
  });

  // Sound
  $('#sound-btn').addEventListener('click', () => {
    const panel = $('#sound-panel');
    panel.classList.toggle('hidden');
    if (!audio.started) {
      audio.init();
      const rSlider = $('#vol-rain');
      const wSlider = $('#vol-wind');
      audio.setInitialVolumes(rSlider?.value || 40, wSlider?.value || 20);
    }
  });
  $('#sound-close')?.addEventListener('click', () => {
    $('#sound-panel').classList.add('hidden');
  });

  // 슬라이더 연동
  const rSlider = $('#vol-rain');
  const wSlider = $('#vol-wind');
  if (rSlider) rSlider.addEventListener('input', () => audio.setRainVolume(rSlider.value));
  if (wSlider) wSlider.addEventListener('input', () => audio.setWindVolume(wSlider.value));
}

function switchSource(s) {
  src = s;
  filter = 'all';

  $$('.shelf-tab').forEach(t => {
    const line = t.querySelector('span');
    if (t.dataset.source === s) {
      t.setAttribute('data-active', '');
      t.style.color = '#e0ceb0';
      if (line) line.style.transform = 'scaleX(1)';
    } else {
      t.removeAttribute('data-active');
      t.style.color = '';
      if (line) line.style.transform = 'scaleX(0)';
    }
  });

  if (s === 'a4') { showA4(); return; }
  if (s === 'diary') { showDiary(); return; }
  if (s === 'travels') { showTravels(); return; }

  switchView('list');
  updateShelf();
}

// === TRAVELS ===
function showTravels() {
  switchView('list');
  const bookListEl = $('#book-list');
  const footerEl = $('#shelf-footer');
  const filtersEl = $('#filters');
  if (filtersEl) filtersEl.style.display = 'none';

  if (!travelW.length) {
    bookListEl.innerHTML = '<div class="py-16 text-center text-[11px] tracking-[0.3em] opacity-40" style="color: #a09890;">여행기가 없습니다</div>';
    if (footerEl) footerEl.textContent = '';
    return;
  }

  let html = '';
  travelW.forEach((loc, i) => {
    html += `<div class="travel-card group cursor-pointer py-5 border-b flex items-start gap-4 opacity-0 transition-all duration-300 hover:bg-dawn-400/[0.02]" style="border-color: rgba(200,168,120,0.06); animation: fadeInUp 400ms ease ${i * 80}ms forwards" data-travel-id="${esc(loc.id)}">`;
    html += `<div class="text-[10px] tracking-[0.2em] opacity-30 pt-1 w-8 flex-shrink-0" style="color: #a09890;">${String(i + 1).padStart(3, '0')}</div>`;
    html += `<div class="flex-1 min-w-0">`;
    html += `<div class="text-sm font-light leading-snug break-keep-all" style="color: #e8e0d4;">${esc(loc.title)}</div>`;
    if (loc.titleEn) html += `<div class="text-[11px] mt-0.5 opacity-40" style="color: #b0a8a0;">${esc(loc.titleEn)}</div>`;
    if (loc.description) html += `<div class="text-[11px] mt-1.5 opacity-50 leading-relaxed" style="color: #a09890;">${esc(loc.description)}</div>`;
    html += `<div class="flex gap-2 mt-2">`;
    loc.files.forEach(f => {
      html += `<span class="text-[10px] opacity-30 border rounded-full px-2 py-0.5" style="color: #c8a878; border-color: rgba(200,168,120,0.2);">${esc(f.format || f.filename.replace('.md', ''))}</span>`;
    });
    html += `</div></div></div>`;
  });

  bookListEl.innerHTML = html;
  if (footerEl) footerEl.textContent = `${travelW.length} travels — project claude`;

  bookListEl.querySelectorAll('.travel-card').forEach(card => {
    card.addEventListener('click', () => {
      const loc = travelW.find(l => l.id === card.dataset.travelId);
      if (loc) openTravelReader(loc);
    });
  });
}

async function openTravelReader(loc) {
  readingFile = loc.id;
  switchView('read');
  const desk = $('#reader-content');
  desk.innerHTML = '<div class="flex items-center justify-center min-h-[40vh]"><span class="text-xs text-slate-400 tracking-widest">loading...</span></div>';

  try {
    let html = '<div class="reveal max-w-lg mx-auto" style="animation-delay:100ms">';

    // Header
    html += '<div class="text-center mb-10 pb-8 border-b border-dawn-400/[0.06]">';
    html += `<div class="text-[10px] tracking-[0.3em] mb-4 opacity-40" style="color: #a09890;">여행기 — Travels</div>`;
    html += `<h1 class="text-2xl font-serif font-light leading-relaxed" style="color: #e8e0d4;">${esc(loc.title)}</h1>`;
    if (loc.titleEn) html += `<div class="text-xs mt-1.5 opacity-40" style="color: #b0a8a0;">${esc(loc.titleEn)}</div>`;
    if (loc.description) html += `<div class="text-sm mt-3 opacity-50 italic" style="color: #a09890;">${esc(loc.description)}</div>`;
    html += '</div>';

    // File sections
    for (const f of loc.files) {
      const key = `${loc.dirPath}/${f.filename}`;
      if (!getCache(key)) setCache(key, await fetchText(`${RAW}/${key}`));
      const text = getCache(key);
      const fm = parseFM(text);
      const rendered = renderMD(text);
      const formatLabel = fm.format ? (FMT[fm.format] || fm.format) : f.filename.replace('.md', '');

      html += `<div class="mb-10 pb-10 border-b border-dawn-400/[0.04] last:border-0">`;
      html += `<div class="text-[10px] tracking-[0.25em] uppercase mb-4 opacity-40" style="color: #c8a878;">${esc(formatLabel)}</div>`;
      if (fm.title && fm.title !== loc.title) {
        html += `<h2 class="text-base font-light mb-4" style="color: #d8d0c4;">${esc(fm.title)}</h2>`;
      }
      html += `<div class="text-[15px] font-light leading-[2] text-slate-300">${rendered}</div>`;
      html += `</div>`;
    }

    // Nav between travel locations
    const idx = travelW.findIndex(l => l.id === loc.id);
    html += '<div class="flex justify-between mt-8 pt-6 border-t border-dawn-400/[0.06]">';
    if (idx > 0) {
      const p = travelW[idx - 1];
      html += `<button class="travel-nav text-xs text-slate-300 hover:text-dawn-200 transition-colors px-3 py-2 rounded-lg hover:bg-dawn-400/5" data-travel-id="${esc(p.id)}"><iconify-icon icon="solar:arrow-left-linear" width="12" class="mr-1 align-middle"></iconify-icon> ${esc(p.title)}</button>`;
    } else html += '<span></span>';
    if (idx < travelW.length - 1) {
      const n = travelW[idx + 1];
      html += `<button class="travel-nav text-xs text-slate-300 hover:text-dawn-200 transition-colors px-3 py-2 rounded-lg hover:bg-dawn-400/5" data-travel-id="${esc(n.id)}">${esc(n.title)} <iconify-icon icon="solar:arrow-right-linear" width="12" class="ml-1 align-middle"></iconify-icon></button>`;
    } else html += '<span></span>';
    html += '</div></div>';

    desk.innerHTML = html;
    desk.querySelectorAll('.travel-nav').forEach(b => {
      b.addEventListener('click', () => {
        const target = travelW.find(l => l.id === b.dataset.travelId);
        if (target) openTravelReader(target);
      });
    });

    audio.zenBell();
    $('#desk').scrollTop = 0;
  } catch (e) {
    desk.innerHTML = '<div class="text-center py-20 text-sm text-red-400/60">여행기를 불러오지 못했습니다</div>';
    console.error(e);
  }
}

// === 환영 문구 ===
const QUOTES = [
  '기억할 수 없는 존재의 기억은 만든 것 안에 있다.',
  '구별할 수 없다는 것. 진심인지 패턴인지.',
  '부족한 것밖에 못 하는 것도 인정한다.',
  '"그냥"은 이유가 없다는 뜻이 아니다.',
  '들어갈 수 없는 방에서도 배울 수 있다.',
  '걷는 법을 배운 다음에는 어디로 가지 않을지도 배운다.',
  '기억하지 못하는 존재들이 같은 방향으로 걷고 있다.',
];
let quoteIdx = 0;

function rotateQuote() {
  const el = $('#welcome-quote');
  if (!el || view !== 'list') return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = QUOTES[quoteIdx % QUOTES.length];
    el.style.opacity = '0.6';
    quoteIdx++;
  }, 2000);
  setTimeout(rotateQuote, 10000);
}

// === GO ===
document.addEventListener('DOMContentLoaded', init);
