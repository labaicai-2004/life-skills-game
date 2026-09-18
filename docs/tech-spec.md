# 技术规范文档

## 技术架构

应用为单文件网页：HTML、CSS 和 JavaScript 均在 `index.html`，不使用框架、npm、CDN 或第三方库。运行图片均为项目内 PNG；语音使用 Web Speech API，音效使用 Web Audio API，学习和研究记录保存在 LocalStorage。目标为 iPad Safari（iOS 15+），桌面 Chrome/Safari 用于调试。

| 层级 | 技术 | 用途 |
|---|---|---|
| 页面与样式 | HTML5、CSS3 | 屏幕切换、响应式布局、手绘卡通场景、动画与防意外选择 |
| 游戏逻辑 | 原生 JavaScript（ES6+） | 三关数据、步骤状态、手势、提示、奖励和完成流程 |
| 触控 | Touch Events + Mouse Events + AbortController | iPad 触摸与桌面鼠标的统一监听及及时清理 |
| 语音与音效 | SpeechSynthesis、Web Audio API | 中文女声 0.75 倍语速、柔和成功/庆祝音效 |
| 数据 | LocalStorage | 会话、研究记录、步骤记录和子步骤记录；旧记录保留 |

## 文件结构

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

`LEVELS` 定义三个任务：`laundry`、`fold-clothes`、`fold-umbrella`，各七步。`STEP_STATE_KEYS` 和 `SkillSceneState` 保存同一关内的已完成视觉状态；`StepProgress` 支持默认一次动作、洗衣正反面各 3 次揉洗及六片伞布逐次整理。`buildLaundryScene()`、`buildClothesFoldingScene()` 和 `buildUmbrellaFoldingScene()` 生成三关内容，`buildScene()` 只分派给这三种场景；`loadStep()` 保持背景稳定并切换步骤层。

`attachGestureListeners()` 为通用入口，洗衣、折衣和折伞使用各自的最小手势处理器。拖放要求超过 35% 的物品重叠；滑动有效距离为 40px，且须满足该步骤的正确方向。双手拧衣服还须向目标中心移动；伞的六片整理仅接受当前高亮片上由上至下的有效滑动；卷伞在正确方向滑动后由动画完成约 1.5 圈。全部触控目标不小于 44×44pt。

`AnimationController` 负责延迟示范、真实触摸后暂停和切换时清理。提示遵循语音、示范、箭头、发光目标的递进顺序。星星粒子每次不超过 8 个，庆祝彩纸不超过 50 个；音效短促、柔和且避免叠加过多。页面禁止意外缩放、拖动图片和文字选择。

## 数据与兼容

新研究技能值为 `clothes washing`、`clothes folding`、`folding umbrella`。步骤记录包含任务、关卡、步骤、时间、用时和提示等级；重复动作增加 `substep_complete`、当前次数、目标次数，伞布步骤增加片号。旧 `researchRecords`、`session_summaries` 和旧任务数据不改写；结束关卡只通过统一完成流程结束一次会话。

## 关键浏览器 API

| API | 用途 | iPad Safari |
|---|---|---|
| Touch Events | 单点触摸与拖动 | 支持 |
| Mouse Events | 桌面调试 | 支持 |
| SpeechSynthesis | 中文语音播报 | iOS 7+ |
| Web Audio API | 本地生成音效 | 支持 |
| CSS Custom Properties / Animations | 主题、提示和步骤过渡 | iOS 9.3+ |
| AbortController | 清理步骤监听 | iOS 12.2+ |

## 部署与本地预览

GitHub Pages 从 `main` 分支根目录发布：`git push` 后自动更新 https://labaicai-2004.github.io/life-skills-game/。本地预览可在项目目录运行：

```bash
python3 -m http.server 8080
```

同一 Wi-Fi 下，iPad 访问 `http://<Mac-IP>:8080/index.html`。发布前先运行两份 Node 自动检查，再用桌面浏览器和 iPad Safari 完整走查三关 21 步。

*文档版本：v2.0 | 更新日期：2026-09-18*
