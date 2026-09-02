# Router Manager 🌐

[中文](#-中文介绍) | [English](#-english)

---

## 🇨🇳 中文介绍

**Router Manager** 是一款专为家庭多路由器（Mesh / AP 组网）打造的现代化轻量级局域网状态监控看板与 PWA 应用。通过客户端高频无侵入探针算法，实时监测主网关与各房间分路由器的网络连通性、往返延迟（RTT）与外网通断状态。

### ✨ 核心特性

- 📡 **家庭多路由拓扑实时监控**：支持监控 1 台主路由器及任意数量的 Mesh / AP 分路由节点，毫秒级测量往返延迟。
- 🔍 **内外网双链路故障诊断**：区分“局域网正常但外网断纤/断网”与“主网关宕机/Wi-Fi 断开”，动态给出针对性排障建议。
- 📶 **网络环境自适应与阻断保护**：
  - 基于 Network Information API 自动识别网络类型；
  - 检测到处于移动蜂窝数据（Cellular）时自动友好阻断，告知局域网私网 IP 无法通过公网流量访问并引导连接 Wi-Fi；
  - 内置环境模拟切换工具（Wi-Fi / 移动数据），便于跨设备调试。
- ⚙️ **首次配置向导与快捷预设**：提供 TP-Link、小米/红米、华硕、腾达、OpenWrt 等主流品牌网关 IP 快捷填入，支持单节点独立测速验证。
- 📱 **PWA 渐进式应用支持**：
  - 支持直接安装至 iOS / Android 手机主屏幕或 macOS / Windows 桌面独立窗口运行；
  - 内置 Service Worker 离线缓存，无外网时本地控制台依然秒开。
- 🎨 **极简现代视觉**：基于 Nuxt 4 + Vue 3 + UnoCSS 构建，原生深色/浅色模式自适应。

### 🛠️ 技术栈

- **框架**：[Nuxt 4](https://nuxt.com/) (Vue 3.5+, SPA 模式)
- **样式引擎**：[UnoCSS](https://unocss.dev/) (Preset Uno + Carbon Icons)
- **PWA**：[@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/)
- **构建工具**：Vite 8 + Nitro 2

### 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务 (带 --host 支持局域网手机/平板访问)
npm run dev

# 3. 生产打包
npm run build

# 4. 预览生产包
npm run preview
```

启动后在浏览器打开 `http://localhost:3000` 即可使用。

---

## 🇬🇧 English

**Router Manager** is a modern, lightweight home multi-router status monitoring dashboard and Progressive Web Application (PWA). Designed for Mesh and multi-AP setups, it uses client-side non-invasive RTT HTTP probes to monitor the connectivity, latency, and Internet status of your main gateway and sub-routers in real time.

### ✨ Key Features

- 📡 **Multi-Router Topology Monitoring**: Monitor your primary gateway and multiple Mesh/AP sub-nodes with real-time millisecond-level latency tracking.
- 🔍 **Dual-Link Fault Diagnostics**: Distinguishes between "LAN healthy but WAN/Internet down" vs. "Main router offline / Wi-Fi disconnected", providing actionable troubleshooting tips.
- 📶 **Network Environment Detection**:
  - Automatically detects connection type using the Network Information API.
  - Warns and blocks gracefully when on cellular data (since private LAN IPs like `192.168.x.x` are unreachable over mobile data) and guides you to connect to your home Wi-Fi.
  - Built-in simulation toggle (Wi-Fi / Cellular) for seamless developer testing.
- ⚙️ **Initial Setup Wizard**: Pre-configured with common router gateway IPs (TP-Link, Xiaomi, ASUS, Tenda, OpenWrt, etc.) and dynamic sub-router management with live reachability testing.
- 📱 **Progressive Web App (PWA) Ready**:
  - Installable as a standalone app on iOS, Android, macOS, and Windows.
  - Service Worker offline caching ensures the app loads instantly even with zero Internet access.
- 🎨 **Modern Aesthetics**: Built with Nuxt 4, Vue 3, and UnoCSS, featuring seamless Dark/Light theme support.

### 🛠️ Tech Stack

- **Framework**: [Nuxt 4](https://nuxt.com/) (Vue 3.5+, SPA client-side mode)
- **Styling**: [UnoCSS](https://unocss.dev/) (Preset Uno, Typography, Carbon Icons)
- **PWA**: [@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/)
- **Bundler**: Vite 8 + Nitro 2

### 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (with --host for local network access)
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

Open `http://localhost:3000` in your browser to start managing your routers!

---

### 📄 License

MIT © [Shenghong Yan](https://github.com)
