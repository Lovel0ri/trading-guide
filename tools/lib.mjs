import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const BOOK_DIR = path.join(ROOT, 'book');
export const SOURCE_DIR = '/Volumes/extra1tb/clawdbot-project/04_tools/scripts/6-18日交易知识库';
export const PLANNED_CHAPTERS = 12;

export const TAG_KEYS = ['钱', '时间', '纪律', '收益', '口径', '行情', '周期', '人群', '优先级', '问题'];

export const TAG_MAP = {
  钱: 'money',
  时间: 'time',
  纪律: 'discipline',
  收益: 'level',
  口径: 'lens',
  行情: 'market',
  周期: 'cycle',
  人群: 'who',
  优先级: 'priority',
  问题: 'problems',
};

export const ALLOWED = {
  money: ['零', '小', '中', '大'],
  time: ['少', '中', '多'],
  discipline: ['低', '中', '高'],
  level: ['小', '中', '大'],
  lens: ['生存', '收益', '执行', '认知'],
  market: ['任意', '趋势', '震荡', '低波动', '高波动', '下跌', '突破'],
  cycle: ['任意', '日内', '日间', '超短', '波段'],
  who: ['新手', '小资金', '有稳定盈利', '上班族', '全职交易'],
  priority: ['P0', 'P1', 'P2'],
};

export const REQUIRED_FIELDS = ['成本', '说人话', '收益', '依据', '原文', '出处', '失效', '备注'];

export function normalizeUrl(url) {
  let out = String(url || '').trim();
  out = out.replace(/^http:\/\//i, 'https://');
  out = out.replace(/[?#].*$/, '');
  out = out.replace(/\/+$/, '');
  return out;
}

export function stripMd(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTags(raw) {
  const tags = {};
  for (const part of String(raw || '').trim().split(/\s+/)) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i);
    const value = part.slice(i + 1);
    const field = TAG_MAP[key];
    if (!field) continue;
    tags[field] = field === 'who' || field === 'problems'
      ? value.split(',').map((x) => x.trim()).filter(Boolean)
      : value;
  }
  return tags;
}

export function parseSource(raw) {
  const links = [...String(raw || '').matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)]
    .map((m) => ({ text: m[1].trim(), url: m[2].trim() }));
  const first = links[0] || { text: '', url: '' };
  return { source: String(raw || '').trim(), sourceText: first.text, sourceUrl: first.url, links };
}

export function parseBookText(text, file) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const titleIndex = lines.findIndex((line) => /^#\s+(\d+)\.\s+(.+)$/.test(line.trim()));
  if (titleIndex < 0) throw new Error(`${file}: 缺少 "# 1. 章节名" 标题`);
  const titleMatch = /^#\s+(\d+)\.\s+(.+)$/.exec(lines[titleIndex].trim());
  const chapter = {
    n: Number(titleMatch[1]),
    title: titleMatch[2].trim(),
    subtitle: '',
    intro: [],
    file: path.relative(ROOT, file).replaceAll(path.sep, '/'),
    entries: [],
  };
  let i = titleIndex + 1;
  while (i < lines.length && !lines[i].trim()) i++;
  const sub = /^>\s+(.+)$/.exec((lines[i] || '').trim());
  if (sub) {
    chapter.subtitle = sub[1].trim();
    i++;
  }
  const intro = [];
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^###\s+\d+\./.test(line)) break;
    if (!line || line === '---' || line.startsWith('[←')) continue;
    intro.push(line);
  }
  chapter.intro = intro;

  let current = null;
  let lastField = '';
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const entryMatch = /^###\s+(\d+)\.\s+(.+)$/.exec(line.trim());
    if (entryMatch) {
      current = {
        id: `e-${chapter.n}-${Number(entryMatch[1])}`,
        sec: chapter.n,
        n: Number(entryMatch[1]),
        title: entryMatch[2].trim(),
        tagsRaw: '',
        tags: {},
        fields: {},
      };
      chapter.entries.push(current);
      lastField = '';
      continue;
    }
    if (!current) continue;
    const tagMatch = /^<!--\s*标签:\s*(.*?)\s*-->$/.exec(line.trim());
    if (tagMatch) {
      current.tagsRaw = tagMatch[1];
      current.tags = parseTags(tagMatch[1]);
      continue;
    }
    const fieldMatch = /^-\s*([^：:]+)[：:]\s*(.*)$/.exec(line);
    if (fieldMatch) {
      const key = fieldMatch[1].trim();
      current.fields[key] = fieldMatch[2].trim();
      lastField = key;
      continue;
    }
    if (lastField && /^\s{2,}\S/.test(raw)) {
      current.fields[lastField] += '\n' + raw.trim();
    }
  }

  for (const entry of chapter.entries) {
    const f = entry.fields;
    const src = parseSource(f['出处']);
    Object.assign(entry, {
      cost: f['成本'] || '',
      human: f['说人话'] || '',
      gain: f['收益'] || '',
      basis: (f['依据'] || '').trim().toUpperCase(),
      quote: f['原文'] || '',
      fail: f['失效'] || '',
      note: f['备注'] || '',
      source: src.source,
      sourceText: src.sourceText,
      sourceUrl: src.sourceUrl,
      links: src.links,
    });
    delete entry.fields;
    entry.searchText = stripMd([
      chapter.title,
      entry.title,
      entry.cost,
      entry.human,
      entry.gain,
      entry.quote,
      entry.fail,
      entry.note,
      entry.sourceText,
    ].join(' '));
  }
  return chapter;
}

export async function loadBook() {
  const names = (await fs.readdir(BOOK_DIR))
    .filter((name) => /^\d+-.+\.md$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (!names.length) throw new Error('book/ 下没有章节文件');
  const chapters = [];
  for (const name of names) {
    const file = path.join(BOOK_DIR, name);
    const chapter = parseBookText(await fs.readFile(file, 'utf8'), file);
    chapters.push(chapter);
  }
  chapters.sort((a, b) => a.n - b.n);
  return chapters;
}

export function buildMeta(chapters) {
  const entries = chapters.flatMap((c) => c.entries);
  const grades = { A: 0, B: 0, C: 0 };
  for (const e of entries) if (grades[e.basis] !== undefined) grades[e.basis]++;
  return {
    title: '主观交易指南',
    subtitle: '先活下来，再等大行情',
    edition: chapters.length >= PLANNED_CHAPTERS ? '全本' : '样章',
    updated: new Date().toLocaleDateString('sv-SE'),
    chaptersAvailable: chapters.length,
    chaptersPlanned: PLANNED_CHAPTERS,
    totalEntries: entries.length,
    grades,
  };
}

export function collectIds(chapters) {
  return new Set(chapters.flatMap((c) => c.entries.map((e) => e.id)));
}

export async function loadData() {
  const file = path.join(ROOT, 'data.json');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function walkMarkdown(dir) {
  const out = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...await walkMarkdown(full));
    else if (item.isFile() && item.name.endsWith('.md')) out.push(full);
  }
  return out;
}

export async function sourceUrlIndex() {
  const files = await walkMarkdown(SOURCE_DIR);
  const map = new Map();
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    const match = /原文链接:\s*(https?:\/\/\S+)/.exec(text);
    if (!match) continue;
    const url = normalizeUrl(match[1]);
    if (!map.has(url)) map.set(url, { file, text });
  }
  return map;
}

export function charCount(text) {
  return [...String(text || '')].length;
}

export function refsIn(text) {
  return [...String(text || '').matchAll(/第\s*(\d+)\s*[章节]\s*第\s*(\d+)\s*条/g)]
    .map((m) => ({ sec: Number(m[1]), n: Number(m[2]) }));
}
