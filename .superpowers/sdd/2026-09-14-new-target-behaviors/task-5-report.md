# Task 5：折叠衣服七步场景报告

## 结果

已只在 `fold-clothes` 中实现折叠衣服七步画面。每一步均保留同一件完整卫衣，顺序为平铺、抚平、画面左袖、画面右袖、画面左衣身、画面右衣身、下摆向上。语音和页面提示使用“这边”“另一边”，不要求儿童辨认左右。

## RED

先在 `tests/new-target-behaviors.test.js` 增加完整卫衣、七步顺序、单一主操作、延迟示范和跨步骤完成状态测试。运行 `node --test tests/new-target-behaviors.test.js --test-name-pattern="clothes folding"` 时，新增 2 项测试失败：`data-garment="whole-sweatshirt"` 和 `state-fold-flat` 均不存在，证明折衣场景尚未实现。

## GREEN

`index.html` 新增 `buildClothesFoldingScene(step)` 与 `buildClothesFoldingPersistentState(stepId)`。场景使用本地 `assets/folding/folding-table.png`、`sweatshirt-flat.png`，把袖子折入效果限制在同一卫衣容器内的裁切图层和变形中，没有显示为散落零件。现有通用拖放、35% 重叠判定和滑动逻辑直接复用；每屏只有一个 `.interactive-target`，触控区最小为 88px。七个 `demo-fold-clothes-*` 是独立、`aria-hidden` 的延迟示范，不与真实操作目标重叠。

`tests/continuous-animation.test.js` 的第二关旧洗脸断言已迁移到 `fold-clothes`，包括所选研究任务、状态键、连续示范、横向折叠动作和跨步骤保留。第三关旧穿衣断言未修改，留给 Task 6。

## 测试与自查

- `node --test tests/new-target-behaviors.test.js`：34/34 通过。
- `node --test tests/continuous-animation.test.js`：33/35 通过。失败的 2 项均为保留的旧穿衣连续性断言：`dressing continuity indicators...` 与 `dressing final collar sparkle...`。
- `git diff --check`：通过。
- 已检查：只使用本地折衣素材；洗衣代码与测试仍通过；标签和语音没有“左/右”；不含折叠伞实现。

## 疑虑

本轮运行环境未提供可控制的浏览器标签，因此未独立完成桌面端视觉点击验收；应在 Task 9 的 iPad Safari 预检中确认卫衣裁切折叠层的实际观感和手指拖放舒适度。

## 文件

- `index.html`
- `tests/new-target-behaviors.test.js`
- `tests/continuous-animation.test.js`
- `dev-logs/2026-09-17.md`
