// 单章校验：不写 data.json，只在内存里解析并检查一章。
// 用法：node tools/check-one.mjs book/03-不要逆着结构做.md
// 检查项与 check-content / check-plain / check-quotes / check-refs 一致，方便并行写章时自查。
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ROOT, BOOK_DIR, REQUIRED_FIELDS, ALLOWED, charCount,
  parseBookText, normalizeUrl, sourceUrlIndex, refsIn,
} from './lib.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('用法：node tools/check-one.mjs <book/NN-章节.md>');
  process.exit(2);
}
const file = path.resolve(arg);
const errors = [];
const warnings = [];

const chapter = parseBookText(await fs.readFile(file, 'utf8'), file);

// 全部已有章节的 id，供交叉引用校验
const ids = new Set();
for (const name of (await fs.readdir(BOOK_DIR)).filter((x) => /^\d+-.+\.md$/.test(x))) {
  const ch = parseBookText(await fs.readFile(path.join(BOOK_DIR, name), 'utf8'), path.join(BOOK_DIR, name));
  for (const e of ch.entries) ids.add(e.id);
}

const index = await sourceUrlIndex();
const compact = (text) => String(text || '').replace(/\s+/g, '');

if (!chapter.intro.length) errors.push('缺少导读（章节标题和第一条之间要有说明段）');
chapter.entries.forEach((e, i) => {
  if (e.n !== i + 1) errors.push(`条号不连续：第 ${i + 1} 个是 ${e.n}`);
});
if (!chapter.entries.length) errors.push('一章至少要有条目');

const tagFields = [
  ['钱', 'money', ALLOWED.money],
  ['时间', 'time', ALLOWED.time],
  ['纪律', 'discipline', ALLOWED.discipline],
  ['收益', 'level', ALLOWED.level],
  ['口径', 'lens', ALLOWED.lens],
  ['行情', 'market', ALLOWED.market],
  ['周期', 'cycle', ALLOWED.cycle],
  ['人群', 'who', ALLOWED.who],
  ['优先级', 'priority', ALLOWED.priority],
];

for (const entry of chapter.entries) {
  const where = `第 ${chapter.n} 章第 ${entry.n} 条`;
  for (const field of REQUIRED_FIELDS) {
    const key = { 成本: 'cost', 说人话: 'human', 收益: 'gain', 依据: 'basis', 原文: 'quote', 出处: 'source', 失效: 'fail', 备注: 'note' }[field];
    if (!entry[key]) errors.push(`${where}: 缺 ${field}`);
  }
  if (!['A', 'B', 'C'].includes(entry.basis)) errors.push(`${where}: 依据必须是 A/B/C，现在是 "${entry.basis}"`);
  if (!/^https:\/\//.test(entry.sourceUrl)) errors.push(`${where}: 出处不是 https 链接`);
  if (charCount(entry.human) > 120) errors.push(`${where}: 说人话 ${charCount(entry.human)} 字，超过 120`);
  if (charCount(entry.quote) > 220) errors.push(`${where}: 原文 ${charCount(entry.quote)} 字，超过 220`);
  if (charCount(entry.quote) < 12) errors.push(`${where}: 原文太短，像转述`);
  if (/(稳赚|必赚|保证收益|包赚|暴富)/.test(entry.human + entry.gain)) errors.push(`${where}: 出现收益承诺式措辞`);
  if (/TODO|待核实/.test(entry.cost + entry.human + entry.gain + entry.quote + entry.note)) errors.push(`${where}: 还有 TODO/待核实`);
  if (!entry.tags.problems?.length) errors.push(`${where}: 缺少 问题= 标签`);
  for (const [label, field, allowed] of tagFields) {
    const actual = entry.tags[field];
    if (actual === undefined) { warnings.push(`${where}: 缺少标签 ${label}=`); continue; }
    for (const item of (Array.isArray(actual) ? actual : [actual])) {
      if (!allowed.includes(item)) errors.push(`${where}: 标签 ${label}=${item} 不在允许值里`);
    }
  }

  // 说人话
  if (!/[。！？]$/.test(entry.human)) errors.push(`${where}: 说人话结尾缺句号`);
  if (/\[[^\]]+\]\([^)]+\)|https?:\/\//.test(entry.human)) errors.push(`${where}: 说人话里不要放链接或网址`);

  // 逐字核对
  const found = index.get(normalizeUrl(entry.sourceUrl));
  if (!found) {
    errors.push(`${where}: 源码目录里找不到该原文 URL ${entry.sourceUrl}`);
  } else if (!compact(found.text).includes(compact(entry.quote))) {
    errors.push(`${where}: 原文没有逐字命中（quote 必须从 ${path.basename(found.file)} 里原样摘）`);
  }

  // 交叉引用
  for (const field of ['cost', 'human', 'gain', 'fail', 'note']) {
    for (const ref of refsIn(entry[field])) {
      if (!ids.has(`e-${ref.sec}-${ref.n}`)) errors.push(`${where}: ${field} 引用了不存在的第 ${ref.sec} 章第 ${ref.n} 条`);
    }
  }
  if (entry.basis === 'C' && !entry.note) warnings.push(`${where}: C 级最好在备注里说明为什么降级`);
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
const humane = chapter.entries.reduce((n, e) => n + charCount(e.human), 0);
const avg = chapter.entries.length ? Math.round(humane / chapter.entries.length) : 0;
console.log(`第 ${chapter.n} 章「${chapter.title}」${chapter.entries.length} 条：${errors.length} 个错误，${warnings.length} 个提醒；说人话平均 ${avg} 字`);
process.exit(errors.length ? 1 : 0);
