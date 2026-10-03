# 离线使用与 iPad 安装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留现有儿童端三关 21 步与研究字段，实现完整离线使用、iPad 主屏幕安装、教师确认更新及安全迁移本地记录。

**Architecture:** `index.html` 继续承载页面和全部应用逻辑；根目录 `manifest.webmanifest` 描述安装，`service-worker.js` 管理同源静态资源的版本化完整缓存。教师端在现有研究面板提供状态、更新和备份/导入；本地研究数据仍由原有记录系统写入 localStorage，不经过 Service Worker。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Service Worker/Cache API、localStorage、Node 内建 `node:test`；不增加运行时框架或 CDN。

**Spec:** `docs/superpowers/specs/2026-10-03-offline-ipad-pwa-design.md`

## Global Constraints

- 保留绘本浮岛首页、儿童训练画面、三关各七步手势与动画、提示、奖励和正式 36 条 WAV 语音；自然女声候选不进入本轮缓存。
- 保持 `index.html` 作为应用代码主体；只新增 `manifest.webmanifest`、`service-worker.js`、必要本地图标/字体与测试文件。
- GitHub Pages 作用域为 `/life-skills-game/`；所有运行路径相对项目根目录，本地 HTTP 与生产 HTTPS 均须可用，`file://` 不宣称支持离线安装。
- 教师端才能看到安装、缓存、更新、备份和导入状态；训练中不得自动刷新或激活更新。
- 数据不上传、不改 `researchRecords` 字段；旧版三键备份可读，导入不得静默覆盖目标端数据。
- 无 iPad 实机验收不得宣布 iPad 离线 21 步完全通过；未经用户确认不得推送线上。
- 每任务只暂存该任务新增/修改文件，保留已有录音候选、日志和其他未提交改动。

## Review Focus

- 必需图片或音频有一个返回错误时，“离线已就绪”必须保持 false，旧完整缓存必须仍可用；Task 2 测试。
- 新版已下载而另一标签仍在训练时，更新按钮不能激活新版或刷新任何训练页；Task 3 测试。
- 旧三键备份、损坏 JSON 或错误字段类型不能覆盖已有记录；Task 4 测试。
- 导入相同记录与同身份不同内容记录时，前者跳过、后者停在冲突预览，不得合并丢失；Task 4 测试。
- localStorage 配额不足或中途写入失败时不能显示成功，原数据须恢复或报告无法恢复的确切键；Task 4 测试。

---

### Task 1: 本地资源与安装清单

**Files:**
- Create: `manifest.webmanifest`、`assets/icons/icon-192.png`、`assets/icons/icon-512.png`、`tests/offline-assets.test.js`
- Modify: `index.html`（`<head>` 中图标、清单和字体引用）
- Conditional create: `assets/fonts/zcool-kuaile.woff2`（许可与体积审查合格时）

**Interfaces:**
- Produces: 可从 `./` 解析的清单及图标路径；正式资源集合为 `index.html`、清单、两枚图标、13 张运行 PNG、`voice/v00.wav`–`v35.wav`、`music/xylophone.wav` 和实际使用的本地字体（如有）。Task 2 使用该集合。

- [ ] **Step 1: 写失败的资源测试。** `tests/offline-assets.test.js` 用 `node:test` 读取清单与 HTML，断言 `display === 'standalone'`、`start_url === './'`、`scope === './'`，两枚图标文件存在且为 192/512 像素；断言页面无运行时 Google Fonts 请求，36 个语音和音乐文件均存在，`LEVELS` 仍为三关各七步。用项目已有 `sips` 检查图标尺寸。
- [ ] **Step 2: 运行测试确认失败。** `node --test tests/offline-assets.test.js`，预期因缺少清单/图标或远程字体引用失败。
- [ ] **Step 3: 实现静态资源。** 用既有首页本地图制作两枚不失真的图标，不修改原图；在 `index.html` 加相对清单链接及 Apple touch icon。先核验 ZCOOL KuaiLe 字体授权和体积，许可通过则本地化同款字体并用 `@font-face` 保持原字体顺序；否则先进行系统字体截图比对，若明显变样则暂停并请用户选择，不擅自改儿童视觉。清单名称用“生活小能手”，主题色沿用现有 `--bg`，不包含新页面。
- [ ] **Step 4: 重跑检查。** `node --test tests/offline-assets.test.js tests/new-target-behaviors.test.js`，预期全通过；检查截图与当前首页布局一致。
- [ ] **Step 5: 仅提交本任务文件。** 提交信息：`Add local install metadata and offline-ready assets`。

### Task 2: 完整静态缓存与离线冷启动

**Files:**
- Create: `service-worker.js`、`tests/offline-service-worker.test.js`
- Modify: `tests/offline-assets.test.js`（校验 Worker 资源表与 Task 1 实际引用一致）

**Interfaces:**
- Consumes: Task 1 的相对资源集合。
- Produces: Worker 消息协议 `OFFLINE_STATUS` → `{type:'OFFLINE_STATUS_RESULT', version:string, ready:boolean, missing:string[]}`；`ACTIVATE_UPDATE` → `{type:'ACTIVATE_UPDATE_RESULT', accepted:boolean, reason:string}`；静态缓存名 `life-skills-static-<version>`。`ready` 仅在当前版本所有必需资源逐一存在时为 true。

- [ ] **Step 1: 写失败的 Worker 测试。** 在 `tests/offline-service-worker.test.js` 用 Node `vm` 和假的 Cache/Fetch/Clients 验证完整安装、一个 WAV 失败、重试、旧版本保留、离线 `./index.html` 导航、离线语音/音乐读取，以及不缓存跨源与导出文件。`tests/offline-assets.test.js` 比对资源表与实际 `assets/`、正式 `voice/`、`music/` 文件集合。
- [ ] **Step 2: 运行测试确认失败。** `node --test tests/offline-service-worker.test.js tests/offline-assets.test.js`，预期因缺少 Worker 或协议失败。
- [ ] **Step 3: 实现 Worker。** 安装时在新版本缓存逐一 `fetch` 和 `put`，失败时删除该不完整新缓存并拒绝安装，不删除旧缓存；状态消息遍历必需资源核验。导航离线返回已缓存 `index.html`，资源缓存命中优先；只拦截作用域内 GET 静态资源。新版待命不自行 `skipWaiting()`；激活成功后才清理旧静态缓存。`ACTIVATE_UPDATE` 的安全检查见 Task 3。
- [ ] **Step 4: 重跑检查。** `node --test tests/offline-service-worker.test.js tests/offline-assets.test.js`，预期全通过；在本地 HTTP 用桌面浏览器联网暖机、断网刷新确认主页和至少一个图片、WAV、音乐可读取。
- [ ] **Step 5: 仅提交本任务文件。** 提交信息：`Cache complete game resources for offline use`。

### Task 3: 教师端离线状态、安装指引和受控更新

**Files:**
- Modify: `index.html`（研究/教师面板与少量协调脚本）、`service-worker.js`（激活前客户端检查）
- Create: `tests/offline-controls.test.js`

**Interfaces:**
- Consumes: Task 2 的 `OFFLINE_STATUS`、`ACTIVATE_UPDATE` 消息协议。
- Produces: `OfflineCoordinator.init(): Promise<void>`、`OfflineCoordinator.refreshStatus(): Promise<void>`、`OfflineCoordinator.requestUpdate(): Promise<boolean>`；Worker 对每个受控客户端发 `TRAINING_STATE_QUERY`，客户端回 `{active:boolean}`，超时或无响应视为 active。训练判定以 `state.currentLevel >= 0`、`SessionManager.active` 或庆祝页仍开放为准。

- [ ] **Step 1: 写失败的教师端测试。** 在 `tests/offline-controls.test.js` 检查研究面板有状态、重试、安装指引、更新按钮且儿童关卡无安装提示；模拟 `ready=false`、等待中的新版、当前/其他标签训练中、客户端超时、训练结束后的教师确认，分别断言按钮文案和是否发 `ACTIVATE_UPDATE`。Worker 测试增加训练中或无响应拒绝激活、全部空闲才接受。
- [ ] **Step 2: 运行测试确认失败。** `node --test tests/offline-controls.test.js tests/offline-service-worker.test.js`，预期缺少教师端控制和查询协议。
- [ ] **Step 3: 实现协调逻辑。** 页面从 `./service-worker.js` 注册 `scope:'./'`，只在教师端查询缓存状态；初始化、网络恢复和手动重试时重查。教师手动点击更新后 Worker 查询所有同作用域客户端，只有全部明确空闲才调用 `skipWaiting()`；`controllerchange` 仅在当前页空闲且有本次明确确认时刷新。新缓存未完整、他处训练中或客户端状态未知时保持旧版本并给教师可理解提示。Safari 展示手动“分享 → 添加到主屏幕”，支持安装事件的浏览器可显示原生安装入口；不支持时仅显示说明。
- [ ] **Step 4: 重跑检查。** `node --test tests/offline-controls.test.js tests/offline-service-worker.test.js tests/new-target-behaviors.test.js`，预期全通过；浏览器检查更新待命时儿童训练不中断，教师端控件在 iPad 宽度不遮挡原研究表单。
- [ ] **Step 5: 仅提交本任务文件。** 提交信息：`Gate offline updates behind teacher confirmation`。

### Task 4: 备份扩展与安全迁移

**Files:**
- Modify: `index.html`（现有 `backupData()`、`restoreData()`、研究/教师面板）
- Create: `tests/offline-data-transfer.test.js`

**Interfaces:**
- Produces: `DataTransfer.buildBackup(storage): object`、`DataTransfer.previewImport(rawText, storage): {valid:boolean, counts:object, duplicates:object, conflicts:object, merged:object, errors:string[]}`、`DataTransfer.applyImport(preview, storage): {ok:boolean, restored:boolean, failedKeys:string[]}`；以上是 `index.html` 内纯函数/对象方法，供原按钮调用，不新增应用代码文件。

- [ ] **Step 1: 写失败的数据测试。** 用内存 localStorage 测试新版五键导出、旧三键兼容、损坏 JSON/数组外形错误、重复步骤、同一逻辑身份但内容不同、参与者合并、生活技能计数冲突、`researchSession` 不恢复活动状态、存储写入中途抛错与回滚。记录身份：`researchRecords` 以 `participantID+taskId/skill+phase+sessionNumber+stepNumber+timestamp` 判断冲突，同字段完全相同才跳过；摘要优先 `sessionId`，缺失时以 `participantID+date+time+taskName` 判断。测试断言未确认时 localStorage 不变。
- [ ] **Step 2: 运行测试确认失败。** `node --test tests/offline-data-transfer.test.js`，预期缺少安全预览/合并接口。
- [ ] **Step 3: 实现导出、预览和确认导入。** `backupData()` 发起带格式版本与导出时间的五键 JSON 下载；`restoreData()` 改为文件读取后预览，只有显式确认才写入。完全相同记录跳过，同身份不同内容阻止提交并要求先备份/处理；原目标数据保留，参与者去重，生活技能计数冲突保留目标值并提示。写入前抓取五键原始快照，失败则逐键回滚并报告未恢复键；不要提示假成功。上次备份时间与新增会话数以本机成功发起导出时保存的 `sessionId` 集合为参照，并标注“请核对下载文件”。
- [ ] **Step 4: 重跑检查。** `node --test tests/offline-data-transfer.test.js tests/new-target-behaviors.test.js`，预期全通过；隔离浏览器环境模拟 Safari 旧记录导出与新应用导入，确认原目标记录不减少。
- [ ] **Step 5: 仅提交本任务文件。** 提交信息：`Protect local research data during PWA migration`。

### Task 5: 全流程回归与交付说明

**Files:**
- Modify: `docs/tech-spec.md`、`docs/implementation-plan.md`、当日 `dev-logs/YYYY-MM-DD.md`（仅追加本任务章节，不覆盖用户已有内容）
- Create: `docs/testing/YYYY-MM-DD-offline-ipad-acceptance.md`

**Interfaces:**
- Consumes: Tasks 1–4 的运行产物；不修改游戏逻辑。
- Produces: 自动与手工验收证据，以及教师安装/备份/更新的简明操作说明。

- [ ] **Step 1: 写完整验收清单。** 包括本地 HTTP/线上 HTTPS、首次下载、断网冷启动、三关 21 步、36 条正式语音的资源就绪、木琴音乐、研究记录、备份导出/导入、失败资源与容量不足、待更新期间训练以及 Safari→主屏幕迁移；清单将桌面和 iPad 实机结果分开。
- [ ] **Step 2: 跑全部自动检查。** `node --test tests/*.test.js`，预期全通过；若既有测试因外部服务/设备限制无法运行，逐项记录，不写“全通过”。
- [ ] **Step 3: 桌面浏览器实际走查。** 独立测试存储中走三关 21 步；联网暖机后断网刷新和重启，检查图片、语音、音乐及本地记录；导入用测试数据，不访问或改写真实儿童数据。
- [ ] **Step 4: 更新文档并记录真机边界。** 把可复现的教师操作写入 `docs/tech-spec.md`，在实施计划和当日日志记录桌面结果；iPad 15+ Safari 与主屏幕应用需教师实机完成飞行模式、21 步、备份迁移验收，未做则标“待实机”，不能代填通过。
- [ ] **Step 5: 仅提交本任务文件。** 提交信息：`Document offline acceptance and teacher workflow`。若当日日志已有别的未提交工作，只追加本任务记录但不整份暂存，以免带入无关改动；其余本任务文档和测试报告单独提交。完成后向用户报告实际通过项与待验项；取得用户确认前不执行 `git push`。
