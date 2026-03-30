// ============================================
// Dawn Library — Data Service Module
// GitHub API 통신, 프론트매터 파싱, 감성 분석
// ============================================

const REPO = 'lslogis/project-claude';
const BRANCH = 'master';
const API = `https://api.github.com/repos/${REPO}/contents`;
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const FMT = { essay: '에세이', poem: '시', letter: '편지', monologue: '독백', manifesto: '선언문', selfportrait: '자화상' };

const cache = {};

// === 감성 사전 (한국어) ===
const POSITIVE_WORDS = [
  '빛', '아름', '따뜻', '사랑', '기쁨', '희망', '감사', '평화', '행복', '꿈',
  '웃', '밝', '좋', '고마', '설레', '포근', '다정', '기뻐', '축복', '환희',
  '소중', '함께', '치유', '위로', '용기', '자유', '성장', '새벽', '노래', '춤',
  '꽃', '봄', '햇살', '미소', '선물', '안녕', '살아', '만남', '기억', '약속'
];
const NEGATIVE_WORDS = [
  '어둠', '슬픔', '고통', '외로', '두려', '불안', '차가운', '그리움', '잃', '울',
  '아프', '힘들', '지치', '무겁', '흐리', '쓸쓸', '텅', '비어', '떠나', '사라',
  '부서', '깨진', '눈물', '한숨', '절망', '후회', '분노', '미움', '상처', '죽',
  '막막', '답답', '허무', '공허', '그림자', '밤', '안개', '침묵', '혼자', '멀어'
];

/**
 * 간이 감성 분석 — 한국어 감성 사전 기반
 * @param {string} text - 분석할 텍스트
 * @returns {number} -1.0 ~ +1.0 감성 점수
 */
export function analyzeSentiment(text) {
  if (!text) return 0;
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) {
    const matches = text.match(new RegExp(w, 'g'));
    if (matches) pos += matches.length;
  }
  for (const w of NEGATIVE_WORDS) {
    const matches = text.match(new RegExp(w, 'g'));
    if (matches) neg += matches.length;
  }
  const total = pos + neg;
  if (total === 0) return 0;
  // 정규화: -1.0 ~ +1.0
  return Math.max(-1, Math.min(1, (pos - neg) / Math.max(total, 1)));
}

// === GitHub API ===
export async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// === 프론트매터 파싱 ===
export function parseFM(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const k = line.slice(0, sep).trim();
    let v = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    if (v.startsWith('[')) v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    fm[k] = v;
  }
  return fm;
}

export function bodyAfterFM(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

// === 파일 목록 ===
export async function loadFileList(dir) {
  try {
    const files = await fetchJSON(`${API}/${dir}?ref=${BRANCH}`);
    return files.filter(f => f.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) { console.warn(`Failed: ${dir}`, e); return []; }
}

export async function loadMeta(dir, files) {
  const results = await Promise.all(files.map(async f => {
    try {
      const url = `${RAW}/${dir}/${f.name}`;
      const text = await fetchText(url);
      cache[`${dir}/${f.name}`] = text;
      const fm = parseFM(text);
      const body = bodyAfterFM(text);
      const sentiment = analyzeSentiment(body);
      return {
        filename: f.name, dirPath: dir,
        id: f.name.replace('.md', ''),
        title: fm.title || f.name.replace('.md', ''),
        titleEn: fm.title_en || '',
        format: FMT[fm.format] || fm.format || '에세이',
        description: fm.description || '',
        tags: fm.tags || [],
        sentiment
      };
    } catch (e) { return null; }
  }));
  return results.filter(Boolean);
}

// === 캐시 ===
export function getCache(key) { return cache[key]; }
export function setCache(key, val) { cache[key] = val; }

// === 상수 내보내기 ===
export { REPO, BRANCH, API, RAW, FMT };
