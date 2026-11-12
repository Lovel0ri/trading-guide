# AGENTS.md

这个仓库是一本书：把主观短线交易的经验拆成可执行动作，正文在 `book/`，检索页在 `index.html`，数据由 `tools/build-data.mjs` 生成。

动手前先读两样：

- [CLAUDE.md](CLAUDE.md)——条目格式、字段规则、标签允许值、交叉引用规则、自检命令。改正文必须按它写。
- [README.md](README.md)——目录、依据等级说明、原文来源清单。README 是生成物，不要手改。

几条容易踩的：

- `data.json`、`docs/引用对照.md`、`README.md` 都是 `node tools/build-data.mjs` 的产物，改完正文重新生成，别手改。
- 改完一章先跑 `node tools/check-one.mjs book/<文件>`，0 错误再往下走；全书写完跑四个全局校验。
- 「原文」必须从 `04_tools/scripts/6-18日交易知识库` 里的文章逐字摘，改动一个字 `check-quotes` 就红。
- 页面文案里的章数、条数、样章标识都从 `data.json` 的 meta 取，不要在 HTML 里写死。
- 离线单文件版在 `dist/`，由 `node tools/offline/build.mjs` 生成，不入库；改了正文要重出一次。
