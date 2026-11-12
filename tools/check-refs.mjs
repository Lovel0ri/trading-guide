import { loadData, collectIds, refsIn } from './lib.mjs';

const data = await loadData();
const ids = collectIds(data.chapters);
const errors = [];

for (const chapter of data.chapters) {
  for (const entry of chapter.entries) {
    const where = `第 ${chapter.n} 章第 ${entry.n} 条`;
    for (const field of ['cost', 'human', 'gain', 'fail', 'note']) {
      for (const ref of refsIn(entry[field])) {
        const id = `e-${ref.sec}-${ref.n}`;
        if (!ids.has(id)) errors.push(`${where}: ${field} 引用了不存在的 ${id}`);
      }
    }
  }
}

for (const error of errors) console.error(`error ${error}`);
console.log(`检查交叉引用：${errors.length} 个错误`);
if (errors.length) process.exit(1);
