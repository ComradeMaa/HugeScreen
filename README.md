# HugeScreen

组件化可拖拽数据可视化大屏幕 — 可配置的通用数据可视化平台。

用户通过拖拽方式自由组合数据组件到画布上，组件可缩放、可配置数据源和样式。支持桌面/平板/手机全设备响应式适配，内置企业级部署方案。

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue" />
  <img src="https://img.shields.io/badge/Three.js-0.185-blue" />
  <img src="https://img.shields.io/badge/ECharts-5-blue" />
  <img src="https://img.shields.io/badge/Vite-5-blue" />
</p>

## 特性

- **拖拽编辑** — 自由拖放组件到画布，缩放、吸附网格
- **3D 可视化** — 赛博地图（行政区划 3D 挤出 + 地图钉）、赛博数据城市（OSM 建筑 3D 线框）
- **2D 图表** — 统计卡、折线图、柱状图、饼图、柱线组合图、表格
- **装饰组件** — 边框、标题、日期时间、图片、文本
- **实时数据** — REST / WebSocket / Static 多数据源，节流轮询，自动映射
- **响应式布局** — 桌面 8 列 / 平板 2 列 / 手机 1 列，自动重排
- **暗色主题** — 机甲灰 × 电光蓝，赛博朋克美学
- **一体化部署** — Express 服务器，静态文件 + API，发布即快照，跨设备展示
- **QR 码分享** — 发布后自动生成二维码，手机扫码直接看

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev              # 启动 Vite (:3000) + API (:3001)

# 生产构建 + 启动
pnpm build
pnpm serve            # 启动一体化服务器 (:3001)
```

浏览器打开 `http://localhost:3000`，按 `Ctrl+E` 进入编辑模式。

## 项目结构

```
HugeScreen/
├── packages/
│   ├── core/           # 核心引擎 (注册系统、布局引擎、事件总线)
│   ├── widgets/        # 可视化组件库 (2D图表、3D组件、装饰)
│   ├── data/           # 数据层 (REST/WebSocket适配器、缓存、转换)
│   └── renderer/       # 展示渲染器 (屏幕容器、动效引擎、主题)
├── apps/
│   └── web/            # Web 入口 (Vite SPA + Express 服务器)
├── shared/             # 共享类型、常量、工具
└── CLAUDE.md           # AI 辅助开发指南
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建 | Vite 5 + TypeScript 5 |
| 框架 | React 18 + React Router 6 |
| 状态 | Zustand |
| 2D 图表 | ECharts 5 |
| 3D 渲染 | Three.js + @react-three/fiber + @react-three/drei |
| 样式 | Tailwind CSS + CSS Modules |
| 拖拽 | @dnd-kit/core |
| 动效 | Framer Motion + CSS Animations |
| 服务端 | Express 4 |
| 包管理 | pnpm (monorepo) |

## 部署

```bash
# 构建
pnpm build

# 上传到服务器
scp -r apps/web/dist apps/web/server.mjs apps/web/package.json user@server:/opt/hugescreen/

# 服务器上
cd /opt/hugescreen && npm install && node server.mjs
```

浏览器打开 `http://<服务器IP>:3001/` 编辑，发布后分享 URL 即可。

## 更新日志

### 2026-07-23

- **用户系统** — 注册/登录/游客模式，JWT 认证 + bcrypt 密码加密
- **模板管理** — 创建/编辑/发布/删除模板，卡片网格布局，搜索筛选
- **游客升级** — 游客可注册正式账号，数据自动迁移
- **游客清理** — 2 小时不活跃自动清理 + 同 IP 限流（5次/小时）
- **数据库迁移** — views.json → SQLite（hugescreen.db），本地文件零网络依赖
- **发布优化** — 漂亮的发布成功对话框，一键复制链接
- **配色系统** — 登录/管理页薰衣草灰主题（#1B2238 / #7181AC / #F1EFF2），编辑器保留机甲风电光蓝
- **服务器部署** — Express 一体化服务 + PM2 进程守护 + 开机自启

## 许可证

MIT License
