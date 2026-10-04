# 技术规范文档

## 技术架构

应用为单文件网页：HTML、CSS 和 JavaScript 均在 `index.html`，不使用框架、npm、CDN 或第三方库。运行图片均为项目内 PNG；语音使用项目内固定 WAV 录音，音效使用 Web Audio API，学习和研究记录保存在 LocalStorage。目标为 iPad Safari（iOS 15+），桌面 Chrome/Safari 用于调试。

| 层级 | 技术 | 用途 |
|---|---|---|
| 页面与样式 | HTML5、CSS3 | 屏幕切换、响应式布局、手绘卡通场景、动画与防意外选择 |
| 游戏逻辑 | 原生 JavaScript（ES6+） | 三关数据、步骤状态、手势、提示、奖励和完成流程 |
| 触控 | Touch Events + Mouse Events + AbortController | iPad 触摸与桌面鼠标的统一监听及及时清理 |
| 语音与音效 | 本地 WAV、HTML Audio、Web Audio API | 固定婷婷女声慢速录音、柔和成功/庆祝音效 |
| 数据 | LocalStorage | 会话、研究记录、步骤记录和子步骤记录；旧记录保留 |

## 文件结构

2026-10-04 离线补充：根目录新增 `manifest.webmanifest` 与 `service-worker.js`，`assets/icons/` 存放 192/512 像素安装图标。页面仍由单个 `index.html` 承载，不引入框架或运行时 CDN。原远程字体链接已移除；目前使用现有系统中文字体回退，桌面小屏首页已截图检查，iPad 上的字体视觉仍待实机核对。`service-worker.js` 以相对路径完整缓存首页、清单、图标、13 张运行图片、36 条正式 WAV 与木琴音乐；任一必需资源下载失败时不能宣称离线就绪，旧完整版本保持可用。缓存只包含静态资源，不包含研究记录、下载报告或第三方请求。

教师可在研究设置底部看到“离线已就绪”和版本号。首次安装先在线打开 HTTPS 页面，等待该状态，再在 iPad Safari 的“分享”菜单中选“添加到主屏幕”。安装后先联网打开一次主屏幕图标，确认同样显示离线就绪，再切飞行模式验证。`file://` 不支持此安装流程；本机 `localhost` 的 HTTP 只用于桌面测试。新版资源下载完成后不会自行切换；教师在所有训练窗口退出后手动确认更新，任一窗口训练中或状态未知均保持旧版。训练中不会因 `controllerchange` 自动刷新。

每次正式发布静态文件变更，都要同步更新 `service-worker.js` 中的 `STATIC_VERSION` 并检查 `STATIC_FILES` 清单；否则已经安装的页面可能继续使用旧缓存。新版安装失败时保持旧缓存和旧版运行，修复资源后再联网重试。版本升级不迁移或删除 localStorage 数据。

研究数据仍留在本机 localStorage。Safari 标签页与主屏幕应用可能有独立数据空间，不能仅凭安装图标推定旧记录已迁移。迁移前在旧入口的教师面板点击“立即备份”，核对已下载的 JSON 文件；在新入口点击“导入旧记录”，先看预览、重复项与冲突，再明确确认。备份包含 `researchRecords`、`session_summaries`、`researchParticipants`、`researchSession` 和 `life-skills-records`，可读旧三键备份。相同记录跳过，同身份但内容不同的记录阻止导入；参与者合并，生活技能计数冲突保留目标端值，导入的 `researchSession` 不恢复活动训练。导入写入失败时尝试恢复原有键并报告未恢复项。教师端备份提醒记录“发起备份”的时间和此后新增的 Session 数，不等于已经核实文件落盘；请自行检查下载文件，并定期另存一份。

背景音乐使用本地 `music/xylophone.wav`，通过 Web Audio 解码为 AudioBuffer 循环播放并经 GainNode 控制音量，兼容 iPad 对 HTMLMediaElement.volume 的限制。音频首次真实点击后加载，加载或解码失败不阻断训练；同时只保留一个音乐声源，语音播放时压低增益，退出和后台时停止。素材由 `scripts/generate-xylophone.py` 以 Python 标准库可重复生成。

```
生活技能 数字化严肃游戏/
├── index.html
├── assets/
│   ├── laundry/          # laundry-room、脏/净上衣、水盆、洗衣液
│   ├── folding/          # folding-table、展开/折好卫衣
│   └── umbrella/         # umbrella-room、打开/收拢/卷好折叠伞
├── tests/
│   ├── new-target-behaviors.test.js
│   └── continuous-animation.test.js
├── docs/
│   ├── requirements.md
│   ├── tech-spec.md
│   ├── design-spec.md
│   └── implementation-plan.md
└── dev-logs/
    └── YYYY-MM-DD.md
```

`/Users/labaicaimac/Desktop/游戏风格.jpg` 只作为外部画风参考，不属于项目运行资源，也不在本任务中删除。

## 代码结构

折叠伞清晰度更新：`umbrella-core` 为七步共用原生 SVG，旧 PNG 图层不再显示但暂保留历史资源。层次为伞杆 1、伞布 3、卷绕纹理 4、伞帽 5、扣带 6、手指及真实操作层 7–10。`umbrellaRoll` 仅沿中心缩窄与轻微偏斜，不再 rotateY；纹理按三次半圈视觉周期移动，保留 1500ms 完成时机。桌面整体 1.25 倍放大时，指针位移除以显示比例再更新本地坐标，成功方向仍按实际 40px、35% 判断。缩杆由 `--umbrella-shorten` 跟随真实向上拖动且限制为 0–54px，握持手的横向偏移抵消，取消时恢复。理布真实手层只在接触时显示，不改六片进度及研究事件。

2026-10-01 更新：洗衣第 7 步复用 `laundry-rub-shirt` 大衣物布局但不创建污渍层；双手及中央手势目标由该步 CSS 定位，完成变换保留 `translateX(-50%)`。每次 `speak()`（含缓存重播）设置 `playbackRate=1.2`、`preservesPitch=true` 与 Safari 兼容音高属性，仅影响固定录音播放，不调整研究等待计时或数据字段。

`LEVELS` 定义三个任务：`laundry`、`fold-clothes`、`fold-umbrella`，各七步。`STEP_STATE_KEYS` 和 `SkillSceneState` 保存同一关内的已完成视觉状态；`StepProgress` 支持默认一次动作、洗衣正反面各 3 次揉洗及六片伞布逐次整理。`buildLaundryScene()`、`buildClothesFoldingScene()` 和 `buildUmbrellaFoldingScene()` 生成三关内容，`buildScene()` 只分派给这三种场景；`loadStep()` 保持背景稳定并切换步骤层。

`attachGestureListeners()` 为通用入口，洗衣、折衣和折伞使用各自的最小手势处理器。拖放要求超过 35% 的物品重叠；滑动有效距离为 40px，且须满足该步骤的正确方向。双手拧衣服还须向目标中心移动；伞的六片整理仅接受当前高亮片上由上至下的有效滑动；卷伞在正确方向滑动后由动画完成约 1.5 圈。全部触控目标不小于 44×44pt。

折衣使用 `attachClothesFoldingGesture()` 更新场景的 `--fold-*` 进度。原卫衣图片切成中心、衣身与嵌套袖子的原生 CSS 纹理面，沿 `transform-origin` 作透视翻转；袖子作为衣身子元素随父面一起折入。取消或场景 AbortSignal 恢复未完成姿态，不记成功；有效松手记录完成，持续状态驱动 0.85 秒落定。衣摆在 135px 折线翻转，最终成品延迟淡入；透明度与变换过渡需共存，避免样式覆盖导致衣摆提前消失。示范布片层独立且不接收事件，不引入外部依赖。

洗衣第 4、5 步的 `laundry-rub-shirt` 复用干净衣服 PNG，叠加同等比例的 SVG 三组 `.laundry-stain`；有效揉洗调用原有 `advanceStepProgress()` 后，按当前次数给对应污渍添加 `washed`，CSS 仅过渡透明度。取消/退出不推进次数，示范无污渍写入；三次完成后保留原有 `frontRubbed` / `backRubbed` 状态及子步骤事件，进入冲洗仍用原干净衣服资源。背面入场翻转衣服与污渍整体，污渍在翻转中段显现；第 5 步仍等待既有 900ms 翻面完成再接受揉洗。`laundryHand()` 只用于洗衣，其他关卡的 `svgHand()` 不改动。

`AnimationController` 负责延迟示范、真实触摸后暂停和切换时清理。场景的 `data-prompt-level` 统一控制新指引、高亮与示范：L0 独立、L1 视觉、L2 方向、L3 语音、L4 示范。教学从 L0、练习从 L1 开始，评估固定 L0。L4 不再自动完成；真正播放示范时将 `promptUsed` 至少设为 4，完成仍须真实手势。星星粒子每次不超过 8 个，庆祝彩纸不超过 50 个；音效短促、柔和且避免叠加过多。页面禁止意外缩放、拖动图片和文字选择。

提示初始化、延迟语音和提示升级使用 `sceneTimeout`，同时校验场景版本、关卡和步骤；退出、切换或成功时清理。退出动画回调也检查场景版本，不能重新挂载过期步骤。物品动作计时器由对应手势的 AbortSignal 清理。

普通练习（`!ResearchMode.active`）不进入研究 LTM 等待链，`loadStep()` 立即调用当前指令；研究模式且提示开启时仍按原等级等待，评估不自动播报。每次切步先 `stopVoice()`，避免旧句跨步骤残留。`prepareVoice()` 以文件名缓存并预载 HTML Audio，在进入关卡时预载现有 36 条录音（合计约 4.4MB），重播从 0 秒开始。每次播放增加版本编号，避免同一个播放器上次播放的迟到失败回调打断新播报或恢复背景音乐音量。预载是浏览器提示，不保证弱网或 iPad 的零延迟；实际启动仍需设备验证。

## 数据与兼容

研究步骤仍以 `researchRecords` 为主要实验数据。步骤完成时若本机存储写入失败，`UnifiedDataManager` 把原记录留在当前页面内存的待保存队列；后续步骤或教师点击“重试保存步骤记录”时一并重试。相同身份且内容完全相同的记录不会重复写入；相同身份但内容不同、旧数据结构损坏或配额不足时，保留待保存记录并在研究者面板持续提醒，不中断儿童端。待保存队列不会跨页面刷新保留，故出现提醒时须在关闭页面前重试或导出文件。

教师“立即备份”会把待保存步骤合入下载的 `researchRecords`，但不会把未写入的步骤假称为已保存到本机。若原有数据无法解析或与待保存步骤冲突，仅发起 `unsaved_steps_*.json` 抢救文件下载：文件包含待保存步骤和原 `researchRecords` 原始文本，不标记为完整备份，也不更新上次备份时间。教师需核对文件并保留旧设备；正常备份与抢救文件均不上传。`session_summaries` 继续保留用于会话摘要，不能替代 `researchRecords` 分析。

新研究技能值为 `clothes washing`、`clothes folding`、`folding umbrella`。步骤记录包含任务、关卡、步骤、时间、用时和提示等级；重复动作增加 `substep_complete`、当前次数、目标次数，伞布步骤增加片号。旧 `researchRecords`、`session_summaries` 和旧任务数据不改写；结束关卡只通过统一完成流程结束一次会话。

`ResearchParticipants` 将已使用的儿童编号保存在 `researchParticipants`，并与 `researchRecords`、`session_summaries`、最近 `researchSession` 中的旧编号合并去重，因此升级后旧数据会自动出现为快捷选择。`getResearchRecords(participantID)` 仅在看板和导出时筛选，不改写原始记录；`buildResearchCSV(records)` 共用原字段顺序，可生成单一儿童或全部儿童的 CSV。

## 关键浏览器 API

| API | 用途 | iPad Safari |
|---|---|---|
| Touch Events | 单点触摸与拖动 | 支持 |
| Mouse Events | 桌面调试 | 支持 |
| HTML Audio + PCM WAV | 固定婷婷中文语音播报 | iOS 15+ |
| Web Audio API | 本地生成音效 | 支持 |
| CSS Custom Properties / Animations | 主题、提示和步骤过渡 | iOS 9.3+ |
| AbortController | 清理步骤监听 | iOS 12.2+ |
| Service Worker + Cache API | 完整静态缓存、离线启动与受控更新 | iOS 15+，需 HTTPS／localhost |
| Web App Manifest + Apple touch icon | 主屏幕安装元数据与图标 | iOS 15+，由 Safari 安装 |

## 部署与本地预览

GitHub Pages 从 `main` 分支根目录发布：`git push` 后自动更新 https://labaicai-2004.github.io/life-skills-game/。本地预览可在项目目录运行：

```bash
python3 -m http.server 8080
```

同一 Wi-Fi 下，iPad 可用 `http://<Mac-IP>:8080/index.html` 调试普通页面；该非 localhost HTTP 地址不能代替正式 HTTPS 的离线安装验收。发布前运行 `node --test tests/*.test.js`，在桌面与 iPad Safari 分别走查三关 21 步。离线开发验收详情见 `docs/testing/2026-10-04-offline-ipad-acceptance.md`；尚未推送的工作区版本不会自动出现在 GitHub Pages。

*文档版本：v2.2 | 更新日期：2026-10-04*
