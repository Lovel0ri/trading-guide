import { loadData, sourceUrlIndex, normalizeUrl } from './lib.mjs';

const data = await loadData();
const index = await sourceUrlIndex();
const errors = [];
const warnings = [];
let checked = 0;

const compact = (text) => String(text || '').replace(/\s+/g, '');

for (const chapter of data.chapters) {
  for (const entry of chapter.entries) {
    const where = `第 ${chapter.n} 章第 ${entry.n} 条`;
    const url = normalizeUrl(entry.sourceUrl);
    const found = index.get(url);
    if (!found) {
      errors.push(`${where}: 找不到原文 URL ${entry.sourceUrl}`);
      continue;
    }
    checked++;
    const source = compact(found.text);
    const quote = compact(entry.quote);
    if (!source.includes(quote)) {
      errors.push(`${where}: 原文没有逐字命中 ${url}\n  引用：${entry.quote.slice(0, 90)}`);
      continue;
    }
    if (/…|\.\.\./.test(entry.quote)) warnings.push(`${where}: 引用里有省略号，确认不是拼接`);
  }
}

for (const warning of warnings) console.warn(`warn  ${warning}`);
for (const error of errors) console.error(`error ${error}`);
console.log(`逐字核对 ${checked} 条引用：${errors.length} 个错误，${warnings.length} 个提醒`);
if (errors.length) process.exit(1);
