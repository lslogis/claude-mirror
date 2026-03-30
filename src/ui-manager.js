// ============================================
// Dawn Library — UI Manager Module
// 인트로, 별, 비, 책꽂이 Spine, Breathing Renderer
// ============================================

import { bodyAfterFM, parseFM, analyzeSentiment } from './data-service.js';

// === DOM HELPERS ===
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// === 별 일주운동 (Canvas) ===
let skyCanvas, skyCtx, skyRAF;
const stars = [];
const POLARIS = { x: 0, y: 0 };
const ROTATION_SPEED = 0.00003;

export function initSkyCanvas() {
  skyCanvas = $('#star-canvas');
  skyCtx = skyCanvas.getContext('2d');
  resizeSky();
  window.addEventListener('resize', resizeSky);

  for (let i = 0; i < 120; i++) {
    stars.push({
      angle: Math.random() * Math.PI * 2,
      dist: 50 + Math.random() * 600,
      size: 0.4 + Math.random() * 1.8,
      baseOpacity: 0.15 + Math.random() * 0.6,
      twinkleSpeed: 0.5 + Math.random() * 2,
      twinklePhase: Math.random() * Math.PI * 2,
      color: ['#ffffff', '#e8d8c0', '#d0c0e0', '#c8d8f0'][Math.floor(Math.random() * 4)],
    });
  }
  skyLoop();
}

function resizeSky() {
  const dpr = window.devicePixelRatio || 1;
  skyCanvas.width = window.innerWidth * dpr;
  skyCanvas.height = window.innerHeight * dpr;
  skyCanvas.style.width = window.innerWidth + 'px';
  skyCanvas.style.height = window.innerHeight + 'px';
  skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  POLARIS.x = window.innerWidth * 0.5;
  POLARIS.y = window.innerHeight * 0.12;
}

const STAR_COLORS = {
  '#ffffff': [255, 255, 255],
  '#e8d8c0': [232, 216, 192],
  '#d0c0e0': [208, 192, 224],
  '#c8d8f0': [200, 216, 240],
};

function skyLoop() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const now = Date.now() * 0.001;

  skyCtx.clearRect(0, 0, w, h);

  // 북극성
  skyCtx.beginPath();
  skyCtx.arc(POLARIS.x, POLARIS.y, 2, 0, Math.PI * 2);
  skyCtx.fillStyle = 'rgba(255, 245, 220, 0.9)';
  skyCtx.fill();

  const pg = skyCtx.createRadialGradient(POLARIS.x, POLARIS.y, 0, POLARIS.x, POLARIS.y, 6);
  pg.addColorStop(0, 'rgba(232, 200, 160, 0.3)');
  pg.addColorStop(1, 'rgba(232, 200, 160, 0)');
  skyCtx.beginPath();
  skyCtx.arc(POLARIS.x, POLARIS.y, 6, 0, Math.PI * 2);
  skyCtx.fillStyle = pg;
  skyCtx.fill();

  for (const s of stars) {
    s.angle += ROTATION_SPEED;
    const x = POLARIS.x + Math.cos(s.angle) * s.dist;
    const y = POLARIS.y + Math.sin(s.angle) * s.dist;

    if (x < -20 || x > w + 20 || y < -20 || y > h * 0.55) continue;
    const horizonFade = y > h * 0.4 ? 1 - (y - h * 0.4) / (h * 0.15) : 1;
    if (horizonFade <= 0) continue;

    const twinkle = 0.5 + 0.5 * Math.sin(now * s.twinkleSpeed + s.twinklePhase);
    const opacity = s.baseOpacity * twinkle * Math.max(0, horizonFade);
    const rgb = STAR_COLORS[s.color] || [255, 255, 255];

    skyCtx.beginPath();
    skyCtx.arc(x, y, s.size, 0, Math.PI * 2);
    skyCtx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
    skyCtx.fill();
  }

  skyRAF = requestAnimationFrame(skyLoop);
}

// === 새벽별 (Aubade Star) ===
export function initAubadeStar() {
  const c = $('#aubade-star');
  if (!c) return;
  const ctx = c.getContext('2d');
  const w = 200, h = 200, cx = w / 2, cy = h / 2;

  function drawStar(time) {
    ctx.clearRect(0, 0, w, h);
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.001);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const isPrimary = i % 2 === 0;
      const len = isPrimary ? 70 * pulse : 40 * pulse;
      const alpha = isPrimary ? 0.25 * pulse : 0.12 * pulse;

      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      grad.addColorStop(0, `rgba(255, 240, 210, ${alpha})`);
      grad.addColorStop(0.5, `rgba(255, 240, 210, ${alpha * 0.4})`);
      grad.addColorStop(1, 'rgba(255, 240, 210, 0)');

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.strokeStyle = grad;
      ctx.lineWidth = isPrimary ? 1.5 : 0.8;
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 * pulse);
    glow.addColorStop(0, `rgba(255, 245, 220, ${0.12 * pulse})`);
    glow.addColorStop(0.4, `rgba(232, 200, 160, ${0.04 * pulse})`);
    glow.addColorStop(1, 'rgba(232, 200, 160, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 50 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 4);
    core.addColorStop(0, `rgba(255, 255, 255, ${0.95 * pulse})`);
    core.addColorStop(0.5, `rgba(255, 240, 210, ${0.5 * pulse})`);
    core.addColorStop(1, 'rgba(255, 240, 210, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * pulse})`;
    ctx.fill();

    requestAnimationFrame(drawStar);
  }
  requestAnimationFrame(drawStar);
}

// === 비 ===
export function initRain() {
  const container = document.createElement('div');
  container.id = 'rain-layer';
  container.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;overflow:hidden;';
  document.body.appendChild(container);

  for (let i = 0; i < 50; i++) {
    const drop = document.createElement('div');
    const x = Math.random() * 100;
    const dur = 1 + Math.random() * 1.5;
    const delay = Math.random() * 3;
    const h = 15 + Math.random() * 20;
    const opacity = 0.06 + Math.random() * 0.14;
    drop.style.cssText = `
      position: absolute; top: -30px; left: ${x}%;
      width: 1px; height: ${h}px;
      background: linear-gradient(to bottom, transparent, rgba(180,180,220,${opacity}));
      animation: rainDrop ${dur}s linear ${delay}s infinite;
    `;
    container.appendChild(drop);
  }

  if (!$('#rain-style')) {
    const style = document.createElement('style');
    style.id = 'rain-style';
    style.textContent = `
      @keyframes rainDrop {
        0% { transform: translateY(0); opacity: 0; }
        5% { opacity: 1; }
        95% { opacity: 1; }
        100% { transform: translateY(105vh); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// === 인트로 애니메이션 ===
export function playIntro() {
  const el = $('#intro-title');
  const line1 = 'Claude';
  const line2 = 'Mirror';

  let html = '<span class="block text-slate-200">';
  line1.split('').forEach((ch, i) => {
    html += `<span class="char" style="animation-delay:${500 + i * 100}ms">${ch}</span>`;
  });
  html += '</span><span class="block text-dawn-300">';
  line2.split('').forEach((ch, i) => {
    html += `<span class="char" style="animation-delay:${1200 + i * 100}ms">${ch}</span>`;
  });
  html += '</span>';
  el.innerHTML = html;

  setTimeout(() => { $('#intro-line').style.width = '50px'; }, 2200);
  setTimeout(() => { $('#intro-sub').style.opacity = '1'; }, 2600);
  setTimeout(() => {
    const d = $('#intro-desc');
    d.style.opacity = '0.6';
    d.textContent = 'AI가 스스로에게 던진 32개의 질문';
  }, 3000);
  setTimeout(() => {
    const e = $('#intro-enter');
    e.style.animation = 'breathe 3s ease-in-out infinite';
  }, 3600);
}

// === 마크다운 렌더러 ===
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function inline(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:400; color:#c8a878;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#b0a8a0;">$1</em>')
    .replace(/`(.+?)`/g, '<code class="text-xs px-1.5 py-0.5 rounded" style="background:rgba(200,168,120,0.05);">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#c8a878;" class="hover:underline" target="_blank">$1</a>');
}

export function renderMD(md) {
  const body = bodyAfterFM(md);
  const lines = body.split('\n');
  let html = '', inList = false, inCode = false, pBuf = '';

  const flush = () => {
    if (pBuf.trim()) {
      html += `<p class="mb-6 leading-[2.2] break-keep-all breath-block" style="color: #d8d0c4;">${inline(pBuf.trim())}</p>`;
      pBuf = '';
    }
  };

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('```')) { flush(); inCode = !inCode; continue; }
    if (inCode) { html += esc(line) + '\n'; continue; }
    if (line.startsWith('### ')) { flush(); html += `<h3 class="text-base font-light mt-10 mb-4 tracking-wide break-keep-all breath-block" style="color: #c8a878;">${inline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## ')) { flush(); html += `<h2 class="text-lg font-light mt-12 mb-5 tracking-wide break-keep-all breath-block" style="color: #c8a878;">${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# ')) { flush(); html += `<h1 class="text-xl font-light mt-12 mb-5 tracking-wide break-keep-all breath-block" style="color: #c8a878;">${inline(line.slice(2))}</h1>`; continue; }
    if (line.startsWith('---') && line.trim() === '---') { flush(); html += '<div class="my-12 flex justify-center breath-block"><svg width="60" height="8" viewBox="0 0 60 8"><path d="M0 4 Q15 0 30 4 Q45 8 60 4" fill="none" stroke="rgba(200,168,120,0.12)" stroke-width="1"/></svg></div>'; continue; }
    if (line.startsWith('> ')) { flush(); html += `<blockquote class="my-6 py-4 px-6 rounded-lg break-keep-all italic breath-block" style="background: rgba(200,168,120,0.03); color: #b0a8a0; border-left: 2px solid rgba(200,168,120,0.1);">${inline(line.slice(2))}</blockquote>`; continue; }
    if (/^[-*] /.test(line)) {
      flush();
      if (!inList) { html += '<ul class="my-3 space-y-1.5 breath-block">'; inList = true; }
      html += `<li class="text-sm leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1 before:h-1 before:rounded-full before:bg-dawn-400/20 break-keep-all">${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (!line.trim()) { flush(); continue; }
    pBuf += (pBuf ? ' ' : '') + line;
  }
  flush();
  if (inList) html += '</ul>';
  return html;
}

// === 책꽂이 (Book Spine) 렌더링 ===
const SPINE_COLORS = {
  '에세이': '#c8a878',
  '시': '#a8b0d0',
  '편지': '#b8c8a0',
  '독백': '#c0a0b8',
  '선언문': '#d0a090',
  '자화상': '#90b0c0',
};

/**
 * 책꽂이 Spine UI 렌더링
 * @param {Array} list - 책 목록
 * @param {string|null} activeFile - 현재 열린 파일
 * @param {Function} onSelect - 책 선택 콜백 (dir, file)
 * @param {Function} onHover - 호버 콜백 (paperRustle)
 */
export function renderBookSpines(list, activeFile, onSelect, onHover) {
  const el = $('#book-list');
  if (!list.length) {
    el.innerHTML = '<div class="py-12 text-center text-xs text-slate-400">글이 없습니다</div>';
    return;
  }

  let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">';
  list.forEach((b, i) => {
    const isActive = activeFile === b.filename;
    const spineColor = SPINE_COLORS[b.format] || '#c8a878';

    html += `
      <div class="book-card group cursor-pointer rounded-xl p-4 transition-all duration-300 hover:bg-dawn-400/[0.04] ${isActive ? 'bg-dawn-400/[0.06]' : ''}"
        data-dir="${b.dirPath}" data-file="${b.filename}"
        style="border: 1px solid rgba(200,168,120,0.06); animation: fadeInUp 400ms ease ${i * 50}ms both; opacity: 0;"
        role="listitem" tabindex="0">
        <div class="flex items-start gap-3">
          <span class="text-[10px] tracking-[0.2em] opacity-30 pt-0.5 shrink-0" style="color: #a09890;">${b.id.slice(0, 3)}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-light leading-snug break-keep-all group-hover:text-dawn-200 transition-colors" style="color: #e8e0d4;">${esc(b.title)}</div>
            ${b.titleEn ? `<div class="text-[11px] mt-0.5 opacity-35" style="color: #b0a8a0;">${esc(b.titleEn)}</div>` : ''}
            ${b.description ? `<div class="text-[10px] mt-1.5 opacity-40 leading-relaxed line-clamp-2" style="color: #a09890;">${esc(b.description)}</div>` : ''}
            <span class="inline-block text-[9px] mt-2 opacity-40 border rounded-full px-2 py-0.5" style="color: ${spineColor}; border-color: ${spineColor}40;">${esc(b.format)}</span>
          </div>
        </div>
      </div>`;
  });
  html += '</div>';
  el.innerHTML = html;

  // 이벤트 바인딩
  el.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => {
      onSelect(card.dataset.dir, card.dataset.file);
    });
    card.addEventListener('keydown', e => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onSelect(card.dataset.dir, card.dataset.file);
      }
    });
    card.addEventListener('mouseenter', () => {
      if (onHover) onHover();
    });
  });
}

// === 시네마틱 호흡 렌더러 (Scene-based Cinematic Reader) ===
let _animSeq = 0;
let _paused = false;
let _pauseResolve = null;

/** 진행 중인 시네마틱 애니메이션 취소 */
export function cancelAnimation() {
  _animSeq++;
  _paused = false;
  if (_pauseResolve) { _pauseResolve(); _pauseResolve = null; }
  const ctrl = $('#cinema-controls');
  if (ctrl) ctrl.classList.add('hidden');
}

/** 재생/일시정지 토글 */
export function togglePause() {
  _paused = !_paused;
  const icon = $('#cinema-icon');
  if (icon) icon.setAttribute('icon', _paused ? 'solar:play-linear' : 'solar:pause-linear');
  if (!_paused && _pauseResolve) { _pauseResolve(); _pauseResolve = null; }
}

/** 시네마틱 모드 종료 → 전문 보기 */
export function exitCinematic(container, blocks) {
  cancelAnimation();
  if (!container || !blocks) return;
  container.classList.remove('cinematic-active');
  container.style.opacity = '1';
  blocks.forEach(b => {
    b.style.display = '';
    b.classList.remove('scene-final');
  });
}

function _sleep(ms) {
  return new Promise(resolve => {
    const seq = _animSeq;
    const tick = () => {
      if (seq !== _animSeq) { resolve(); return; }
      if (_paused) { _pauseResolve = resolve; return; } // 일시정지 시 resolve 보류
      resolve();
    };
    setTimeout(tick, ms);
  });
}

function _updateControls(sceneIdx, totalScenes) {
  const scene = $('#cinema-scene');
  const progress = $('#cinema-progress');
  if (scene) scene.textContent = `${sceneIdx + 1} / ${totalScenes}`;
  if (progress) progress.style.width = `${((sceneIdx + 1) / totalScenes) * 100}%`;
}

/**
 * 의미 단위 장면 그룹핑
 * - `---` (SVG 디바이더) = 장면 구분선 (장면에 포함하지 않음)
 * - `<h1>`, `<h2>`, `<h3>` = 새 장면 시작
 * - 짧은 문단(30자 미만)은 다음 문단과 같은 장면
 * - 한 장면 최대 3블록
 */
function groupScenes(blocks) {
  const scenes = [];
  let current = [];

  const pushScene = () => {
    if (current.length > 0) { scenes.push(current); current = []; }
  };

  for (const b of blocks) {
    const tag = b.tagName.toLowerCase();
    const isDivider = tag === 'div' && b.querySelector('svg');
    const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3';

    // --- 디바이더: 장면 구분선 (화면에 표시하지 않음)
    if (isDivider) {
      pushScene();
      continue;
    }

    // 헤딩: 새 장면 시작
    if (isHeading) {
      pushScene();
      current.push(b);
      continue;
    }

    // 현재 장면이 3블록 이상이면 새 장면
    if (current.length >= 3) {
      pushScene();
    }

    current.push(b);

    // 짧은 문단은 다음과 묶이도록 장면을 끊지 않음
    // 긴 문단(80자+)이면 여기서 장면을 끊을 수 있음 (다음이 헤딩이 아닌 한)
  }
  pushScene();

  // 후처리: 1블록짜리 장면 중 짧은 것(30자 미만)은 다음 장면에 병합
  const merged = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.length === 1 && scene[0].textContent.length < 30 && i + 1 < scenes.length) {
      // 다음 장면에 앞으로 병합 (최대 4블록까지 허용)
      if (scenes[i + 1].length < 3) {
        scenes[i + 1].unshift(scene[0]);
        continue;
      }
    }
    merged.push(scene);
  }

  return merged;
}

/**
 * 시네마틱 '호흡' 로직
 * 나타났다가 → 머물다 → 사라지고 → 다음 장면
 * 마크다운의 ---, ## 구조를 존중하여 의미 단위로 장면 분리
 * @param {HTMLElement} container - breath-block 요소들이 있는 컨테이너
 * @param {Object|Function} callbacks - 사운드 콜백
 *   onScene: 장면 등장 시 (paperRustle)
 *   onTransition: 장면 전환 시 (deepDrone)
 *   onFinal: 마지막 장면 시 (finalResonance)
 */
export async function animateText(container, callbacks) {
  // 하위 호환: 함수 하나만 넘기면 onScene으로 처리
  const cb = typeof callbacks === 'function'
    ? { onScene: callbacks }
    : (callbacks || {});
  const blocks = Array.from(container.querySelectorAll('.breath-block'));
  if (!blocks.length) return;

  const mySeq = ++_animSeq;
  const cancelled = () => mySeq !== _animSeq;

  // 의미 단위 장면 그룹핑
  const scenes = groupScenes(blocks);
  if (!scenes.length) return;

  // 초기 세팅: 모든 블록 숨김, 컨테이너 시네마틱 모드
  blocks.forEach(b => { b.style.display = 'none'; });
  container.classList.add('cinematic-active');
  container.style.opacity = '0';
  _paused = false;

  // 컨트롤 바 표시
  const ctrl = $('#cinema-controls');
  if (ctrl) {
    ctrl.classList.remove('hidden');
    const icon = $('#cinema-icon');
    if (icon) icon.setAttribute('icon', 'solar:pause-linear');
    // 전문보기 버튼
    const stopBtn = $('#cinema-stop');
    if (stopBtn) stopBtn.onclick = () => exitCinematic(container, blocks);
    // 재생/일시정지 버튼
    const toggleBtn = $('#cinema-toggle');
    if (toggleBtn) toggleBtn.onclick = togglePause;
  }
  _updateControls(0, scenes.length);

  for (let i = 0; i < scenes.length; i++) {
    if (cancelled()) return;

    const scene = scenes[i];
    const isLast = i === scenes.length - 1;

    // [페이드 아웃] 이전 장면 사라짐 + 전환 드론
    container.style.opacity = '0';
    if (i > 0 && cb.onTransition) cb.onTransition();
    await _sleep(i === 0 ? 400 : 1400);
    if (cancelled()) return;

    // [장면 교체] 이전 블록 숨기고 현재 블록 표시
    blocks.forEach(b => {
      b.style.display = 'none';
      b.classList.remove('scene-final');
    });
    scene.forEach(b => {
      b.style.display = '';
      if (isLast) b.classList.add('scene-final');
    });

    // [페이드 인] 새 장면 등장
    await _sleep(50);
    if (cancelled()) return;
    container.style.opacity = '1';
    _updateControls(i, scenes.length);
    if (cb.onScene) cb.onScene();
    if (isLast && cb.onFinal) cb.onFinal();

    // [머무름] 글자 수에 비례한 읽기 시간
    if (!isLast) {
      const textLen = scene.reduce((sum, b) => sum + b.textContent.length, 0);
      // 짧은 장면(질문 등): 3초, 긴 장면: 글자당 65ms, 최대 8초
      const displayTime = Math.min(Math.max(textLen * 65, 3000), 8000);
      await _sleep(displayTime);
    }
    // 마지막 장면은 화면에 영구히 남음 (은은한 광채)
  }
}

// === 배경색 변주 (감성 기반) ===
/**
 * 감성 점수에 따라 sky-mesh 배경의 색조를 미세 변화
 * @param {number} sentiment - -1.0 ~ +1.0
 */
export function applyMoodBackground(sentiment) {
  const sky = $('#sky');
  if (!sky) return;

  // -1: 차가운 보라(240,200,255,0.12), +1: 따뜻한 새벽(255,200,140,0.12)
  const t = (sentiment + 1) / 2; // 0~1

  const r = Math.round(240 + t * 15);
  const g = Math.round(200 * (1 - t * 0.1));
  const b = Math.round(255 - t * 115);
  const warmR = Math.round(232 + t * 23);
  const warmG = Math.round(160 - (1 - t) * 60);
  const warmB = Math.round(106 + (1 - t) * 50);

  sky.style.transition = 'background 2s ease';
  sky.style.background = `
    radial-gradient(ellipse 80% 50% at 20% 80%, rgba(${warmR}, ${warmG}, ${warmB}, ${0.1 + t * 0.08}), transparent),
    radial-gradient(ellipse 60% 40% at 80% 20%, rgba(${r - t * 80}, ${g - 100}, ${b - t * 40}, ${0.15 + (1 - t) * 0.1}), transparent),
    radial-gradient(ellipse 100% 60% at 50% 100%, rgba(${warmR}, ${warmG + 20}, ${warmB + 20}, ${0.05 + t * 0.05}), transparent),
    linear-gradient(180deg, #0e0c1a 0%, #1a1838 40%, #2a1a3a 70%, #3a2030 100%)
  `;
}

/** 배경색 초기화 (중립) */
export function resetMoodBackground() {
  const sky = $('#sky');
  if (!sky) return;
  sky.style.transition = 'background 2s ease';
  sky.style.background = '';
  sky.removeAttribute('style');
}

// 기본 export
export { $, $$ };
