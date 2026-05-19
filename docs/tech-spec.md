# 技术规范文档

## 技术架构

### 整体方案

**单文件网页应用（Single-File Web App）+ 本地 PNG 图片素材**

所有 HTML、CSS、JavaScript 内联在一个 `index.html`（约 1176 行）文件中，场景物品使用项目目录内的 PNG 图片，无外部 CDN 依赖。

### 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 结构 | HTML5 | 语义化标签，屏幕切换架构 |
| 样式 | CSS3 | CSS 自定义属性、Flexbox、CSS 动画、CSS 绘图（衣物等） |
| 逻辑 | 原生 JavaScript (ES6+) | 无框架，无依赖 |
| 语音 | Web Speech API (SpeechSynthesis) | 系统自带中文语音，优先女声 |
| 音效 | Web Audio API (OscillatorNode) | 代码生成音效，无需音频文件 |
| 触控 | Touch Events API | 单点触控手势识别 + AbortController 管理监听器生命周期 |
| 图片 | PNG 格式 | 本地文件，包含背景/人物/物品/手部 |

---

## 文件结构

```
生活技能 数字化严肃游戏/
├── index.html             # 主应用文件（约 1176 行）
├── CLAUDE.md              # AI 助手指引
├── bathroom-bg.png        # 浴室场景背景
├── brush-boy.png          # 刷牙步骤人物
├── cartoon-boy.png        # 通用人物照片
├── cup.png                # 水杯
├── hand.png               # 手部（拖拽交互用）
├── sink-faucet.png        # 洗漱台水龙头
├── toothbrush.png         # 牙刷
├── toothpaste.png         # 牙膏
├── towel.png              # 毛巾
├── style-preview.html     # 样式预览页
├── docs/
│   ├── requirements.md    # 开发需求文档
│   ├── tech-spec.md       # 技术规范文档（本文件）
│   ├── design-spec.md     # 设计规范文档
│   └── implementation-plan.md # 执行步骤文档
└── dev-logs/
    └── YYYY-MM-DD.md      # 每日开发日志
```

---

## 代码架构（index.html 内部结构）

### CSS 层（~260 行）

```
:root 变量定义
  ├── 颜色系统（背景/主色/成功/文字）
  ├── 圆角/阴影系统
  └── 字体大小系统（clamp() 响应式）

基础样式
  ├── Reset & 全局样式
  ├── 屏幕切换系统（.screen / .active）
  └── iPad 优化（禁止缩放、禁止选择）

页面样式
  ├── 开始页（标题 + 关卡卡片）
  ├── 游戏页（顶栏 + 进度点 + 交互区域）
  └── 庆祝弹窗

场景元素
  ├── 场景容器（.scene / .scene-bg / .step-stage）
  ├── 拖拽物品（.draggable-item / .drag-target）
  ├── 目标区域可视化（.drag-target::after 脉动虚线框）
  ├── 拖放区高亮（.drop-zone 发光框 + .drop-zone-label 标签）
  └── 箭头指引（.arrow-badge / .arrow-label）

动画系统
  ├── stageIn / stageOut（步骤切换 0.45s / 0.25s）
  ├── slideUp/Down/Left/Right（箭头滑动 1.2s 循环）
  ├── tapPulse（点击提示 1s 循环）
  ├── targetPulse（目标框脉动 1s 循环）
  ├── zoneGlow（拖放区发光 0.9s 循环）
  ├── bounce / shake / floatUp / confettiFall
  └── 交互反馈（.success / .wrong）
```

### HTML 层（~100 行）

```
隐藏 SVG defs（渐变色定义）

#start-screen
  ├── 装饰背景
  ├── 标题（🌟 + 生活小能手）
  └── 三张关卡卡片（刷牙/洗脸/穿衣）

#game-screen
  ├── 顶栏（返回按钮 + 进度圆点 + 音量按钮）
  ├── 步骤标题区域
  └── 交互区域#interaction-area
      └── 场景容器#scene（背景 + 步骤内容分层）

#celebration（弹窗叠加层）

#particles-container（粒子特效层）
```

### JavaScript 层（~700 行）

```
图片工厂函数
  ├── svgToothbrush() / svgToothpaste() / svgHand()
  ├── svgTowel() / svgCup() / svgJacket()
  ├── svgFace() / svgMirror() / svgFaucet() / svgSink()
  └── childPhoto() / sinkFaucetImg()

数据层
  └── LEVELS[] — 3 关 × 7 步完整数据

状态管理
  └── state 对象（含 stepAbortController）

音频系统
  ├── Web Audio API 音效（playTone / playSuccessSound / playWrongSound / playCelebrationSound）
  ├── getBestVoice() — 异步选择最优中文女声
  └── speak() — 语音合成（0.75x 语速）

场景渲染
  ├── loadStep() — 加载步骤（背景持久化 + step-stage 动画过渡）
  ├── buildScene() — 按关卡/步骤生成场景 HTML
  ├── stepStageHTML() — 步骤内容包装器
  └── arrowHTML() + arr*() — 7 种箭头指引

手势识别
  ├── attachGestureListeners() — AbortController 管理监听器
  ├── checkMatch() — 宽容手势匹配
  └── 拖拽判定（touch + mouse 双通道、35% 重叠阈值）

流程控制
  ├── handleStepSuccess() — 2s 后自动进入下一步
  ├── handleStepWrong() — 0.6s 后恢复
  └── handleLevelComplete() — 庆祝弹窗 + 撒花

特效系统
  ├── spawnParticles() — 星星粒子
  └── spawnConfetti() — 撒花庆祝
```

---

## 浏览器 API 使用

| API | 用途 | iPad Safari 兼容性 |
|-----|------|-------------------|
| Touch Events | 手势检测 | iOS 全版本支持 |
| SpeechSynthesis | 中文语音播报 | iOS 7+ |
| Web Audio API | 代码生成音效 | iOS 全版本支持 |
| CSS Flexbox | 布局 | iOS 全版本支持 |
| CSS Custom Properties | 主题变量 | iOS 9.3+ |
| CSS Animations | 动画特效 | iOS 全版本支持 |
| AbortController | 监听器生命周期管理 | iOS 12.2+ |

---

## 手势检测算法

### 拖拽流程

```
touchstart on draggable-item → 记录偏移量
    ↓
touchmove → 跟随手指移动（限制在交互区域内）
    ↓
touchend → 计算与 drag-target 的重叠面积比
    ↓
ratio > 35% → handleStepSuccess()
ratio ≤ 35% → snap-back 回原位 + handleStepWrong()
```

### 点击/滑动流程

```
touchstart → 记录起始坐标
    ↓
touchmove → 收集轨迹点
    ↓
touchend → 计算位移距离
    ↓
< 18px → tap
≥ 18px → 根据方向判定 swipe-up/down/left/right
    ↓
checkMatch() 宽容匹配
```

### 宽容匹配规则

- `tap` → 仅 tap 通过
- `swipe-up` → 任意垂直滑动均通过
- `swipe-down` → 任意垂直滑动均通过
- `swipe-left` → 任意水平滑动均通过
- `swipe-right` → 任意水平滑动均通过
- `drag` → 重叠 > 35% 通过

---

## 部署方案

### 当前方案：GitHub Pages（已上线）

- 仓库：[github.com/labaicai-2004/life-skills-game](https://github.com/labaicai-2004/life-skills-game)
- 线上地址：[labaicai-2004.github.io/life-skills-game/](https://labaicai-2004.github.io/life-skills-game/)
- 部署方式：`git push` 到 `main` 分支自动部署
- 优点：永久可访问、免费、可添加到 iPad 主屏幕

### 本地预览

```bash
cd 项目目录
python3 -m http.server 8080
# iPad 同 WiFi 下访问 http://<Mac-IP>:8080/index.html
```

---

*文档版本：v1.1 | 更新日期：2026-05-19*
