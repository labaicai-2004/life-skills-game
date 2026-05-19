# CLAUDE.md — 生活小能手 项目指引

## 项目简介

"生活小能手"是一个面向智力障碍儿童的 iPad 交互游戏网页应用，帮助儿童学习刷牙、洗脸、穿衣三项日常生活技能。每项技能拆分为 7 个步骤，通过语音引导 + 大图展示 + 手势交互完成训练。

- **目标用户**：智力水平相当于正常 2-4 岁儿童的智力障碍儿童
- **运行平台**：iPad Safari（同时兼容桌面端调试）
- **用户背景**：项目主理人为非技术背景
- **线上地址**：[labaicai-2004.github.io/life-skills-game/](https://labaicai-2004.github.io/life-skills-game/)
- **GitHub 仓库**：[github.com/labaicai-2004/life-skills-game](https://github.com/labaicai-2004/life-skills-game)

---

## 标准文件路径索引

所有项目规范文档位于 `docs/` 目录：

| 文档 | 路径 | 内容 |
|------|------|------|
| 开发需求 | [docs/requirements.md](docs/requirements.md) | 功能需求、非功能需求、用户故事、约束条件 |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术选型、代码架构、API 使用、手势算法、部署方案 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 色彩系统、排版、触控设计、场景设计、动画/音效规范 |
| 执行步骤 | [docs/implementation-plan.md](docs/implementation-plan.md) | 开发阶段规划（P0-P5）、当前进度、下一步计划 |

每日开发记录位于 `dev-logs/` 目录，文件名格式 `YYYY-MM-DD.md`。

---

## 工作说明

### 开始任何开发工作前

1. **先读执行步骤文档**：[docs/implementation-plan.md](docs/implementation-plan.md) — 确认当前所处阶段和下一步计划
2. **再读相关规范文档**：根据任务类型查阅技术规范或设计规范
3. **在 dev-logs/ 创建当日日志**：记录计划要做的事项
4. **向用户确认**：在执行具体修改前，用简洁的语言告知用户计划做什么、预计影响范围，获得确认后再动手

### 修改代码时

1. **单文件原则**：所有应用代码在 `index.html`（当前约 1176 行）中，不拆分为多个文件
2. **禁止引入外部依赖**：不使用 npm 包、CDN 资源、第三方库
3. **修改范围克制**：只改与当前任务直接相关的代码，不做顺手重构
4. **每次修改后验证**：在桌面浏览器中确认 21 个步骤均可正常走通
5. **同步更新文档**：如修改涉及规范变更，同步更新 `docs/` 中对应文件

### 修改完成后

1. 更新 `dev-logs/` 当日日志，标记完成事项
2. 告知用户修改了什么、为什么改、如何验证
3. 如修改已稳定，推送到 GitHub：`git add` → `git commit` → `git push`

### 项目特定规则

- **不引入框架**：不使用 React/Vue/jQuery 等任何框架
- **不引入外部资源**：图片文件放置在项目目录内，不引用 CDN
- **不出现在页面上**：代码中的注释只写技术性 WHY，不写 WHAT
- **优先保证稳定性**：新功能不影响已有 21 步的正常运行
- **触控目标**：所有可交互元素 ≥ 44×44pt
- **手势宽容**：滑动阈值 40px，拖拽重叠 35%，方向大致对即通过
- **不出现负面反馈**：没有红色警告、没有❌符号、没有"错了"等否定词汇
- **语音优先**：所有引导以中文语音为主要载体，文字只是辅助
- **女声 0.75x**：语音合成使用中文女声，语速 0.75 倍

### 部署

- 线上地址：`https://labaicai-2004.github.io/life-skills-game/`
- 部署方式：GitHub Pages（`main` 分支根目录）
- 更新方式：`git push` 后自动部署
- 本地预览：`python3 -m http.server 8080`，Mac IP `10.70.176.223`

### 与用户沟通

- 用户为非技术背景，避免使用技术术语
- 用"网页/文件/点击"等日常用语替代"部署/构建/触发"等技术词汇
- 所有操作说明给出具体步骤，不要假设用户知道怎么做
- 每个阶段开始前，用一两句话说明要做什么、为什么做、产出什么

---

## 快速链接

- 主应用文件：[index.html](index.html)（1176 行，单文件完整应用）
- 开发日志目录：[dev-logs/](dev-logs/)
- 文档目录：[docs/](docs/)
- 线上地址：[labaicai-2004.github.io/life-skills-game/](https://labaicai-2004.github.io/life-skills-game/)
