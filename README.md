# 体育与健康理论考试模拟系统 🏃‍♂️📝

这是一个专为初中升学“体育与健康”科目理论考试设计的多端模拟训练系统。本项目提供完整的备考解决方案，包含以下三大核心模块：

1. **WeChat Mini Program（微信小程序端）**：采用原生小程序框架开发，极速轻量，支持微信同声传译插件。
2. **React Web & Android App（Web 网页与 Android 原生 App 双端）**：基于 **React 19 + Vite 8** 构建，既可以直接作为 Web 网页端运行/部署，也可以通过 **Capacitor 8** 容器编译打包为安卓原生 App (APK)。具备出色的暗黑玻璃拟态（Glassmorphism）高水准视觉体验，支持硬件返回键拦截、双端 TTS 语音播报及自适应页面布局。
3. **Data Pipeline（数据解析与同步引擎）**：基于 **Node.js** 开发的脚本，支持从 Markdown 题库源文件中自动解析、校验并同步输出 JSON/CommonJS 格式的题库数据给多端使用。

---

## 🌟 核心功能地图

### 1. 📊 学习数据分析看板 (Dashboard)
* **多维度练习数据统计**：
  * **累计学习用时**：毫秒级累计计时，格式化展示为 `XX小时XX分XX秒`。
  * **平均学习正确率**：对用户所有历史学习记录的正确率进行加权平均。
  * **累计学习/模拟考试场次**：记录用户的练习活跃度。
  * **模拟考平均分**：对用户所有的模拟考试得分进行平均统计。
* **动态图表折线图**：
  * **微信小程序**：基于最新 **Canvas 2D** 原生接口开发，支持 `dpr` 物理像素缩放以确保 Retina 视网膜屏幕下的图表清晰无锯齿。
  * **React / Android 端**：采用轻量级响应式 SVG 动态折线图，支持平滑缩放与交互。
  * 支持 **“智能学习正确率”** 与 **“模拟考试得分”** 两种折线图表的双向标签页（Tabs）切换。
* **历史做题报告检索系统**：
  * 采用卡片式列表，用不同颜色的标签（Badge）区分“学习”和“考试”记录。
  * **实时模糊搜索**：支持搜索框输入关键字，对历史报告标题进行实时字符匹配过滤。
  * **历史记录清理**：支持侧滑或点击一键删除，系统自动重算所有看板统计数据。

### 2. 📖 智能学习模式 (Study Mode)
* **真题与预测考纲选择**：
  * **2025年真题库**：加载自互联网公开渠道整理的体育真实试题。
  * **2026年预测考纲**：加载针对最新“三类各选一”等考纲政策编写的预测题。
* **进度暂存与防覆盖提示**：
  * 启动练习时，系统自动检查本地缓存，若发现未完成的进度，会弹出模态对话框询问是 **“继续上次”** 还是 **“重新开始”**。
  * 为防止误触导致存档被覆盖，点击“重新开始”前会进行二次防覆盖警告确认。
* **学习界面与答题卡交互**：
  * **支持错题后退（上一题）**：用户可以点击“上一题”按钮随时倒退，重新查看错题解析或修改答案。
  * **实时进度指示器**：顶部显示当前题目序号、题型（判断/单选）以及当前场次的实时正确率。
* **多端保障语音播报系统 (TTS)**：
  * **微信小程序端**：
    * **微信同声传译 (WechatSI) 插件**（第一优先级）：利用微信原生语音合成服务，发音自然。
    * **本地下载流队列播放器**（第二优先级/Fallback）：如果插件未授权，自动降级为分段下载合成器。
    * **句法拆分算法 (`splitTextIntoSegments`)**：检测到文本长度大于 25 字符时，自动根据标点符号将大段解析拆分为小于 25 字符的小串。这彻底解决了有道/百度等接口对长句返回 500 或 504 的服务器拦截限制。
    * **磁盘自动清理**：在音频播放结束或出错时，异步清除临时缓存文件，防占用手机存储。
  * **React / Android 端**：
    * **原生 Android TTS**（第一优先级）：通过封装的原生 Android `TextToSpeech` 引擎，注册为自定义 Capacitor 插件 `NativeSpeech`，发音清晰且响应极快。
    * **Web Speech API (`speechSynthesis`)**（第二优先级/Fallback）：当在标准浏览器环境下运行时，降级调用浏览器的 TTS 语音引擎（优先匹配系统中文男声，如 Yunxi、Kangkang 等）。
* **纯前端 WebAudio 物理音效合成器**：
  * 摆脱本地 MP3 资源文件（减小安装包体积），通过 `WebAudioContext` 接口直接控制系统的声卡发生器。
  * **答对音效**：合成一个上扬的 C 大三和弦（523.25Hz -> 659.25Hz -> 783.99Hz）正弦波。
  * **答错音效**：合成一个下沉衰减的方波和三角波低音。
  * 音效触发完全独立于语音播报开关，给用户提供坚实的行为反馈。

### 3. 📝 模拟考试模式 (Exam Mode)
* **全仿真考试规则**：
  * 从选定的题库中随机抽取 25 道题目组成试卷（10道判断题 + 15道单选题，每题 4 分，满分 100 分），固定 30 分钟倒计时。
  * 页面顶部伴随红色的时间进度条，倒计时结束自动强制交卷。
* **答题卡网格跳题系统**：
  * 提供 `1-25` 数字答题卡网格。
  * **状态颜色指示**：灰色代表未答，深蓝色代表已答，亮色高亮代表当前正在答的题目。
  * 用户可以随时点击任意数字，界面将以 0ms 延迟瞬间跳转到对应试题，极大提升答卷效率。
* **交卷判分与错题复习**：
  * 交卷后展示得分（0-100 分），提供做题用时统计。
  * **错题复习界面**：支持用户点选任意题目进行卷面复习。系统会高亮显示用户的答案、正确答案以及对应的知识点解析，并为每道题的解析提供 **“播放语音”** 控制按钮。

---

## 🛠️ 项目目录结构

```text
physical-health-test-simulator/
├── Questions-2025.md        # 2025年体育真题 Markdown 源文件
├── Questions-predict-2026.md # 2026年预测考题 Markdown 源文件
├── parse.js                 # Node.js 题库解析与多端分发脚本
├── questions-2025.json      # 解析后生成的 2025 题库 JSON (根目录备份)
├── questions-2026.json      # 解析后生成的 2026 题库 JSON (根目录备份)
├── LICENSE                  # MIT 开源协议文件
├── README.md                # 本说明文件
├── CLAUDE.md                # 架构设计与开发指令规范文件
│
├── wechat-miniprogram/      # 微信小程序源码目录
│   ├── data/                # 真题与预测题本地数据库 (由 parse.js 自动生成)
│   │   ├── questions-2025.js  # 2025年体育真题 CommonJS 模块
│   │   └── questions-2026.js  # 2026年预测考题 CommonJS 模块
│   ├── pages/
│   │   └── index/           # 单页面控制器 (SPA)
│   │       ├── index.js     # 业务状态机、Canvas 绘图与 WebAudio 合成器逻辑
│   │       ├── index.json   # 页面配置与依赖声明
│   │       ├── index.wxml   # SPA 视图模板与返回拦截容器
│   │       └── index.wxss   # 玻璃拟态视觉、暗黑渐变样式表
│   ├── app.js               # 小程序入口文件
│   ├── app.json             # 小程序全局配置文件（注册 WechatSI 插件）
│   ├── app.wxss             # 全局暗黑背景样式
│   └── project.config.json  # 微信开发者工具配置文件
│
└── app/                     # React + Vite + Capacitor Web 网页与 Android App 源码目录
    ├── android/             # 原生 Android 工程目录 (Android Studio 项目)
    │   └── app/src/main/java/com/physicalhealth/testsim/
    │       ├── MainActivity.java      # Android 入口，处理物理返回键
    │       └── NativeSpeechPlugin.java # 自定义原生 Android TTS 播放插件
    ├── src/
    │   ├── data/            # 题库 JSON 数据目录 (由 parse.js 自动生成)
    │   │   ├── questions-2025.json
    │   │   └── questions-2026.json
    │   ├── assets/          # 静态资源
    │   ├── App.jsx          # React 19 应用核心状态机与 SPA 视图代码
    │   ├── App.css          # React 应用局部样式
    │   ├── index.css        # 全局设计系统样式（含玻璃拟态及暗黑主题 CSS Token）
    │   └── main.jsx         # React 19 渲染入口
    ├── capacitor.config.json # Capacitor 跨平台容器配置文件
    ├── vite.config.js       # Vite 8 构建配置（含 WebView 兼容性打包插件）
    ├── eslint.config.js     # ESLint 扁平化配置
    └── package.json         # 依赖与脚本定义
```

---

## 🚀 多端开发与调试指南

### 1. 数据源更新流水线 (Data Pipeline)
当你需要修改或添加题目时，无需手动编辑 JSON。请按照以下步骤操作：
1. 编辑根目录下的 [Questions-2025.md](file:///C:/Users/lir/Working/physical-health-test-simulator/Questions-2025.md) 或 [Questions-predict-2026.md](file:///C:/Users/lir/Working/physical-health-test-simulator/Questions-predict-2026.md)。
2. 在根目录执行解析脚本：
   ```bash
   node parse.js
   ```
3. 脚本会自动进行格式校验（如判断题答案是否为 T/F，选择题是否有 4 个选项，答案是否在 A-D 之间等），并在校验无误后**自动将数据同步写入**至以下路径：
   * 备份：根目录 `questions-2025.json` 和 `questions-2026.json`
   * React App 端：`app/src/data/`
   * 微信小程序端：`wechat-miniprogram/data/`

---

### 2. 微信小程序端调试
1. 下载并安装最新版 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 打开工具，选择 **小程序** -> **导入项目**。
3. 选择本项目的子目录 `wechat-miniprogram/`。
4. AppID 可以填写您自己的小程序 AppID，或者选择 **测试号**。
5. **同声传译插件授权**：
   本系统使用微信官方的语音合成插件 `WechatSI`（AppID: `wx069ba97219f66d99`）。在开发者工具首次编译或在手机端预览时，如果控制台提示“插件未授权”：
   * **快速授权**：直接点击开发者工具控制台报错信息中的 **“添加插件”** 链接。
   * **后台授权**：登录 [微信公众平台](https://mp.weixin.qq.com/) 后台，在 **设置 > 第三方设置 > 插件管理** 中搜索 `微信同声传译` 并点击添加。
   * 授权完成后，在开发者工具中**重新编译**项目即可。

---

### 3. React Web 与 Android 原生端调试

#### 准备工作
请确保本地已安装 Node.js（推荐 v18 及以上）、JDK 17、Android SDK 以及 Android Studio。

#### A. Web 网页端开发调试
在 `app/` 目录下启动带热更新的本地 Web 预览：
```bash
cd app
npm install
npm run dev
```
使用浏览器打开控制台输出的地址即可预览。

#### B. 打包并生成 Android 原生 APK
1. **构建 Web 产物**：
   ```bash
   npm run build
   ```
   *注意：Vite 配置中集成了自定义的兼容性插件，会将构建产物降级为经典的 ES2015 语法，打包为单文件 IIFE，并延迟加载 JS 脚本，以确保应用能在老旧安卓设备的 WebView 中顺畅运行。*

2. **同步产物到原生安卓工程**：
   ```bash
   npx cap sync android
   ```
   该指令会将 `app/dist/` 下的构建结果及外部插件同步到 Android 项目目录中。

3. **编译并导出 APK**（两种方式）：
   * **命令行编译**：
     ```bash
     cd android
     ./gradlew assembleDebug
     ```
     编译完成后，APK 将生成在：`app/android/app/build/outputs/apk/debug/app-debug.apk`。
   * **Android Studio 编译**：
     运行 `npx cap open android` 会自动使用 Android Studio 打开安卓工程。你可以在 IDE 中直接点击 `Run` 进行调试，或者通过菜单栏 `Build > Build Bundle(s) / APK(s) > Build APK(s)` 导出安装包。

---

## 🛠️ 多端系统底层优化机制

### 1. 返回手势与硬件返回键拦截

* **微信小程序端**：
  * 使用 `<page-container>` 拦截用户的物理返回手势。
  * **优化方案**：将其尺寸设为 `0x0` 隐藏，并设置 `position="center"`。这移除了默认 `right` 或 `bottom` 展现形式在重置时引发的系统级 Viewport Sliding 动画，消除了返回时的屏幕跳动闪烁。
  * **防死循环机制**：在 `onPageContainerLeave` 增加 JS 层状态校验，防止 setData 状态变化 programmatic 触发离开回调造成的死循环。
* **Android 原生端**：
  * **React Hash 路由同步**：React 页面将当前的 `view` 视图状态实时双向绑定到 `window.location.hash` 上，使用 `hashchange` 监听器控制页面回退。
  * **MainActivity 原生拦截**：在 `MainActivity.java` 中重写 `onBackPressed` 拦截系统硬件返回键，当 WebView 的 history 栈可回退时优先回退 WebView 历史记录，与 React Hash 路由机制实现无缝对接。

### 2. 纯前端零资源音频合成 (WebAudio)
* 微信小程序使用 `wx.createWebAudioContext()`，Web/Android 使用标准的 `AudioContext`。
* 动态构建 Oscillator 振荡器节点，实时合成答对/答错物理音效，无需网络加载或本地打包任何 MP3 文件，减少包体，响应零延迟。

---

## 📄 免责声明与联系方式

* **内容免责声明**：本系统所含的“2025年体育真题”及“2026年预测考题”等题库数据，均收集、整理自互联网公开渠道，版权归属原出处。本软件仅用作备考学习交流，请勿用于任何商业用途。
* **联系反馈**：如对题库内容有疑问、发现错题或有合作意向，欢迎通过项目下方的反馈通道与开发者直接沟通。
* **开源协议**：本项目基于 [MIT License](LICENSE) 许可协议开源。
