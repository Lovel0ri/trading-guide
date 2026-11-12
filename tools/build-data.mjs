import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadBook, buildMeta, charCount } from './lib.mjs';

const chapters = await loadBook();
const meta = buildMeta(chapters);
const data = { meta, chapters };

await fs.writeFile(path.join(ROOT, 'data.json'), JSON.stringify(data, null, 2) + '\n');

const rows = [];
for (const chapter of chapters) {
  for (const entry of chapter.entries) {
    const quote = entry.quote.replaceAll('|', '\\|').replaceAll('\n', ' ');
    const source = entry.source.replaceAll('|', '\\|');
    rows.push(`| ${chapter.n} | ${entry.n} | ${entry.title} | ${entry.basis} | ${quote} | ${source} |`);
  }
}

const doc = `# 引用对照

本文件由 \`tools/build-data.mjs\` 生成。改正文后重新生成，不要手改。

| 章 | 条 | 标题 | 依据 | 原文 | 出处 |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

共 ${meta.totalEntries} 条，A ${meta.grades.A} · B ${meta.grades.B} · C ${meta.grades.C}。原文引用只保留关键句，完整上下文请点出处链接。
`;

await fs.writeFile(path.join(ROOT, 'docs', '引用对照.md'), doc);

// ---- README：目录 —— 由正文生成，避免手写数字过时 ----
const articles = new Map();
for (const chapter of chapters) {
  for (const entry of chapter.entries) {
    const link = entry.links[0];
    if (!link) continue;
    if (!articles.has(link.url)) articles.set(link.url, { title: link.text, count: 0 });
    articles.get(link.url).count++;
  }
}
const articleRows = [...articles.entries()]
  .map(([url, item]) => `| [${item.title}](${url}) | ${item.count} 条 |`)
  .join('\n');

const catalog = chapters.map((chapter) => {
  const items = chapter.entries
    .map((entry) => `${entry.n}. ${entry.title}（${entry.basis}）`)
    .join('\n');
  return `### [第 ${chapter.n} 章 ${chapter.title}](${chapter.file})\n\n> ${chapter.subtitle}\n\n${items}`;
}).join('\n\n');

const readme = `# 主观交易指南

> 先活下来，再等大行情。

把主观短线交易的经验拆成可执行动作。全书 ${chapters.length} 章、${meta.totalEntries} 条，每条写明成本、说人话、收益、依据等级、原文、出处、失效条件和备注。原文逐字摘自公开文章，只取 2–3 句并保留原链接，不整篇转载。

| 条目 | 章节 | A 级 | B 级 | C 级 | 更新 |
| --- | --- | --- | --- | --- | --- |
| ${meta.totalEntries} 条 | ${chapters.length} / ${meta.chaptersPlanned} 章 | ${meta.grades.A} | ${meta.grades.B} | ${meta.grades.C} | ${meta.updated} |

## 怎么读

- 每条八个字段：**成本**要花多少时间和钱，**说人话**是把这条翻成日常说法，**收益**是换回什么，**依据**是原文可核对程度，**原文**是作者的 2–3 句原话，**出处**是知乎原链接，**失效**是这条什么时候反过来咬你，**备注**是补充或同章的指路。
- 依据等级衡量的是「原文可核对程度 + 条件完整度」，不是胜率，也不是收益保证：
  - **A**：原文明确、条件和边界都说清楚了，常有多篇互证。
  - **B**：原文明确，但只出现一次，或依赖资金体量、品种、波动环境。
  - **C**：不是作者直说，是按原文逻辑往外推的一步，当假设看待。
- 想看筛选和搜索，有四种打开方式：
  - **在线版（推荐分享）**：<https://lovel0ri.github.io/trading-guide/> —— GitHub Pages 托管，手机、电脑、任何人都能直接打开，\`git push\` 后约半分钟自动重建。
  - 局域网服务：在仓库根目录跑 \`./start.sh\`，终端会打印本机、局域网、mDNS 三个地址；手机连同一个 Wi-Fi，打开局域网那条（形如 \`http://192.168.1.10:8771/\`）就能看。
  - 只给本机：\`HOST=127.0.0.1 ./start.sh\`；换端口：\`PORT=9000 ./start.sh\`。
  - 离线单文件：跑 \`node tools/offline/build.mjs\`，双击生成的 \`dist/主观交易指南.html\`，不需要服务器，可以直接发给别人。

## 目录

${catalog}

## 原文来源

| 原文 | 支撑条目 |
| --- | --- |
${articleRows}

## 改正文之后

\`\`\`bash
node tools/build-data.mjs                 # 重建 data.json、docs/引用对照.md、本文件
node tools/check-content.mjs              # 字段、标签、条号
node tools/check-plain.mjs                # 说人话长度
node tools/check-quotes.mjs               # 原文逐字命中源码目录
node tools/check-refs.mjs                 # 交叉引用存在
node tools/offline/build.mjs              # 重出离线单文件（dist/）
git add -A && git commit -m "更新正文" && git push   # 推上去，GitHub Pages 自动重建
\`\`\`

写作规范见 [CLAUDE.md](CLAUDE.md)。

## 免责声明

本站是对公开交易文章的阅读笔记与结构化整理，不替代原文，不构成投资建议、收益承诺或具体买卖指令。交易有风险，亏钱很容易。
`;

await fs.writeFile(path.join(ROOT, 'README.md'), readme);

const totals = chapters.map((c) => `第 ${c.n} 章 ${c.entries.length} 条`).join(' · ');
console.log(`data.json: ${meta.totalEntries} 条 · ${chapters.length} 章 · ${totals}`);
console.log(`平均每条说人话 ${Math.round(chapters.flatMap((c) => c.entries).reduce((n, e) => n + charCount(e.human), 0) / meta.totalEntries)} 字`);
console.log(`README.md: ${articles.size} 篇原文，目录 ${chapters.length} 章`);
