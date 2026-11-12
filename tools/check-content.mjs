import { loadBook, REQUIRED_FIELDS, ALLOWED, charCount } from './lib.mjs';

const chapters = await loadBook();
const errors = [];
const warnings = [];
const seen = new Set();
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

for (const chapter of chapters) {
  if (!chapter.intro.length) errors.push(`第 ${chapter.n} 章缺少导读`);
  const nums = chapter.entries.map((e) => e.n);
  nums.forEach((n, i) => {
    if (n !== i + 1) errors.push(`第 ${chapter.n} 章条号不连续：第 ${i + 1} 个是 ${n}`);
  });
  for (const entry of chapter.entries) {
    const where = `第 ${chapter.n} 章第 ${entry.n} 条`;
    if (seen.has(entry.id)) errors.push(`${where}: id 重复 ${entry.id}`);
    seen.add(entry.id);
    for (const field of REQUIRED_FIELDS) {
      const key = {
        成本: 'cost',
        说人话: 'human',
        收益: 'gain',
        依据: 'basis',
        原文: 'quote',
        出处: 'source',
        失效: 'fail',
        备注: 'note',
      }[field];
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
      if (actual === undefined) {
        warnings.push(`${where}: 缺少标签 ${label}=`);
        continue;
      }
      const list = Array.isArray(actual) ? actual : [actual];
      for (const item of list) {
        if (!allowed.includes(item)) errors.push(`${where}: 标签 ${label}=${item} 不在允许值里`);
      }
    }
    if (entry.basis === 'C' && !entry.note) warnings.push(`${where}: C 级最好在备注里说明为什么降级`);
  }
}

for (const warning of warnings) console.warn(`warn  ${warning}`);
for (const error of errors) console.error(`error ${error}`);
console.log(`检查 ${chapters.length} 章 ${seen.size} 条：${errors.length} 个错误，${warnings.length} 个提醒`);
if (errors.length) process.exit(1);
