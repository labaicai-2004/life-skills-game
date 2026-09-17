# Task 4 收尾报告：清洗衣服七步场景

日期：2026-09-17

## 范围

本次收尾仅覆盖清洗衣服七步场景及其连续状态、示范动画、手势边界和真实浏览器检查。保留工作区已有的后三关实现与对应测试改动，不迁移洗脸和穿衣的后续旧断言。

## RED/GREEN 证据

前任已在 2026-09-16 日志中记录四个回归测试先行加入并确认失败，分别覆盖：冲洗完成后仍可继续拖动、冲洗中重新抓取从当前衣服位置开始、背面未揉洗前仍显示脏衣服、第 7 步第二只手被示范动画覆盖。本次收尾未删除这些测试。

最终定向命令：

```text
node --test tests/new-target-behaviors.test.js --test-name-pattern='laundry'
```

结果：32 项通过，0 项失败。

最终组合命令：

```text
node --test tests/new-target-behaviors.test.js tests/continuous-animation.test.js
```

结果：67 项中 59 项通过、8 项失败。8 项失败均为洗脸/穿衣后续任务仍引用旧 `wash`、`dress` 状态或旧关卡选择的已知断言，未改动其生产范围：

- `real ResearchMode.start initializes one unified session with the selected task on every initial event`
- `STEP_STATE_KEYS maps all three skills to their seven persistent-state keys`
- `SkillSceneState resets, completes mapped steps, and reports only completed keys`
- `handleStepSuccess stores the current level step in persistent state`
- `found, picked-up, rinsed, and jacket-found states render only in their intended later steps`
- `washing continuity indicators appear only after their required completed steps`
- `dressing continuity indicators follow completed steps and reveal the final collar only on real completion`
- `dressing final collar sparkle stays hidden during demonstration and generic prompt success`

同时运行 `git diff --check`，无空白错误。

## 实现与四项收尾点

1. 冲洗完成时保留衣服在水流区域的最终位置，并由完成状态锁定后续拖动/复位路径；冲洗计时器只在衣服持续处于水流重叠区约 2 秒后完成，离开、松手短放置或取消都会清理计时器。
2. 冲洗重新抓取使用当前衣服几何位置作为新的拖动起点，避免第二次抓取跳回初始位置。
3. 衣服清洁素材只在第 5 步自身三次揉搓完成后切换；第 4 步完成或仅有前置状态时，第 5 步仍显示脏衣服。
4. 第 7 步只让一只大手进入交互目标，另一只手为 `aria-hidden` 的被动伙伴，并限定示范动画在未暂停时运行，避免示范 CSS 覆盖儿童拖动后的伙伴手势。

场景还保留每步一个 `interactive-target`、延迟且 `aria-hidden` 的 `demo-laundry-{1..7}` 示范标记、连续状态标记以及第 5 步自动翻面、第 6 步泡泡渐隐和第 7 步完成星光。

## 真实浏览器检查

已在本机 Chrome（`http://127.0.0.1:8080/index.html`）手动完成完整七步流程：

- 第 1 步将脏衣服拖入水盆并进入下一步；
- 第 2 步点击水龙头，注水动画结束后进入下一步；
- 第 3 步点击洗衣液，起泡动画结束后进入下一步；
- 第 4 步横向揉洗三次；
- 第 5 步等待自动翻面后横向揉洗三次；
- 第 6 步将衣服拖到水流下并等待约 2 秒，进入第 7 步；
- 第 7 步拖动主手向中间，伙伴手向反方向同步，出现完成按钮和星光。

检查过程中第 7 步两只手均可见，且最终页面显示“完成关卡”。

仓库中的自动检查脚本为 `tests/laundry-browser-check.cjs`。当前命令行环境未安装 `playwright` 模块，因此该脚本无法在本环境启动（`MODULE_NOT_FOUND: playwright`）；真实流程已由上述 Chrome 检查覆盖。未为安装依赖扩大本任务范围。

## 交付文件

- `index.html`
- `tests/new-target-behaviors.test.js`
- `tests/continuous-animation.test.js`
- `tests/laundry-browser-check.cjs`
- `dev-logs/2026-09-15.md`
- `dev-logs/2026-09-16.md`
- `dev-logs/2026-09-17.md`
