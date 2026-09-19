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

## Fix round：独立审查修复

审查指出第一步的桌面目标区无法与 300×270 的完整卫衣达到 35% 重叠，第二步会接受空白起始和向上滑动，且后续折叠状态缺少稳定的可见层。先增加了 mouse/touch 的真实事件路径测试：第一步 34.7% 重叠不通过、35.3% 通过；第二步空白起始和向上不通过、从卫衣操作区向下超过 40px 通过。测试在旧实现上失败后，扩大桌面实际命中区至 56%×78%，但把可见虚线框收在中央，避免覆盖整个桌面；第2步增加仅该步使用的手势监听；每一个已完成状态均在同一卫衣容器中激活独立可见层，最后一步切换到本地 folded 素材。第4步语音改为“再把另一边的袖子折进来”。

修复后 `node --test tests/new-target-behaviors.test.js` 为 40/40 通过。完整命令 `node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js` 为 73/75 通过，剩余 2 项均为 Task 6 的旧穿衣断言失败。

## Fix round 2：起点与目标分离

复审发现第一步卫衣原本位于中央大目标内，且部分后续操作框会与目标重叠，可能在按下后不移动便完成。新增唯一的 `FOLD_LAYOUT`，让真实场景和测试共用每步的起点与目标：第1步卫衣从桌面左侧开始，中央目标可完整容纳卫衣；第3至6步的操作区分别从两侧开始；第7步下摆从下方开始并拖向上方小目标。通用拖放同时要求移动至少 40px，仍以 35% 重叠作为通过判定。

`tests/new-target-behaviors.test.js` 新增基于该真实布局的 mouse/touch 路径验证：第1、3至7步原地按下松开均不通过，拖到配置目标均通过；第1步真实拖放仍可达到并通过 35% 重叠。修复后该测试文件为 42/42 通过；组合命令为 75/77 通过，剩余 2 项仍仅为 Task 6 的旧穿衣断言。
