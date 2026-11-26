// Turns an uploaded file (csv / xlsx / xls / pdf) into a grid: an array of rows,
// each an array of cell values (strings or numbers). The stock parser works on
// that grid, so every file type goes through the same rules.
import * as XLSX from 'xlsx';

export function fileKind(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'txt') return 'csv';
  if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xls') return 'excel';
  if (ext === 'pdf') return 'pdf';
  return null;
}

/** Decode CSV bytes: UTF-8 (with or without BOM), falling back to Thai Windows-874. */
export function decodeText(buf) {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  return new TextDecoder('windows-874').decode(buf);
}

function sheetToGrid(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
}

export function csvToGrid(buf) {
  const wb = XLSX.read(decodeText(buf), { type: 'string', raw: true });
  return sheetToGrid(wb.Sheets[wb.SheetNames[0]]);
}

export function excelToGrid(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  // Use the first sheet that has a stock header; fall back to the first sheet.
  for (const name of wb.SheetNames) {
    const grid = sheetToGrid(wb.Sheets[name]);
    if (grid.some((r) => r.some((c) => String(c).trim() === 'ยี่ห้อ'))) return grid;
  }
  return sheetToGrid(wb.Sheets[wb.SheetNames[0]]);
}

/**
 * Thai text in PDFs arrives in fragments (split at tone marks and vowels).
 * Join fragments that touch into one run; a small gap inside a run is a word space,
 * a gap wider than about half the text height starts a new run (a new cell).
 */
function toRuns(items, h) {
  const runs = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    const gap = last ? it.x - (last.x + last.w) : Infinity;
    if (last && gap <= h * 0.55) {
      const space = gap > h * 0.18 && !last.str.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '';
      last.str += space + it.str;
      last.w = Math.max(last.w, it.x + it.w - last.x);
    } else if (it.str.trim()) {
      runs.push({ ...it });
    }
  }
  for (const r of runs) r.str = fixThai(r.str);
  return runs.filter((r) => r.str);
}

/**
 * Repairs common Thai extraction damage from PDF fonts:
 * - NIKHAHIT + SARA AA ("ํา") is how SARA AM ("ำ") is drawn; turn it back into ำ
 * - positional tone-mark glyphs often have no Unicode mapping and arrive as U+0000;
 *   MAI EK (่) is by far the most common one, so it is the best single guess
 */
export function fixThai(s) {
  return String(s)
    .replace(/ํา/g, 'ำ')
    .replace(/\u0000/g, '่')
    .replace(/[-]/g, (c) => THAI_PUA[c] || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Windows Thai fonts' private-use glyphs for shifted vowels and tone marks
const THAI_PUA = {
  '': 'ฐ', '': 'ิ', '': 'ี', '': 'ึ', '': 'ื',
  '': '่', '': '้', '': '๊', '': '๋', '': '์',
  '': '่', '': '้', '': '๊', '': '๋', '': '์',
  '': 'ญ', '': 'ั', '': 'ํ', '': '็', '': '่',
  '': '้', '': '๊', '': '๋', '': '์', '': 'ุ',
  '': 'ู', '': 'ฺ',
};

/**
 * PDF: read positioned text, rebuild lines by y, then split each line into
 * columns using the x positions of the header row (the line containing ยี่ห้อ).
 * Works for PDFs exported from a report or spreadsheet; scanned images have no text.
 */
/**
 * Every page of a PDF as text lines (top to bottom). Each line has its y, its
 * height and its text runs (left to right), Thai fragments joined and repaired.
 */
export async function pdfPages(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const pageLines = [];
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      const h = Math.abs(it.transform[3]) || 8;
      let line = pageLines.find((l) => Math.abs(l.y - y) <= Math.max(2, h * 0.35));
      if (!line) pageLines.push((line = { y, h, items: [] }));
      line.items.push({ x, w: it.width, str: it.str });
    }
    pageLines.sort((a, b) => b.y - a.y);
    for (const l of pageLines) {
      l.items.sort((a, b) => a.x - b.x);
      l.items = toRuns(l.items, l.h);
    }
    pages.push({ page: p, lines: pageLines.filter((l) => l.items.length) });
  }
  return pages;
}

export async function pdfToGrid(buf) {
  const lines = (await pdfPages(buf)).flatMap((p) => p.lines);
  if (!lines.length) {
    throw new Error('ไฟล์ PDF นี้ไม่มีข้อความให้อ่าน (อาจเป็นภาพสแกน) ลองส่งออกจากโปรแกรมเป็น Excel หรือ CSV แทน');
  }

  const lineText = (l) => l.items.map((i) => i.str).join(' ');
  const headerLine = lines.find((l) => lineText(l).includes('ยี่ห้อ') && lineText(l).includes('จำนวน'));
  if (!headerLine) {
    // No header found: give one cell per text run and let the stock parser report it.
    return lines.map((l) => l.items.map((i) => i.str.trim()));
  }
  const cols = headerLine.items.map((i) => ({ ...i }));
  const centers = cols.map((c) => c.x + c.w / 2);
  const bounds = centers.slice(0, -1).map((c, i) => (c + centers[i + 1]) / 2);
  const colOf = (it) => {
    const mid = it.x + it.w / 2;
    let i = 0;
    while (i < bounds.length && mid > bounds[i]) i++;
    return i;
  };

  return lines.map((l) => {
    if (l === headerLine) return cols.map((c) => c.str.trim());
    const row = Array(cols.length).fill('');
    let prev = null;
    for (const it of l.items) {
      const c = colOf(it);
      const gap = prev && prev.c === c ? it.x - (prev.x + prev.w) : 0;
      row[c] = row[c] ? row[c] + (gap > 1.5 ? ' ' : '') + it.str : it.str;
      prev = { c, x: it.x, w: it.w };
    }
    return row.map((s) => s.trim());
  });
}

export async function fileToGrid(filename, buf) {
  const kind = fileKind(filename);
  if (kind === 'csv') return { kind, grid: csvToGrid(buf) };
  if (kind === 'excel') return { kind, grid: excelToGrid(buf) };
  if (kind === 'pdf') return { kind, grid: await pdfToGrid(buf) };
  throw new Error('รองรับเฉพาะไฟล์ .xlsx .xls .csv และ .pdf');
}
