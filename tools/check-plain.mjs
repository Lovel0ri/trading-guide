import { loadData, charCount } from './lib.mjs';

const data = await loadData();
const errors = [];
let total = 0;
let longest = { n: 0, where: '' };

for (const chapter of data.chapters) {
  for (const entry of chapter.entries) {
    const where = `第 ${chapter.n} 章第 ${entry.n} 条`;
    const n = charCount(entry.human);
    total += n;
    if (n > longest.n) longest = { n, where };
    if (n > 120) errors.push(`${where}: ${n} 字，超过 120`);
    if (/\[[^\]]+\]\([^)]+\)/.test(entry.human)) errors.push(`${where}: 说人话里不要放链接`);
    if (/https?:\/\//.test(entry.human)) errors.push(`${where}: 说人话里不要放网址`);
    if (!/[。！？]$/.test(entry.human)) errors.push(`${where}: 说人话结尾缺句号`);
  }
}

const count = data.chapters.flatMap((c) => c.entries).length;
for (const error of errors) console.error(`error ${error}`);
console.log(`人话检查 ${count} 条：平均 ${Math.round(total / count)} 字，最长 ${longest.n} 字（${longest.where}），${errors.length} 个错误`);
if (errors.length) process.exit(1);
