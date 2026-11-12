// 离线单文件版：把 data.json 内联进 index.html，生成一个双击就能看的 HTML。
// 用法：node tools/offline/build.mjs        → dist/主观交易指南.html
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../lib.mjs';

const outDir = path.join(ROOT, 'dist');
const outFile = path.join(outDir, '主观交易指南.html');

const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'data.json'), 'utf8'));

if (!Array.isArray(data.chapters) || !data.chapters.length) {
  throw new Error('data.json 里没有章节，先跑 node tools/build-data.mjs');
}

// 内联数据放在主脚本之前，init() 认到 window.__DATA__ 就不再发请求
const payload = JSON.stringify(data).replaceAll('</script', '<\\/script');
const inject = `<script>window.__DATA__ = ${payload};</script>\n`;
const marker = '<script>\n(() => {';
if (!html.includes(marker)) throw new Error('index.html 里找不到主脚本起点，版式改过了？');
const out = html.replace(marker, `${inject}${marker}`);

// file:// 下用不了相对资源，标题里点明这是离线版
const stamped = out.replace(
  '</title>',
  ` · 离线版</title>\n<meta name="generator" content="tools/offline/build.mjs · ${new Date().toLocaleDateString('sv-SE')}">`,
);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outFile, stamped);

const kb = Math.round(Buffer.byteLength(stamped) / 1024);
console.log(`离线单文件：${path.relative(ROOT, outFile)}（${kb} KB，${data.chapters.length} 章 ${data.meta.totalEntries} 条）`);
console.log('双击打开即可，不需要服务器。');
