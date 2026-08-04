# HugeScreen

组件化可拖拽数据可视化大屏幕 — 可配置的通用数据可视化平台。

## 项目概述

用户通过拖拽方式自由组合数据组件到画布上，组件可缩放、可配置数据源和样式。屏幕中央默认放置 3D 炫酷组件（数据城市），周围环绕 2D 数据组件（统计卡、图表、表格）。整体稳重高级暗色 UI，搭配克制的微动效，支持桌面/平板/手机全设备响应式适配。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 构建 | Vite 5 + TypeScript 5 | 快速开发，严格类型 |
| 框架 | React 18 + React Router 6 | SPA 路由 |
| 状态 | Zustand | 轻量、不可变、支持时间旅行调试 |
| 2D 图表 | ECharts 5 | 按需引入，减少包体积 |
| 3D 渲染 | Three.js + @react-three/fiber + @react-three/drei | React 声明式 3D |
| 样式 | Tailwind CSS 4 + CSS Modules | 原子化 + 组件隔离 |
| 拖拽 | @dnd-kit/core | 现代、可访问、多输入支持 |
| 动效 | Framer Motion + CSS Animations | 2D 过渡和微动效 |
| 桌面端 | Electron + electron-vite | 桌面应用打包 |
| 测试 | Vitest + Playwright | 单元 + E2E |
| 服务端 | Express 4 | 静态文件 + REST API 一体化 |
| 包管理 | pnpm | monorepo workspace |

## 项目结构

```
HugeScreen/
├── packages/
│   ├── core/src/                  # 核心引擎
│   │   ├── registry/              #   组件注册系统 (plugin pattern)
│   │   ├── layout/                #   网格布局引擎 + 响应式断点
│   │   ├── event-bus/             #   组件间事件总线
│   │   └── types/                 #   核心类型定义
│   ├── widgets/src/               # 可视化组件库
│   │   ├── stat-card/             #   数字统计卡 (趋势箭头/迷你图)
│   │   ├── charts/                #   LineChart, BarChart, PieChart, Radar, Gauge
│   │   ├── table/                 #   DataTable (虚拟滚动), RankList
│   │   ├── three-d/               #   3D 组件 (DataCity, Globe, ParticleField)
│   │   └── decorators/            #   装饰组件 (BorderFrame, Title, DateTime)
│   ├── editor/src/                # 编辑器
│   │   ├── canvas/                #   画布 (网格覆盖层 + 放置区)
│   │   ├── palette/               #   组件库面板 (左侧)
│   │   ├── inspector/             #   属性配置面板 (右侧, 动态表单)
│   │   ├── toolbar/               #   顶部工具栏
│   │   └── context-menu/          #   右键菜单
│   ├── renderer/src/              # 大屏展示渲染器
│   │   ├── screen/                #   屏幕容器 (全屏展示态)
│   │   ├── animation/             #   动效编排引擎
│   │   └── theme/                 #   主题系统
│   └── data/src/                  # 数据层
│       ├── adapters/              #   REST / WebSocket / Static 适配器
│       ├── cache/                 #   数据缓存 (TTL + LRU)
│       └── transform/             #   数据转换管道
├── apps/
│   ├── web/                       # Web 版入口 (Vite SPA)
│   │   ├── server.mjs             #   一体化生产服务器 (Express)
│   │   └── views.json             #   已发布大屏配置持久化文件
│   └── desktop/                   # Electron 封装
├── shared/                        # 共享类型、常量、工具函数
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## 核心数据模型



```typescript

// 大屏完整配置
interface ScreenConfig {
  id: string;
  name: string;
  version: '1.0';
  canvas: { width: number; height: number; scaleMode: 'auto' | 'width' | 'height' | 'none'; backgroundColor: string };
  grid: { cols: number; rows: number; gap: number; snapToGrid: boolean };
  responsive: {
    desktop: LayoutBreakpoint;   // ≥1440px
    tablet: LayoutBreakpoint;    // 768-1439px
    mobile: LayoutBreakpoint;    // <768px
  };
  widgets: WidgetConfig[];
  theme: ThemeConfig;
}

// 断点布局
interface LayoutBreakpoint {
  grid: { cols: number; rows: number; gap: number };
  widgetLayouts: Record<string, WidgetLayout>;
  hiddenWidgets: string[];
}

// 组件配置
interface WidgetConfig {
  id: string;
  type: string;
  displayName: string;
  category: 'stat' | 'chart' | 'table' | '3d' | 'media' | 'decorator';
  layout: WidgetLayout;
  dataSource: DataSourceConfig;
  options: Record<string, any>;
  animation: WidgetAnimation;
  style: WidgetStyle;
}

// 数据源
interface DataSourceConfig {
  type: 'rest' | 'websocket' | 'static';
  config: {
    url?: string; method?: 'GET' | 'POST';
    interval?: number; throttle?: number;
    headers?: Record<string, string>;
    jsonPath?: string;
  };
  staticData?: any;
  mapping: Record<string, string>;
  transform?: TransformStep[];
}
```

## 架构

```
数据源层 (REST / WebSocket / Static)
       │
数据管道 (Adapter → Cache → Transform)
       │
 ┌─────┼─────────────────┐
 │     │                 │
2D组件  3D中心组件      装饰组件
ECharts Three.js       CSS/Canvas
 │     │                 │
 └─────┼─────────────────┘
       │
组件注册系统 (Registry)
       │
编辑器 / 渲染器 (画布 + 属性面板 + 预览)
```

### 数据流

- 每个 Widget 实例化时通过 EventBus 订阅自己的数据 channel
- WebSocket 适配器收到消息 → DataCache → 通知订阅者
- 更新节流 100ms，断线指数退避重连 (1s→2s→4s→...→max 30s)
- ECharts `setOption(newOption, { notMerge: false })` 增量更新
- Three.js 在 rAF 中插值过渡建筑高度

### 3D 降级策略

- Desktop (≥1440px): 完整渲染
- Laptop (1024-1439px): 缩小，粒子减半
- Tablet (768-1023px): 简化静态渲染
- Mobile (<768px): 不渲染，跳过 Three.js 代码块

## 默认布局

**桌面端 (1+2 三列)**

```
┌──────────┬──────────────────┬──────────┐
│ StatCard │  ★ 3D 数据城市 ★ │ StatCard │
│ PieChart │  (Three.js)      │ BarChart │
│ RankList │                  │ DataTable│
└──────────┴──────────────────┴──────────┘
  2 cols         6 cols          2 cols
```

**手机端 (单列滚动，3D 隐藏)**

```
┌─────────────┐
│ StatCard    │
│ StatCard    │
│ LineChart   │
│ RankList    │
└─────────────┘
```

## 设计系统

### 配色 (Mecha Gray × Electric Blue)

**设计理念**：机甲灰打底 → 沉稳、冷静、不沉重；电光蓝点睛 → 锋利、科技、醒目。摒弃传统深蓝面板的保守感，追求极致炫酷的现代科技美学。

```
画布底色:   #2C2C34    机甲灰 — 全画面最深色，组件透明背景透出此色
面板悬浮:   #363640    微亮区分 hover 层级
电光蓝:     #00D4FF    组件边框 / 3D 线框 / 关键数据 / 选中高亮
电光蓝弱:   rgba(0,212,255,0.12)  微提示 / 网格线 / 非激活边框
电光蓝发光: rgba(0,212,255,0.30)  外发光 / 粒子光晕
琥珀橙:     #FF8C42    辅助强调 / 警示标记 / 数据对比
涨/跌:      #34d399 / #f87171
边框:       rgba(255,255,255,0.06)
数据白:     #FFFFFF    核心 KPI 数字
文字主:     #E8E8EC    主文字
文字次:     #9E9EA8    辅助标签 / 单位 / 日期
```

**3D 视觉方向**：线框镂空效果 — 电光蓝 `LineBasicMaterial` 勾勒几何体边缘，半透明机甲灰几何体承载，配合粒子流线，营造全息投影 / 赛博朋克感。

### 动效分级

| 级别 | 类型 | 默认 |
|------|------|------|
| L0 | 静态 | — |
| L1 | 微动效 (数字滚动/hover) | 全开 |
| L2 | 环境动效 (粒子/呼吸) | 桌面开 |
| L3 | 数据动效 (流线/图表过渡) | 可配 |

### 字体

- UI: Inter / PingFang SC
- 数据: JetBrains Mono (等宽)

## 发布与部署架构

### 核心概念：发布 = 快照固化

编辑器生成的 ScreenConfig 通过 `POST /api/view` 保存到服务器后，生成唯一的 8 字符 ID。
**发布后的配置不可原地修改** — 需修改则重新发布，生成新 ID 和新 URL，旧 URL 保持不变。

```
编辑器（各用户独立）        服务器               展示端（只读）
───────────────────       ──────              ─────────────
用户 A 编辑 → 发布 ──→  SQLite ──→  /viewer?id=aaa (永不变)
用户 B 编辑 → 发布 ──→  SQLite ──→  /viewer?id=bbb (永不变)
用户 A 修改 → 重新发布 ──→  SQLite ──→  /viewer?id=ccc (新版本)
```

### 服务器部署架构

**⚠️ 关键：部署在服务器 `/home/ubuntu/hugescreen/` 根目录，不是本地 `apps/web/` 子目录。**

PM2 以 `/home/ubuntu/hugescreen/` 为工作目录运行 `server.mjs`，所有路径均相对于此目录。

```
服务器: 221.131.69.161:55906
SSH: ubuntu@221.131.69.161:60222
PM2 进程: hugescreen (fork mode, /home/ubuntu/hugescreen/server.mjs)
PM2 路径: /home/ubuntu/.npm-global/bin/pm2（非交互 SSH 需 export PATH）

⚠️ 本项目仅使用 55906 端口。禁止操作服务器上的其他端口、其他文件或 data-dashboard 等其他 PM2 进程。

/home/ubuntu/hugescreen/
├── server.mjs              # Express 一体化服务器（PM2 入口）
├── package.json            # 运行时依赖（从 package.server.json 复制）
├── hugescreen.db           # SQLite 数据库（本地文件，零网络依赖）
│
├── dist/                   # Vite 构建产物 — 静态文件
│   ├── index.html          #   编辑器 SPA 入口
│   ├── viewer.html         #   展示器 SPA 入口
│   └── assets/             #   JS/CSS 分块产物
│
├── db/                     # 数据库层
│   ├── connection.mjs      #   SQLite 单例（better-sqlite3, WAL 模式）
│   ├── init.mjs            #   CREATE TABLE IF NOT EXISTS
│   ├── migrate.mjs         #   views.json → SQLite 一次性迁移
│   └── cleanup.mjs         #   游客定时清理（5min TTL, 2min 扫描间隔）
│
├── middleware/
│   └── auth.mjs            #   JWT 认证中间件（requireAuth / optionalAuth）
│
├── routes/
│   ├── auth.mjs            #   注册 / 登录 / 游客 / 升级
│   └── templates.mjs       #   模板 CRUD
│
└── views.json.migrated     # 旧数据迁移后的备份（已废弃，不再使用）
```

### API 路由

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/auth/register | 无 | 注册，返回 JWT |
| POST | /api/auth/login | 无 | 登录，返回 JWT |
| POST | /api/auth/guest | 无 | 游客登录，返回 JWT |
| GET | /api/auth/me | requireAuth | 验证 token，返回用户信息 |
| POST | /api/auth/upgrade | requireAuth | 游客升级，迁移数据 |
| GET | /api/templates | requireAuth | 列出用户的模板（不含 config） |
| POST | /api/templates | requireAuth | 新建模板 |
| GET | /api/templates/:id | requireAuth | 获取模板（含 config） |
| PUT | /api/templates/:id | requireAuth | 更新模板 |
| DELETE | /api/templates/:id | requireAuth | 删除模板 |
| POST | /api/view | requireAuth | 发布配置（关联用户） |
| GET | /api/view/:id | 无 | 获取已发布配置（公开） |
| DELETE | /api/view/:id | requireAuth | 删除已发布配置 |
| GET | /api/views | optionalAuth | 列出已发布配置 |
| GET | /geodata/* | 无 | DataV API 代理（geo.datav.aliyun.com） |
| GET | /overpass/* | 无 | OpenStreetMap Overpass API 代理 |

### 部署流程

**方式一：一键部署（仅 dist 更新）**

```bash
# 1. 本地构建（仓库根目录，含 TypeScript 类型检查）
pnpm build

# 2. 打包上传（tar 管道）
cd apps/web/dist && tar czf - . | ssh -n -o StrictHostKeyChecking=no \
  ubuntu@221.131.69.161 -p 60222 \
  "cd /home/ubuntu/hugescreen/dist && rm -rf assets index.html viewer.html && tar xzf -"

# 3. 重启服务
ssh -n -o StrictHostKeyChecking=no ubuntu@221.131.69.161 -p 60222 \
  "export PATH=\$PATH:/home/ubuntu/.npm-global/bin && pm2 restart hugescreen"
```

> SSH 认证通过 `SSH_ASKPASS` 环境变量传递密码，详见下方「SSH 认证」章节。

**方式二：完整部署（含服务器代码变更）**

```bash
# 1. 本地构建（仓库根目录，含 TypeScript 类型检查）
pnpm build    # 产出 dist/

# 2. 上传所有文件到服务器（注意目标路径是 /home/ubuntu/hugescreen/，不是 apps/web/）
# 用 tar 管道分别上传 dist/ 和服务器代码
cd apps/web && tar czf - dist/ | ssh ubuntu@221.131.69.161 -p 60222 "cd /home/ubuntu/hugescreen && tar xzf -"
scp server.mjs ubuntu@221.131.69.161:/home/ubuntu/hugescreen/
scp -r db/ middleware/ routes/ ubuntu@221.131.69.161:/home/ubuntu/hugescreen/
scp package.server.json ubuntu@221.131.69.161:/home/ubuntu/hugescreen/

# 3. 服务器上
ssh ubuntu@221.131.69.161 -p 60222
cd /home/ubuntu/hugescreen
cp package.server.json package.json
npm install --omit=dev          # 仅运行时依赖
export PATH=$PATH:/home/ubuntu/.npm-global/bin
pm2 restart hugescreen          # 重启进程
```

### SSH 认证

服务器 SSH 使用密码认证，凭据如下：

- **用户**：`ubuntu`
- **密码**：`ZJlyj*()`

本地需设置 `SSH_ASKPASS` 环境变量指向密码提供脚本：

```bash
# 创建密码脚本（一次性）
cat > ~/.ssh/askpass.sh << 'EOF'
#!/bin/bash
echo 'ZJlyj*()'
EOF
chmod 700 ~/.ssh/askpass.sh

# 使用时设置环境变量
export SSH_ASKPASS=~/.ssh/askpass.sh
export DISPLAY=1
# SSH/SCP 命令需加 -n 标志（ssh）或直接使用（scp）
```

**⚠️ 常见错误：不要把文件传到 `/home/ubuntu/hugescreen/apps/web/`。**
PM2 进程工作目录是 `/home/ubuntu/hugescreen/`（根层级），所有 `__dirname` 引用均相对于根层级解析。传到 `apps/web/` 子目录的文件不会被服务器加载。

### server.mjs 设计

- 框架：Express 4，零额外中间件依赖
- 端口：55906（`PORT` 环境变量可覆盖）
- 静态文件：`express.static('dist')` + SPA fallback（`/login`、`/templates`、`/editor/*` 路由回退到 `index.html`）
- 存储：SQLite（`better-sqlite3`），本地文件 `hugescreen.db`，WAL 模式，外键约束
- 认证：JWT（`jsonwebtoken`），密码哈希（`bcryptjs`），24h 过期
- 游客清理：每 2 分钟扫描，5 分钟不活跃自动删除，同 IP 限流 5 次/小时
- 进程管理：PM2 fork mode，开机自启
- URL 格式：`/viewer?id=xxx`（clean URL）

### 本地开发 vs 服务器

| | 本地开发 | 服务器生产 |
|------|------|------|
| 服务器根目录 | `apps/web/` | `/home/ubuntu/hugescreen/` |
| 端口 | 3000 (Vite) + 3001 (API) | 55906 (单一 Express) |
| 启动命令 | `pnpm dev` | `npx pm2 restart hugescreen` |
| 数据库文件 | `apps/web/hugescreen.db` | `/home/ubuntu/hugescreen/hugescreen.db` |
| Node 版本 | — | 22.22.0 |

## 开发阶段

### 第一期：基础框架
pnpm monorepo → 核心类型 → 注册系统 → 布局引擎 → 拖拽 → StatCard/LineChart/PieChart

### 第二期：完整编辑器
三栏布局 → 属性面板(动态表单) → resize handles → 右键菜单 → 撤销重做 → 本地存读

### 第三期：3D + 主题
R3F 集成 → 数据城市(建筑群+粒子+流线) → Mecha Gray × Electric Blue 主题 → 装饰组件

### 第四期：数据 + 动效
REST/WS 适配器 → 数据配置 UI → 转换管道 → 数字滚动 → 图表过渡 → 动效级别控制

### 第五期：响应式 + 桌面端
断点系统 → 移动端简化 → Electron → 全屏模式 → 性能优化 → 轮播

### 第六期：发布与部署
Express 一体化服务器 → 静态文件服务 → 发布快照 API → 跨设备展示 → QR 码分享

## 开发命令

```bash
# 开发
pnpm dev              # 启动 Vite 开发服务器 (:3000) + API 服务器 (:3001)
pnpm dev:desktop      # 启动 Electron 开发

# 构建与部署
pnpm build            # 构建 Web 生产版本（tsc 类型检查 + vite build）
npx vite build        # 仅构建跳过 tsc (cd apps/web && npx vite build)，类型排查时用
pnpm serve            # 启动生产服务器 (Express, :3001)
pnpm build:desktop    # 打包 Electron 应用

# 测试
pnpm test             # 运行 Vitest 单元测试
pnpm test:e2e         # 运行 Playwright E2E 测试
pnpm lint             # ESLint + Prettier 检查
```

**注意：** 预存的 TypeScript 类型错误已全部修复（含 three.js 类型，@types/three@0.185.1），`pnpm build`（即 `tsc && vite build`）可正常构建，类型检查通过。
