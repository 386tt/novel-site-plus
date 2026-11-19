# 📚 书间 — 零成本私人小说站

[![License](https://img.shields.io/github/license/386tt/novel-site?style=flat-square)](LICENSE)
[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Pages-orange?style=flat-square)](https://pages.cloudflare.com)
[![Zero Framework](https://img.shields.io/badge/framework-none-brightgreen?style=flat-square)]()

> Cloudflare Pages + D1 + R2 + Functions 全栈方案，零框架、零构建、零服务器成本

一个完全运行在 Cloudflare 免费套餐上的私人小说站。纯原生 HTML/CSS/JS，没有 React/Vue，没有打包步骤——改一行代码，部署即生效。

---

## ✨ 这个版本做了什么

在原始项目基础上，围绕**阅读体验**、**主题一致性**、**后台可用性**和**代码质量**做了系统性改造。以下是实际改动，不是规划。

### 🎯 阅读体验重做

**批注交互推倒重来**

原始实现依赖浏览器原生文字选区，在 Edge 和 iOS 上被系统菜单彻底破坏——框选文字就弹出复制工具条或长按 callout 菜单，自定义批注按钮被遮挡甚至不出现。

调研后确认一个事实：只要还用原生选区，系统菜单就无法用 CSS 根除。而批注本来就是**按整句存储**的（框选半句也会被归并到整句），因此改成了「点按句子」模式：

- 禁用原生选区，改为自绘高亮
- 点一下任意句子 → 整句高亮 + 左侧砖红竖线
- 批注按钮**紧贴句子下方**浮出（触屏设备自动避让系统菜单位置）
- 再点同一句取消，点空白处清除
- 滚动/缩放时按钮跟随句子，始终夹在视口内

结果：Edge、iOS、安卓行为完全一致，零系统菜单干扰。代价是正文无法复制文字——这是消除系统菜单的必要取舍，已在站内 `/guide.html` 向读者说明。

**新增批注使用说明页**

`guide.html` 用编辑排版风格写了 5 节说明：三步完成批注、常用操作、可见性选择、为什么不能框选、常见问题。首页和阅读页导航栏都有入口。

### 🏷️ 书目分类系统

复用已有的 tags 系统（`tags` + `book_tags`），补齐了从数据到界面的完整链路：

- **首页左侧分类侧栏**：书目分类列表，带书籍数量，空状态也有正确提示
- **独立分类页** `category.html?id=N`：展示分类名、书籍数、书籍网格
- **书籍卡片和详情页的标签可点击**，直接跳转到对应分类页
- **后台分类管理面板**：创建/删除分类、查看各分类书籍数
- **后台书籍分类筛选**

### 🎨 视觉风格统一

原始样式混用了大量「AI 仪表盘风」元素——彩色渐变胶囊、圆点、悬浮阴影、位移动效，与站点本身的印刷式编辑风格（2px 圆角、发丝线边框、砖红强调色）冲突。

重做后的规范：

- 分类标签改为**期刊栏目式**：纯文字、小号大写字距、底部细线，无底色无圆点
- 分类侧栏改为**目录列表**：无底色、行间发丝线、右侧对齐数量、选中态用左侧竖线
- 分类页头部改为**报刊版式**：大标题 + 大写计数 + 底部粗分隔线
- 「书目分类」图标改为暖色书签轮廓，与主题配色一致

### 🌗 全站主题统一

原始实现每个页面各写一份主题代码，导致 `auth.html`、`profile.html`、`annotation-admin.html` **完全没有主题支持**，`404.html` 有主题但没切换按钮。

新增 `theme.js` 作为全站唯一主题来源：

- 5 套主题（默认 / 夜间 / 护眼 / 羊皮纸 / 淡蓝），共用 `localStorage['theme']`
- 在 `<head>` 同步执行，**避免首屏白闪**
- 切换时派发 `themechange` 事件，阅读器设置面板与导航栏按钮双向同步
- 现在**全部 10 个页面**都有主题脚本和切换按钮

### 💬 书籍评论区

每本书详情页底部新增评论区：

- 登录后可发表（500 字上限、Ctrl+Enter 快捷提交、实时字数）
- 未登录显示「登录后即可参与评论」提示，不渲染输入框
- 头像、用户名、角色徽章、相对时间（刚刚 / N 分钟前）
- 每页 20 条，支持加载更多
- 本人和管理员可删除，采用软删除保留审计记录
- 服务端校验：空内容、超长、封禁/禁言、书籍不存在或已下架、跨书回复

### 🛠️ 后台可用性改进

| 改进 | 说明 |
|---|---|
| **侧边栏导航** | 后台从「一路下滑」改为固定侧边导航 + 分面板，7 个功能一键直达 |
| **备份进度可视化** | 导出/恢复改为**逐章**推进，显示「第 103/165 章」和百分比，进度条带流动高光 |
| **读写可取消** | 导出和恢复都有「取消」按钮，请求间隙检查中止标志，立即中断 |
| **移除 GitHub Demo 注册** | 清理设置面板、配置函数、隐藏登录按钮和后端调用入口 |
| **邮箱状态只读** | 用户管理的邮箱验证状态改为只读徽章，`updateReader` 不再提交该字段 |
| **移动端顶栏修复** | 登录后导航栏从 117px 撑高回落到单行 73px，用户名超长自动省略 |

### 🐛 关键缺陷修复

| 问题 | 根因 | 修复 |
|---|---|---|
| 标签渲染成圆形 | 无障碍触摸目标规则给 `.tag-pill` 加了 `min-height/min-width: 44px` | 从该规则中移除，单独设 `0` |
| 改样式线上不生效 | CSS 版本号从未变过 + SW 缓存优先 | 版本号统一 + SW 对 CSS/JS 改网络优先 |
| 删评论后仍显示 | 重载被 `loading` 守卫静默跳过 + API 无 `Cache-Control` | 立即移除 DOM + `force` 重载 + 全响应 `no-store` |
| 后台加载即报错 | 移除 UI 后残留 JS 仍在引用已删元素 | 同步清理函数与调用点 |

---

## 🧩 其他两个方向的改动

### EPUB 导入优化

对导入链路做了一轮审计修复和体验改进：

**健壮性**
- URL 编码路径：中文文件名依次尝试 raw / decoded / encoded 三种形式
- Zip bomb 防护：改用 `byteLength` 而非字符数判断，限制 50MB
- XHTML 解析：改用 `text/html` 解析器（对纯文本提取更宽容）
- DRM 检测：解析前先检查 `META-INF/encryption.xml`
- 元数据读取：优先 `getElementsByTagNameNS`（命名空间安全）
- 路径穿越防护：规范化路径时移除 `../`
- 换行保留：连续 `<br>` 产生空行而非被折叠
- 简介提取保留段落换行，不再压成一行

**可靠性**
- 章节上传失败重试 3 次（针对 5xx 和网络错误）
- 并发 worker 内加 `try/catch`，未处理的 rejection 不再导致崩溃
- 大章节自动拆分要求至少 3 个子章节，避免误判
- 全部失败自动删除空书，不留脏数据

**实用性**
- 新增**补充导入模式**：先选目标书籍、再选 EPUB 文件
- 目标书籍下拉框显示已有章节数
- 按标题自动识别「已存在」章节（忽略大小写与空白差异），默认跳过，可手动勾选强制追加
- 选书前移到文件选择之前，符合「选书补导入」的操作顺序

### 代码审查与问题治理

对整个项目做了一次系统性审查，覆盖前端交互、后端 API、数据库设计、样式四个模块，共发现 **90 个问题**（14 严重 / 40 中等 / 36 轻微）。

其中影响较大的几类：

- **SQL 注入面**：动态 ORDER BY / SET / WHERE 子句改为参数绑定，值走 `?` 占位符
- **外键约束**：补充 `ON DELETE CASCADE`，删除书籍不再因关联章节失败
- **GitHub ID 唯一性**：补唯一索引，防止多账号绑定同一 GitHub
- **迁移脚本不可逆**：补充回滚脚本
- **移动端断点单一**：补齐 768px 平板断点
- **触摸目标不足**：统一 44px 最小触摸尺寸

---

## ✨ 功能特性

**阅读体验**
- 📱 响应式设计，手机 / 平板 / 电脑自适应
- 🎨 5 种主题，全站所有页面统一
- 📖 两种阅读模式：滚动模式 + 翻页模式（点击 / 滑动翻页）
- 🧘 沉浸模式：隐藏所有 UI，专注阅读
- ⚙️ 阅读设置面板：字体族 / 字号 / 行距 / 页面宽度可调
- 🔖 书签功能，书籍详情页集中查看
- 📊 阅读统计：自动记录时长、字数、天数
- ⌨️ 键盘快捷键：左右箭头翻页、T 切主题、F 全屏、S 设置
- 💾 阅读进度自动记忆，首页显示「继续阅读」
- 📶 PWA 离线阅读

**批注与评论**
- 💬 **点按句子发表批注**（公开 / 私有），无系统菜单干扰
- 📖 彩色下划线，透明度随批注数递增
- ❤️ 点赞、最新 / 最热排序、长文折叠
- 📕 **书籍评论区**：登录后发表，支持删除与分页
- 🔒 禁言 / 封禁用户自动限制操作
- ⚡ 速率限制：每用户每分钟 10 条，同一句子最多 3 条

**管理功能**
- 📥 TXT 智能导入（自动识别章节、预览编辑、粘连检测与拆分）
- 📦 EPUB 导入（目录解析、批量导入、选择性导入、补充导入去重）
- 📤 TXT 导出（单章 / 整本）
- 🔍 书名 / 作者搜索 + 书内章节搜索（IP 级速率限制）
- ✅ 批量操作：章节多选、批量删除
- 📈 数据统计面板：站点 PV/UV、书籍阅读量、章节热度
- 💾 **数据备份与恢复**：逐章进度、百分比、可随时取消
- 🔤 自定义字体：上传 woff2，阅读页可选用
- 🏷️ **书目分类**：侧栏筛选、独立分类页、后台管理
- 🖼️ 封面管理（JPEG/PNG/WebP，文件头魔数验证）

**权限系统**
- 👑 超级管理员（super_admin）：全部权限
- 👤 管理员（admin）：管理所有书籍 / 章节 / 分类
- 🎭 演示管理员（demo）：只能管理自己创建的内容，有配额限制
- 🚪 Demo 自助注销：注销后内容自动转交超管保管

**举报与治理**
- 🚩 所有人可举报（含游客），Bigram Jaccard 相似度去重
- ⚖️ 社区投票：达阈值后管理员 / 社区投票决定移除或保留
- 📊 积分系统：处理举报 +0.2、未处理 -1.0、投票贡献 +0.1
- 🔇 禁言递进：警告 → 1 天 → 3 天 → 7 天 → 30 天 → 永久封禁
- 🛡️ 角色保护：非超管不可处理超管批注

**安全与架构**
- 🔐 PBKDF2 密码哈希（100K 迭代 + 随机盐）+ 旧格式自动迁移
- 🍪 HttpOnly Cookie 认证（Secure + SameSite=Lax）+ Bearer fallback
- 🎫 Session Token 哈希存储 + 7 天过期 + 单用户最多 10 个会话
- 🛡️ CSRF 防护：管理 API 强制 Content-Type 检查
- 🔒 IP + 用户名双维度登录限流
- 🔄 乐观锁：章节编辑并发冲突检测
- 🛡️ CSP / HSTS / X-Frame-Options 等安全头
- ⚙️ 站点个性化（站名、简介、页脚）

---

## 🏗️ 技术架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────┐
│   浏览器     │────▶│  Cloudflare Pages │────▶│   D1    │
│  (前端页面)  │     │  (Functions API)  │     │ (元数据) │
└─────────────┘     └──────────────────┘     └─────────┘
                            │
                            ▼
                      ┌─────────┐
                      │   R2    │
                      │(章节内容)│
                      └─────────┘
```

- **Pages** — 托管前端静态文件，自带全球 CDN
- **Functions** — 后端 API，文件路径即 URL 路由
- **D1** — SQLite 数据库，存书籍/章节元数据、用户、会话、统计
- **R2** — 对象存储，存章节正文、封面图、自定义字体

> D1 是图书馆的目录卡片，R2 是书架上的实体书。查书先翻目录（D1），再去书架取书（R2），各司其职。

---

## 🚀 快速部署

### 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
- 已安装 Wrangler：`npm i -g wrangler`（或直接用 `npx`）

### 部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/386tt/novel-site.git
cd novel-site

# 2. 登录 Cloudflare
npx wrangler login

# 3. 创建 D1 数据库
npx wrangler d1 create novel-db
# 记下输出的 database_id，填入 wrangler.toml

# 4. 初始化数据库
npx wrangler d1 execute novel-db --remote --file schema.sql

# 5. 创建 R2 存储桶
npx wrangler r2 bucket create novel-storage

# 6. 修改 wrangler.toml
# 把 database_id 从 "<YOUR_D1_DATABASE_ID>" 改成你的真实 ID，例如：
#   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 7. 部署
npx wrangler pages deploy . --project-name novel-site
```

首次访问 `/admin.html`，默认管理员账号 `admin`，密码由 `ADMIN_PASSWORD` 环境变量或首次登录流程设定。

### 环境变量

在 Cloudflare Pages 项目设置中添加：

| 变量 | 用途 |
|---|---|
| `ADMIN_PASSWORD` | 初始超管密码 |
| `RESEND_API_KEY` | 邮箱验证（可选） |
| `MAIL_FROM` | 发件人地址（可选） |

---

## 📖 项目结构

```
novel-site/
├── index.html              # 首页（分类侧栏 + 书籍网格 + 继续阅读）
├── book.html               # 书籍详情（章节列表 + 书签 + 评论区）
├── read.html               # 阅读页（滚动/翻页 + 沉浸 + 点按批注）
├── category.html           # 分类独立页 ?id=N
├── guide.html              # 批注使用说明
├── auth.html               # 登录 / 注册 / 找回密码
├── profile.html            # 个人主页
├── admin.html              # 管理后台（侧边栏 + 分面板）
├── annotation-admin.html   # 批注管理（列表 + 举报 + 统计）
├── 404.html                # 404 页
├── style.css               # 全局样式（5 主题 + 响应式）
├── theme.js                # 全站统一主题管理（单例）
├── sw.js                   # Service Worker（PWA 离线缓存）
├── manifest.json           # PWA 清单
├── schema.sql              # 数据库建表语句
├── wrangler.toml           # Cloudflare 配置（资源 ID 需替换为你的）
├── migrations/             # 增量迁移脚本
└── functions/              # 后端 API
    ├── _middleware.js      # 公共中间件（安全头、CORS、CSRF、限流）
    └── api/
        ├── _utils.js       # 工具函数（认证、密码哈希、权限、schema 自愈）
        ├── auth.js         # 认证（登录 / 改密码）
        ├── me.js           # 当前用户信息
        ├── books.js        # 书籍列表（公开）
        ├── search.js       # 搜索（IP 速率限制）
        ├── settings.js     # 站点设置（公开，白名单过滤）
        ├── comments.js     # 书籍评论（GET / POST / DELETE）
        ├── fonts.js        # 自定义字体列表
        ├── tags.js         # 分类列表
        ├── annotations.js  # 批注（列表 + 创建）
        ├── reports.js      # 举报提交
        ├── auth/
        │   ├── github/
        │   │   └── callback.js
        │   └── logout.js
        ├── books/
        │   ├── [id].js     # 书籍详情 + 章节列表 + 标签
        │   └── [id]/
        │       └── like.js # 点赞
        ├── chapters/
        │   └── [id].js     # 章节内容（D1 元数据 + R2 正文）
        ├── covers/
        │   └── [id].js     # 封面图 serve
        ├── fonts/
        │   └── [name].js   # 字体文件 serve
        ├── annotations/
        │   ├── summary.js  # 章节批注聚合（渲染下划线）
        │   ├── [id].js     # 删除自己的批注
        │   └── [id]/
        │       └── like.js
        └── admin/          # 管理 API（需登录）
            ├── account.js  # Demo 自助注销
            ├── books.js    # 创建书籍（含配额检查）
            ├── settings.js # 站点设置
            ├── fonts.js    # 字体上传 / 删除
            ├── tags.js     # 分类管理
            ├── covers.js   # 封面上传
            ├── stats.js    # 访问统计
            ├── users.js    # 用户管理
            ├── book-tags.js
            ├── books/
            │   └── [id].js
            ├── chapters.js
            ├── chapters/
            │   ├── [id].js
            │   ├── swap.js
            │   ├── reindex.js
            │   └── split.js
            ├── annotations.js
            ├── annotations/
            │   ├── [id].js
            │   ├── batch.js
            │   └── stats.js
            ├── reports.js
            ├── reports/
            │   └── [id].js
            └── votes.js
```

> `functions/` 是 Pages Functions 的约定——文件路径即 URL 路由。`functions/api/books.js` → `/api/books`，`functions/api/books/[id].js` → `/api/books/123`。以 `_` 开头的文件不会成为路由。

---

## 🗄️ 数据库设计

核心表：

| 表 | 用途 |
|---|---|
| `books` | 书籍元数据（标题、作者、封面 key、所有者） |
| `chapters` | 章节元数据（标题、排序、字数、R2 路径、version 乐观锁） |
| `admin_users` | 账号（PBKDF2 哈希、角色、GitHub 信息、邮箱验证状态） |
| `admin_sessions` | 登录会话（token SHA-256 哈希，7 天过期） |
| `tags` / `book_tags` | 分类系统 |
| `book_comments` | 书籍评论（书籍 + 用户 + 内容 + 软删除状态） |
| `site_settings` | 站点配置 |
| `auth_attempts` | 登录限流（IP 哈希 + 失败计数） |
| `annotations` | 批注（章节定位 + 内容 + 可见性 + 状态） |
| `annotation_likes` | 批注点赞 |
| `reports` / `votes` / `score_logs` / `mutes` | 举报治理体系 |
| `site_visits` / `daily_visitors` | PV / UV 统计 |
| `book_stats` / `chapter_stats` | 阅读量统计 |

**关键设计决策**

- **D1 + R2 分工**：章节正文存 R2，元数据存 D1，`content_key` 指向 R2 路径
- **密码不存明文**：PBKDF2（100K 迭代 + 16 字节随机盐），旧格式登录时自动迁移
- **Token 哈希存储**：数据库只存 SHA-256，明文只在登录响应出现一次
- **IP 哈希存储**：不存原始 IP
- **先 DB 后 R2**：先插 D1 拿 ID → 上传 R2 → 回写 `content_key`，任一步失败回滚
- **乐观锁**：章节编辑携带 version，并发冲突返回 409
- **schema 自愈**：`ensureSchema` / `ensureAnnotationSchema` / `ensureCommentSchema` 在首次调用时补齐缺失表和索引，新部署无需手动迁移
- **软删除**：评论和批注用 `status` 字段标记，保留审计痕迹

---

## 🛡️ 安全设计

**中间件（`_middleware.js`）**

| 防护 | 说明 |
|---|---|
| CSRF | 管理 API 写操作强制 `Content-Type: application/json` 或 `multipart/form-data` |
| CORS | 公开 API 允许跨域，管理 API 不返回 CORS 头 |
| 请求大小 | 超 10MB 直接拒绝（413） |
| 安全头 | CSP、HSTS、X-Frame-Options、nosniff、Referrer-Policy、Permissions-Policy |
| 统计清理 | `book_stats` 90 天、`daily_visitors` 7 天自动清理 |

**认证与权限**

- 登录限流：IP + 用户名双维度，5 次失败锁 10 分钟
- 会话：token 哈希入库，7 天过期，单用户最多 10 个会话
- 所有权检查：demo 用户只能操作自己创建的资源
- 角色保护：非超管不可处理超管批注

**输入验证**

- 所有 ID 走 `/^\d{1,18}$/` 校验
- 上传文件校验 MIME 白名单 + 文件头魔数
- SQL 全部使用参数绑定，值走 `?` 占位符
- 搜索关键词转义 LIKE 通配符

---

## 📊 Cloudflare 免费额度

| 服务 | 免费额度 | 本项目用量估算 |
|---|---|---|
| Pages | 无限请求、500 次构建/月 | 静态托管，远低于上限 |
| Functions | 10 万次请求/天 | 个人使用足够 |
| D1 | 500 万行读/天、10 万行写/天、5GB 存储 | 千章量级绰绰有余 |
| R2 | 10GB 存储、1000 万次读/月 | 章节正文为文本，占用极小 |

个人或小团队使用完全够用，不需要付费。

---

## 🛠️ 本地开发

```bash
npx wrangler pages dev . --d1 DB=novel-db --r2 novel-storage
```

本地模拟完整的 Pages + Functions + D1 + R2 环境，数据与云端隔离。

### 数据库迁移

从早期版本升级时，按顺序执行：

```bash
npx wrangler d1 execute novel-db --file migrations/001_stats_and_roles.sql --remote
npx wrangler d1 execute novel-db --file migrations/002_github_oauth.sql --remote
npx wrangler d1 execute novel-db --file migrations/003_chapter_version.sql --remote
npx wrangler d1 execute novel-db --file migrations/004_fix_constraints.sql --remote
```

新部署**不需要**手动执行迁移，`schema.sql` 已含完整表结构，后端 schema 自愈逻辑会自动补齐缺失字段。

### 常见坑

- **仓库里的 `wrangler.toml` 是占位符**：克隆后必须把 `database_id` 换成自己的，否则部署会失败。自己的真实配置可以放在 `wrangler.toml.local`（已在 `.gitignore` 中），避免误提交
- **改样式线上不生效**：`style.css?v=` 版本号和 `sw.js` 的 `CACHE_NAME` 必须一起递增
- **D1 写操作改的是本地库**：写操作必须加 `--remote`
- **表格不存在**：账号表叫 `admin_users`，不是 `users`
- **git push 失败**：若本机配了 `http://127.0.0.1:7897` 之类的本地代理而代理没开，用 `git -c http.proxy= -c https.proxy= push` 绕过

---

## 📝 使用说明

1. 访问 `/admin.html` 登录后台
2. 创建书籍（书名、作者、简介）
3. 添加章节（手动输入、TXT 导入或 EPUB 导入）
4. 首页查看书架，点击阅读

### TXT 导入

自动识别 `第一章`、`第1章`、`Chapter 1`、`序章`、`楔子`、`番外` 等标题。UTF-8 / GBK / UTF-16 编码自动检测。导入前可预览编辑。

- **导入方式**：创建新书 / 导入到已有书籍
- **批量勾选**：全选 / 全不选 / 反选
- **插入位置**：追加末尾，或插入到指定章节之后（后续自动顺延）
- **粘连检测**：正文里夹着下一章标题时标记「疑似粘连」，可一键拆开

### EPUB 导入

- **导入方式**：创建新书 / 补充到已有书籍（先选书，再选文件）
- **重复检测**：按标题识别「已存在」章节，默认跳过，可手动勾选强制追加
- **插入位置**：追加末尾或插入指定位置
- **粘连检测**：一个 xhtml 混多章时标记并提供一键拆开
- **选择性导入**：勾选需要的章节，可编辑标题
- **并发上传**：3 路并发 + 失败重试 3 次
- **防护**：zip bomb（50MB）、章节数上限 5000、DRM 检测、路径穿越防护
- 全部失败自动删除空书

### 章节拆分

每章都有「拆分」按钮：
- **按章节标题自动拆分**（复用 TXT 识别规则）
- **按分隔线拆分**（`----`、`====`、`***`）
- 可手动修改每段标题，原章保留第 1 段，其余插入其后并顺延序号

### 数据备份

后台「系统设置 → 数据备份与恢复」：

- **导出**：逐章推进并显示百分比，可随时取消
- **导入**：逐章恢复并显示进度，可随时取消（已导入的数据不会回滚）

### 批注

阅读页**点按句子**即可选中整句，句子下方浮出「✎ 批注」按钮，点击进入编辑。详见站内 `/guide.html`。

---

## 📄 License

[AGPL-3.0](LICENSE)

## 🤝 贡献

欢迎提 Issue 和 Pull Request。

如果这个项目对你有帮助，欢迎点个 Star ⭐
