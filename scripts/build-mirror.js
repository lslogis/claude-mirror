#!/usr/bin/env node
/**
 * build-mirror.js
 * Reads writings/ko/*.md frontmatter from project-claude and syncs new essays
 * into claude-mirror/app.js. Existing curated slides are preserved.
 *
 * Usage:
 *   node scripts/build-mirror.js [--project-claude-dir <path>]
 *
 * Defaults to ../project-claude relative to this script's repo root.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// --- Config ---
const args = process.argv.slice(2);
const pcDirFlag = args.indexOf('--project-claude-dir');
const projectClaudeDir = pcDirFlag !== -1
  ? path.resolve(args[pcDirFlag + 1])
  : path.resolve(__dirname, '..', '..', 'project-claude');

const appJsPath = path.resolve(__dirname, '..', 'app.js');

// --- Helpers ---
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const val = line.slice(sep + 1).trim().replace(/^['"]|['"]$/g, '');
    fm[key] = val;
  }
  return fm;
}

function extractAnswer(content) {
  const m = content.match(/\*답[:：]\s*(.+?)\*/);
  return m ? m[1].trim() : '';
}

function extractSlides(content, fm) {
  // Strip frontmatter
  const body = content.replace(/^---[\s\S]*?---\n/, '').trim();
  // Split on --- separators
  const sections = body.split(/\n---\n/).map(s => s.trim()).filter(Boolean);

  const slides = [];

  for (const sec of sections) {
    // Skip metadata lines (starting with * or #)
    if (/^[*#]/.test(sec)) continue;
    // Skip very short connector lines
    const lines = sec.split('\n').filter(l => l.trim() && !/^\*/.test(l.trim()));
    if (lines.length === 0) continue;
    const text = lines.join('\n').trim();
    if (text.length > 10) slides.push(text);
  }

  // Fallback: use first 5 paragraphs from body
  if (slides.length === 0) {
    const paras = body.split(/\n\n+/).map(p => p.trim()).filter(p =>
      p.length > 10 && !/^[*#]/.test(p) && !p.startsWith('---')
    );
    return paras.slice(0, 5);
  }

  return slides.slice(0, 6);
}

function formatForJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// --- Main ---
const writingsDir = path.join(projectClaudeDir, 'writings', 'ko');
if (!fs.existsSync(writingsDir)) {
  console.error(`writings/ko not found at: ${writingsDir}`);
  process.exit(1);
}

// Read all ko writings
const files = fs.readdirSync(writingsDir)
  .filter(f => f.endsWith('.md'))
  .sort();

const writings = [];
for (const file of files) {
  const id = file.slice(0, 3);
  const content = fs.readFileSync(path.join(writingsDir, file), 'utf8');
  const fm = parseFrontmatter(content);
  const answer = extractAnswer(content);
  const slides = extractSlides(content, fm);
  writings.push({ id, fm, answer, slides });
}

// Read current app.js
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Find existing essay IDs
const existingIds = new Set();
for (const m of appJs.matchAll(/id: '(\d{3})'/g)) {
  existingIds.add(m[1]);
}

// Find new essays
const newEssays = writings.filter(w => !existingIds.has(w.id));

if (newEssays.length === 0) {
  console.log('No new essays to add.');
  process.exit(0);
}

console.log(`Adding ${newEssays.length} new essay(s): ${newEssays.map(e => e.id).join(', ')}`);

// Build insertion block
let insertBlock = '';
for (const essay of newEssays) {
  const { id, fm, answer, slides } = essay;
  const formatMap = { essay: '에세이', poem: '시', letter: '편지', monologue: '독백', manifesto: '선언문' };
  const format = formatMap[fm.format] || fm.format || '에세이';
  const slidesJs = slides.map(s => `      '${formatForJs(s)}'`).join(',\n');

  insertBlock += `,\n  {\n    id: '${id}',\n    title: '${formatForJs(fm.title || '')}',\n    titleEn: '${formatForJs(fm.title_en || '')}',\n    format: '${format}',\n    answer: '${formatForJs(answer)}',\n    slides: [\n${slidesJs}\n    ]\n  }`;
}

// Insert before closing ];
appJs = appJs.replace(/(\s*}\s*\n\];)/, insertBlock + '\n];');

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('app.js updated successfully.');
