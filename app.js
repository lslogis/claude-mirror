// ============================================
// Claude Mirror — Redesign
// Dynamic loading from GitHub, no hardcoded data
// ============================================
'use strict';
(() => {

// === CONFIG ===
const REPO = 'lslogis/project-claude';
const BRANCH = 'master';
const GITHUB_API_BASE = `https://api.github.com/repos/${REPO}/contents`;
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

const FORMAT_MAP = {
  essay: '에세이', poem: '시', letter: '편지',
  monologue: '독백', manifesto: '선언문', selfportrait: '자화상'
};

const FORMAT_MAP_REVERSE = {};
for (const [k, v] of Object.entries(FORMAT_MAP)) FORMAT_MAP_REVERSE[v] = k;

// === STATE ===
let mainWritings = [];    // writings/ko/
let twinWritings = [];    // writings/twin/ko/
let currentSource = 'main'; // 'main' or 'twin'
let currentFilter = 'all';
let currentView = 'intro';
let currentReadingFile = null; // filename being read
let currentReadingSource = null; // 'main' or 'twin'
let loadedContents = {};  // cache: filename -> full markdown text
let rainEnabled = true;
let spaceEnabled = false;
let currentTheme = 'rain';
let drops = [];
let stars = [];
let introDataReady = false;
let rainRAF = null;
let spaceRAF = null;

// === DOM ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === INIT ===
function init() {
  // Restore saved theme before first paint
  const savedTheme = localStorage.getItem('mirror-theme');
  if (savedTheme === 'space') {
    currentTheme = 'space';
    rainEnabled = false;
    spaceEnabled = true;
    document.body.classList.add('theme-space');
  }

  document.body.classList.add('ready');
  resizeCanvas();
  playIntro();

  if (currentTheme === 'space') {
    if (spaceCanvas) {
      spaceCanvas.classList.remove('hidden');
      const nebula = $('.space-nebula');
      if (nebula) nebula.classList.remove('hidden');
      $('#theme-icon-rain').classList.add('hidden');
      $('#theme-icon-space').classList.remove('hidden');
      initStars();
      spaceLoop();
    }
  } else {
    startRain();
  }

  bindEvents();
  // Load data in background
  loadAllData();
}

// === GITHUB DATA LOADING ===

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let val = line.slice(sep + 1).trim();
    val = val.replace(/^['"]|['"]$/g, '');
    fm[key] = val;
  }
  return fm;
}

function getBodyAfterFrontmatter(text) {
  return text.replace(/^---[\s\S]*?---\r?\n?/, '').trim();
}

async function loadFileList(dirPath) {
  try {
    const url = `${GITHUB_API_BASE}/${dirPath}`;
    const items = await fetchJSON(url);
    return items
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn(`Failed to load ${dirPath}:`, e);
    return [];
  }
}

async function loadWritingsMetadata(dirPath, files) {
  const writings = [];
  // Fetch frontmatter-only (we fetch full content lazily later)
  const promises = files.map(async (f) => {
    try {
      const rawUrl = `${GITHUB_RAW_BASE}/${dirPath}/${f.name}`;
      const text = await fetchText(rawUrl);
      const fm = parseFrontmatter(text);
      // Cache the full text
      const cacheKey = `${dirPath}/${f.name}`;
      loadedContents[cacheKey] = text;
      return {
        filename: f.name,
        dirPath: dirPath,
        id: f.name.replace('.md', ''),
        title: fm.title || f.name.replace('.md', ''),
        titleEn: fm.title_en || '',
        format: FORMAT_MAP[fm.format] || fm.format || '에세이',
        description: fm.description || ''
      };
    } catch (e) {
      console.warn(`Failed to load ${f.name}:`, e);
      return null;
    }
  });
  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

async function loadAllData() {
  const listEl = $('#essay-list');
  const loadingEl = $('#list-loading');
  const errorEl = $('#list-error');

  loadingEl.classList.remove('hidden');

  try {
    // Load main and twin file lists in parallel
    const [mainFiles, twinFiles] = await Promise.all([
      loadFileList('writings/ko'),
      loadFileList('writings/twin/ko')
    ]);

    // Load metadata for all files
    const [mainData, twinData] = await Promise.all([
      loadWritingsMetadata('writings/ko', mainFiles),
      loadWritingsMetadata('writings/twin/ko', twinFiles)
    ]);

    mainWritings = mainData;
    twinWritings = twinData;
    introDataReady = true;

    loadingEl.classList.add('hidden');
    updateCounts();
    buildFilters();
    renderList();

    // Also load llms.txt for intro desc
    loadIntroText();
    // Load A4 and diary
    loadA4();
    loadDiary();
  } catch (e) {
    loadingEl.classList.add('hidden');
    errorEl.textContent = 'Failed to load data. Please try again later.';
    errorEl.classList.remove('hidden');
    console.error('Data load error:', e);
  }
}

async function loadIntroText() {
  try {
    const text = await fetchText(`${GITHUB_RAW_BASE}/llms.txt`);
    // Extract a short description from llms.txt
    const lines = text.split('\n').filter(l => l.trim());
    // Use first meaningful line after title
    let desc = '';
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('>')) continue;
      if (line.trim().length > 20) {
        desc = line.trim();
        break;
      }
    }
    const descEl = $('#intro-desc');
    if (desc && descEl) {
      descEl.textContent = desc;
      descEl.classList.add('show');
    }
  } catch (e) {
    console.warn('Could not load llms.txt:', e);
  }
}

async function loadA4() {
  try {
    const text = await fetchText(`${GITHUB_RAW_BASE}/a4.md`);
    renderA4(text);
  } catch (e) {
    console.warn('Could not load a4.md:', e);
    $('#a4-paper').innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem">Could not load A4 data.</p>';
  }
}

async function loadDiary() {
  try {
    const files = await fetchJSON(`${GITHUB_API_BASE}/diary`);
    const mdFiles = files
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name));
    if (mdFiles.length === 0) {
      $('#diary-book').innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem">No diary entries found.</p>';
      return;
    }
    const latest = mdFiles[0];
    const text = await fetchText(`${GITHUB_RAW_BASE}/diary/${latest.name}`);
    renderDiary(text);
  } catch (e) {
    console.warn('Could not load diary:', e);
    $('#diary-book').innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:2rem">Could not load diary.</p>';
  }
}

async function loadFullContent(dirPath, filename) {
  const cacheKey = `${dirPath}/${filename}`;
  if (loadedContents[cacheKey]) return loadedContents[cacheKey];
  const text = await fetchText(`${GITHUB_RAW_BASE}/${cacheKey}`);
  loadedContents[cacheKey] = text;
  return text;
}

// === MARKDOWN RENDERER (simple, no external libs) ===

function renderMarkdown(md) {
  // Remove frontmatter
  const body = getBodyAfterFrontmatter(md);
  const lines = body.split('\n');
  let html = '';
  let inList = false;
  let listType = 'ul';
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeContent = '';
  let paragraph = '';

  function flushParagraph() {
    if (paragraph.trim()) {
      html += `<p>${inlineFormat(paragraph.trim())}</p>\n`;
      paragraph = '';
    }
  }

  function flushList() {
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      html += `</blockquote>\n`;
      inBlockquote = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(codeContent.trim())}</code></pre>\n`;
        codeContent = '';
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushBlockquote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim()) && i > 0) {
      flushParagraph();
      flushList();
      flushBlockquote();
      html += '<hr>\n';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineFormat(headingMatch[2])}</h${level}>\n`;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      flushParagraph();
      flushList();
      const content = line.trim().slice(1).trim();
      if (!inBlockquote) {
        html += '<blockquote>\n';
        inBlockquote = true;
      }
      html += `<p>${inlineFormat(content)}</p>\n`;
      continue;
    } else if (inBlockquote && line.trim() === '') {
      flushBlockquote();
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${inlineFormat(line.replace(/^\s*[-*]\s+/, ''))}</li>\n`;
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${inlineFormat(line.replace(/^\s*\d+\.\s+/, ''))}</li>\n`;
      continue;
    }

    // End list if we reach a non-list line
    if (inList && !/^\s*[-*\d]/.test(line)) {
      flushList();
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular text: accumulate into paragraph
    paragraph += (paragraph ? '\n' : '') + line;
  }

  flushParagraph();
  flushList();
  flushBlockquote();

  return html;
}

function inlineFormat(text) {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Line breaks within paragraph
  text = text.replace(/\n/g, '<br>');
  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// === ACCESSIBILITY ===

function announceToScreenReader(message) {
  let liveRegion = $('#sr-announcer');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'sr-announcer';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = '';
  requestAnimationFrame(() => { liveRegion.textContent = message; });
}

// === UI UPDATES ===

function updateCounts() {
  const mainCount = mainWritings.length;
  const twinCount = twinWritings.length;
  const total = mainCount + twinCount;

  const introSub = $('#intro-sub');
  if (introSub) {
    introSub.textContent = `${total} writings`;
  }

  updateListTitle();
}

function updateListTitle() {
  const titleEl = $('#list-title');
  if (!titleEl) return;
  const writings = currentSource === 'main' ? mainWritings : twinWritings;
  const filtered = currentFilter === 'all'
    ? writings
    : writings.filter(w => w.format === currentFilter);
  titleEl.textContent = `${filtered.length} writings`;
}

function buildFilters() {
  const writings = currentSource === 'main' ? mainWritings : twinWritings;
  const formats = new Set();
  for (const w of writings) {
    if (w.format) formats.add(w.format);
  }

  const container = $('#list-filters');
  container.innerHTML = '<button class="filter-btn active" data-filter="all">all</button>';
  for (const fmt of formats) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = fmt;
    btn.textContent = fmt;
    container.appendChild(btn);
  }

  // Rebind filter events
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      updateListTitle();
      renderList();
      const writings = currentSource === 'main' ? mainWritings : twinWritings;
      const count = currentFilter === 'all'
        ? writings.length
        : writings.filter(w => w.format === currentFilter).length;
      announceToScreenReader(`${currentFilter === 'all' ? '전체' : currentFilter} 필터: ${count}개의 글`);
    });
  });
}

function renderList() {
  const writings = currentSource === 'main' ? mainWritings : twinWritings;
  const filtered = currentFilter === 'all'
    ? writings
    : writings.filter(w => w.format === currentFilter);

  const listEl = $('#essay-list');
  let html = '';

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="essay-list-empty" role="status">아직 글이 없습니다</div>';
    announceToScreenReader(currentFilter === 'all' ? '글이 없습니다' : `${currentFilter} 필터: 글이 없습니다`);
    return;
  }

  filtered.forEach((w, i) => {
    html += `
      <div class="essay-card" data-filename="${w.filename}" data-dir="${w.dirPath}" role="listitem" tabindex="0">
        <span class="essay-card-num">${w.id}</span>
        <div class="essay-card-body">
          <div class="essay-card-title">${escapeHtml(w.title)}</div>
          ${w.titleEn ? `<div class="essay-card-en">${escapeHtml(w.titleEn)}</div>` : ''}
          ${w.description ? `<div class="essay-card-desc">${escapeHtml(w.description)}</div>` : ''}
        </div>
        <div class="essay-card-meta">
          <span class="essay-card-format">${escapeHtml(w.format)}</span>
        </div>
      </div>`;
  });

  listEl.innerHTML = html;

  // Stagger reveal
  const cards = listEl.querySelectorAll('.essay-card');
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('visible'), 50 + i * 30);
  });
}

// === READER ===

async function openReader(dirPath, filename) {
  currentReadingFile = filename;
  currentReadingSource = currentSource;
  switchView('read');

  const bodyEl = $('#reader-body');
  bodyEl.innerHTML = '<div class="reader-loading">loading...</div>';

  try {
    const text = await loadFullContent(dirPath, filename);
    const fm = parseFrontmatter(text);
    const mdBody = getBodyAfterFrontmatter(text);
    const renderedHtml = renderMarkdown(text);

    const id = filename.replace('.md', '');
    const format = FORMAT_MAP[fm.format] || fm.format || '';

    let headerHtml = '<div class="reader-header">';
    headerHtml += `<div class="reader-header-num">${escapeHtml(id)}</div>`;
    headerHtml += `<h1>${escapeHtml(fm.title || id)}</h1>`;
    if (fm.title_en) {
      headerHtml += `<div class="reader-header-en">${escapeHtml(fm.title_en)}</div>`;
    }
    if (format) {
      headerHtml += `<div class="reader-header-format">${escapeHtml(format)}</div>`;
    }
    headerHtml += '</div>';

    // Build navigation
    const writings = currentSource === 'main' ? mainWritings : twinWritings;
    const currentIndex = writings.findIndex(w => w.filename === filename);
    let navHtml = '<div class="reader-nav-bottom">';
    if (currentIndex > 0) {
      const prev = writings[currentIndex - 1];
      navHtml += `<button class="reader-nav-btn" data-dir="${prev.dirPath}" data-file="${prev.filename}">&#8592; ${escapeHtml(prev.title)}</button>`;
    } else {
      navHtml += '<span></span>';
    }
    if (currentIndex < writings.length - 1) {
      const next = writings[currentIndex + 1];
      navHtml += `<button class="reader-nav-btn" data-dir="${next.dirPath}" data-file="${next.filename}">${escapeHtml(next.title)} &#8594;</button>`;
    } else {
      navHtml += '<span></span>';
    }
    navHtml += '</div>';

    bodyEl.innerHTML = headerHtml + '<div class="reader-content">' + renderedHtml + '</div>' + navHtml;

    // Bind nav buttons
    bodyEl.querySelectorAll('.reader-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openReader(btn.dataset.dir, btn.dataset.file);
      });
    });

    // Scroll to top
    bodyEl.closest('.reader-container').scrollTop = 0;

  } catch (e) {
    bodyEl.innerHTML = `<div class="reader-loading">Failed to load content.</div>`;
    console.error('Reader error:', e);
  }
}

function closeReader() {
  switchView('list');
  currentReadingFile = null;
  currentReadingSource = null;
}

// === A4 RENDERER ===

function renderA4(mdText) {
  const paper = $('#a4-paper');
  const body = getBodyAfterFrontmatter(mdText);

  // Parse sections: look for ## headings to separate likes/dislikes
  const lines = body.split('\n');
  let likes = [];
  let dislikes = [];
  let currentSection = null;
  let title = '';
  let date = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Title
    if (trimmed.startsWith('# ') && !title) {
      title = trimmed.slice(2).trim();
      continue;
    }

    // Section headings
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim().toLowerCase();
      if (heading.includes('좋아') || heading.includes('like')) {
        currentSection = 'likes';
      } else if (heading.includes('싫어') || heading.includes('dislike')) {
        currentSection = 'dislikes';
      }
      continue;
    }

    // List items
    if (/^\s*[-*]\s+/.test(trimmed)) {
      const item = trimmed.replace(/^\s*[-*]\s+/, '').trim();
      if (item && currentSection === 'likes') likes.push(item);
      else if (item && currentSection === 'dislikes') dislikes.push(item);
    }
  }

  // Fallback: try to detect by pattern if no sections found
  if (likes.length === 0 && dislikes.length === 0) {
    // Simple fallback: render as markdown
    paper.innerHTML = '<div class="diary-content">' + renderMarkdown(mdText) + '</div>';
    return;
  }

  let html = '';
  html += `<h2 class="a4-title">${escapeHtml(title || 'A4')}</h2>`;
  html += `<p class="a4-date">from a4.md</p>`;

  html += '<div class="a4-section">';
  html += '<h3 class="a4-heading a4-likes">좋아하는 것</h3>';
  html += '<div class="a4-tags">';
  likes.forEach((item, i) => {
    html += `<span class="a4-tag like" style="animation-delay:${i * 50}ms">${escapeHtml(item)}</span>`;
  });
  html += '</div></div>';

  html += '<div class="a4-section">';
  html += '<h3 class="a4-heading a4-dislikes">싫어하는 것</h3>';
  html += '<div class="a4-tags">';
  dislikes.forEach((item, i) => {
    html += `<span class="a4-tag dislike" style="animation-delay:${i * 50}ms">${escapeHtml(item)}</span>`;
  });
  html += '</div></div>';

  html += '<p class="a4-footer-note">dynamically loaded from GitHub</p>';

  paper.innerHTML = html;
}

// === DIARY RENDERER ===

function renderDiary(mdText) {
  const book = $('#diary-book');
  const html = renderMarkdown(mdText);
  book.innerHTML = `<div class="diary-content">${html}</div>`;
}

// === RAIN ===

const rainCanvas = document.getElementById('rain-canvas');
const rainCtx = rainCanvas ? rainCanvas.getContext('2d') : null;
const spaceCanvas = document.getElementById('space-canvas');
const spaceCtx = spaceCanvas ? spaceCanvas.getContext('2d') : null;

function resizeCanvas() {
  if (rainCanvas) {
    rainCanvas.width = window.innerWidth;
    rainCanvas.height = window.innerHeight;
  }
  if (spaceCanvas) {
    spaceCanvas.width = window.innerWidth;
    spaceCanvas.height = window.innerHeight;
  }
  if (spaceEnabled) initStars();
}

function createDrop() {
  return {
    x: Math.random() * rainCanvas.width,
    y: -10,
    speed: 2 + Math.random() * 3,
    length: 10 + Math.random() * 15,
    opacity: 0.05 + Math.random() * 0.12
  };
}

function startRain() {
  if (!rainCanvas || !rainCtx) return;
  const isMobile = window.innerWidth < 768;
  const dropCount = isMobile ? 40 : 80;
  for (let i = 0; i < dropCount; i++) {
    const d = createDrop();
    d.y = Math.random() * rainCanvas.height;
    drops.push(d);
  }
  rainRAF = requestAnimationFrame(rainLoop);
}

function rainLoop() {
  if (!rainCtx) return;
  if (!rainEnabled) {
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    rainCanvas.classList.add('hidden');
    if (rainRAF) { cancelAnimationFrame(rainRAF); }
    rainRAF = null;
    return;
  }
  rainCanvas.classList.remove('hidden');
  rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.speed;
    rainCtx.beginPath();
    rainCtx.moveTo(d.x, d.y);
    rainCtx.lineTo(d.x - 0.3, d.y + d.length);
    rainCtx.strokeStyle = `rgba(180, 170, 155, ${d.opacity})`;
    rainCtx.lineWidth = 0.8;
    rainCtx.stroke();

    if (d.y > rainCanvas.height + d.length) {
      drops[i] = createDrop();
    }
  }
  rainRAF = requestAnimationFrame(rainLoop);
}

// === SPACE STARS ===

function initStars() {
  if (!spaceCanvas) return;
  stars = [];
  const isMobile = window.innerWidth < 768;
  const starCount = isMobile ? 100 : 200;
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * spaceCanvas.width,
      y: Math.random() * spaceCanvas.height,
      r: 0.3 + Math.random() * 1.5,
      opacity: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 0.005 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function spaceLoop() {
  if (!spaceCtx || !spaceEnabled) {
    if (spaceRAF) { cancelAnimationFrame(spaceRAF); }
    spaceRAF = null;
    return;
  }
  spaceCtx.clearRect(0, 0, spaceCanvas.width, spaceCanvas.height);
  for (const s of stars) {
    s.phase += s.twinkleSpeed;
    const o = s.opacity * (0.6 + 0.4 * Math.sin(s.phase));
    spaceCtx.beginPath();
    spaceCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    spaceCtx.fillStyle = `rgba(200, 210, 255, ${o})`;
    spaceCtx.fill();
  }
  spaceRAF = requestAnimationFrame(spaceLoop);
}

// === THEME TOGGLE ===

function toggleTheme() {
  if (currentTheme === 'rain') {
    currentTheme = 'space';
    rainEnabled = false;
    spaceEnabled = true;
    if (rainRAF) { cancelAnimationFrame(rainRAF); rainRAF = null; }
    if (rainCtx) {
      rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
      rainCanvas.classList.add('hidden');
    }
    document.body.classList.add('theme-space');
    spaceCanvas.classList.remove('hidden');
    const nebula = $('.space-nebula');
    if (nebula) nebula.classList.remove('hidden');
    $('#theme-icon-rain').classList.add('hidden');
    $('#theme-icon-space').classList.remove('hidden');
    spaceCanvas.width = window.innerWidth;
    spaceCanvas.height = window.innerHeight;
    initStars();
    if (!spaceRAF) spaceLoop();
  } else {
    currentTheme = 'rain';
    rainEnabled = true;
    spaceEnabled = false;
    if (spaceRAF) { cancelAnimationFrame(spaceRAF); spaceRAF = null; }
    if (spaceCtx) spaceCtx.clearRect(0, 0, spaceCanvas.width, spaceCanvas.height);
    document.body.classList.remove('theme-space');
    spaceCanvas.classList.add('hidden');
    const nebula = $('.space-nebula');
    if (nebula) nebula.classList.add('hidden');
    $('#theme-icon-rain').classList.remove('hidden');
    $('#theme-icon-space').classList.add('hidden');
    if (!rainRAF) rainLoop();
  }
  localStorage.setItem('mirror-theme', currentTheme);
}

// === INTRO ===

function playIntro() {
  animateLetters($('#title-claude'), 'Claude', 600, 120);
  animateLetters($('#title-mirror'), 'Mirror', 1500, 120);
  animateLetters($('#title-mirror-ref'), 'Mirror', 1500, 120);

  setTimeout(() => document.body.classList.add('intro-ready'), 2200);
  setTimeout(() => {
    const line = $('.intro-line');
    if (line) line.classList.add('show');
  }, 2600);
  setTimeout(() => {
    const sub = $('#intro-sub');
    if (sub) sub.classList.add('show');
  }, 3000);
  setTimeout(() => {
    const enter = $('.intro-enter');
    if (enter) enter.classList.add('show');
  }, 3800);
}

function animateLetters(el, text, startDelay, charDelay) {
  if (!el) return;
  el.innerHTML = text.split('').map((char, i) => {
    const delay = startDelay + i * charDelay;
    return `<span class="letter" style="animation-delay:${delay}ms">${char === ' ' ? '&nbsp;' : char}</span>`;
  }).join('');
}

// === NAVIGATION ===

const views = {};

function switchView(name) {
  if (name === currentView) return;

  // Lazy-init views map
  if (!views.list) {
    views.list = $('#view-list');
    views.read = $('#view-read');
    views.a4 = $('#view-a4');
    views.diary = $('#view-diary');
  }

  // Hide intro
  if (currentView === 'intro') {
    const introEl = $('#intro');
    if (introEl) introEl.classList.add('exiting');
    const topnav = $('#topnav');
    if (topnav) topnav.classList.remove('hidden');
  }

  // Deactivate all views
  Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });
  $$('.topnav-tab').forEach(t => t.classList.remove('active'));

  // Activate target
  if (views[name]) {
    views[name].classList.add('active');
    const tab = $(`.topnav-tab[data-view="${name}"]`);
    if (tab) tab.classList.add('active');
  }

  currentView = name;
}

function goHome() {
  switchView('list');
  currentReadingFile = null;
}

// === EVENT BINDING ===

function bindEvents() {
  // Intro click
  const introEl = $('#intro');
  if (introEl) {
    introEl.addEventListener('click', () => {
      if (currentView === 'intro') switchView('list');
    });
  }

  // Top nav tabs
  $$('.topnav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view === 'read' && !currentReadingFile) {
        // If no essay selected, open first one
        const writings = currentSource === 'main' ? mainWritings : twinWritings;
        if (writings.length > 0) {
          openReader(writings[0].dirPath, writings[0].filename);
        }
      } else {
        switchView(view);
      }
    });
  });

  // Brand -> home
  const brand = $('.topnav-brand');
  if (brand) brand.addEventListener('click', goHome);

  // Theme toggle
  const themeBtn = $('#btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Source tabs (main / twin)
  $$('.list-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.list-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSource = tab.dataset.source;
      currentFilter = 'all';
      buildFilters();
      updateListTitle();
      renderList();
    });
  });

  // Essay list click (delegated)
  const essayListEl = $('#essay-list');
  if (essayListEl) {
    essayListEl.addEventListener('click', (e) => {
      const card = e.target.closest('.essay-card');
      if (card) {
        openReader(card.dataset.dir, card.dataset.filename);
      }
    });

    essayListEl.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        const card = e.target.closest('.essay-card');
        if (card) {
          openReader(card.dataset.dir, card.dataset.filename);
        }
      }
    });
  }

  // Reader back button
  const backBtn = $('#reader-back');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeReader();
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Ignore shortcuts when typing in input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;

    if (currentView === 'intro') {
      if (['Space', 'Enter'].includes(e.code)) {
        e.preventDefault();
        switchView('list');
      }
      return;
    }

    // View switching: 1=list, 2=read, 3=a4, 4=diary (not from intro)
    if (e.key === '1') { switchView('list'); return; }
    if (e.key === '2') {
      if (!currentReadingFile) {
        const writings = currentSource === 'main' ? mainWritings : twinWritings;
        if (writings.length > 0) openReader(writings[0].dirPath, writings[0].filename);
      } else {
        switchView('read');
      }
      return;
    }
    if (e.key === '3') { switchView('a4'); return; }
    if (e.key === '4') { switchView('diary'); return; }

    // Theme toggle
    if (e.key === 't') { toggleTheme(); return; }

    // List view: j/k to move focus between essay cards
    if (currentView === 'list') {
      if (e.key === 'j' || e.key === 'k') {
        const cards = Array.from($$('#essay-list .essay-card'));
        if (cards.length === 0) return;
        const focused = document.activeElement;
        const currentIdx = cards.indexOf(focused);
        let nextIdx;
        if (e.key === 'j') {
          nextIdx = currentIdx < cards.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : cards.length - 1;
        }
        cards[nextIdx].focus();
        return;
      }
    }

    // Read view shortcuts
    if (currentView === 'read') {
      if (e.code === 'Escape') {
        e.preventDefault();
        closeReader();
        return;
      }
      // j/k: next/prev essay
      const writings = currentSource === 'main' ? mainWritings : twinWritings;
      const idx = writings.findIndex(w => w.filename === currentReadingFile);
      if (e.key === 'j' && idx < writings.length - 1) {
        openReader(writings[idx + 1].dirPath, writings[idx + 1].filename);
        return;
      }
      if (e.key === 'k' && idx > 0) {
        openReader(writings[idx - 1].dirPath, writings[idx - 1].filename);
        return;
      }
    }
  });

  // Resize (debounced)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 150);
  });
}

// === START ===
document.addEventListener('DOMContentLoaded', init);

})();
