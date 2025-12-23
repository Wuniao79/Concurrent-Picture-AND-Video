# Concurrent-Picture-AND-Video
Concurrent-Picture-AND-Video 一个在线并发创作工作站
# Concurrent-Picture-AND-Video 在线并发创作工作站



**Concurrent-Picture-AND-Video 在线并发创作工作站** 是一个基于 Web 的轻量级、高性能 AI 绘图客户端。  

它专门面向如Sora2、banana pro 等需要大量并发的视频图文模型：

- ✅ 支持所有中转站（即Openai兼容接口）的视频、图片和文字模型  
- ✅ 可自定义模型名称，无任何限制
- ✅ 最高可同时并发20条模型
- ✅ 新增 **全局提示 / 加载 / 进度条 / 错误处理**，整体体验更顺滑

整个应用 **纯前端运行**，所有配置和历史记录都保存在本地浏览器中，无需后端服务。
> 🚀 你可以将本仓库部署到 GitHub Pages 或任意静态网页托管平台，即可在线使用。

<img width="2559" height="1342" alt="image" src="https://github.com/user-attachments/assets/f7611318-0efb-47f7-8da2-d798c94708c5" />

---

## 🤔懒得部署？

### 稳定站：https://kk.wuniao.xyz/

除非有重大更新，否则不会有随意变动——给那些懒得动手的创作者。

### 测试站：https://aa.wuniao.xyz/

字如其名，我最新功能的测试站点。（随时都可能会404，闲着没事可以来看看最新版本）

## ✨ 主要功能一览

### 1. 在线并发创作工作站（Sora2）

- **同时并发**
  - 可在右上角填写最高20次数的并发量
  - 超过3条以上的并发会自动折叠为小方块保持美观

- **可自定义并发模型**
  - 可自定义输入需要并发的模型
  - 经过测试，使用中转站的任何模型都可以并发。

- **自带图片、视频下载功能**
  - 在识别到可下载的视频或图片后会自动提供下载按钮，无需复杂的提取
  - 单击图片可进入灯箱预览（Lightbox），查看大图
  - 

- **Sora2视频的Remix复制按钮**
  - 当识别到Sora2的Remix后会自动弹出方便复制


## 🧩 架构与技术实现简述

- **前端技术栈**
  - React + TypeScript + Vite
  - TailwindCSS + Lucide Icons 负责现代化 UI
  - 使用 Flex 布局与响应式 Grid 构建 ChatGPT 风格并发工作区界面

- **本地数据存储**
  - `localStorage`：保存 API Key、模型列表、并发上限、界面设置等数据  
  - 纯前端运行，不依赖服务器，不上传任何用户内容或配置

- **并发执行引擎**
  - 内置多 Lane 并发调度系统  
  - 支持最高 20 并发（可在设置中自由调整）  
  - 自动生成「lane-id」「执行进度」「输出流式解析」  
  - 可同时执行多个模型任务（视频 / 图像 / 文本）

- **模型兼容层（OpenAI Compatible）**
  - 所有请求均使用标准 OpenAI Chat/Images/Videos 协议  
  - 兼容：
    - 官方 OpenAI / Sora 接口  
    - 各类中转站（OneAPI、野生反代等）  
  - 可自定义模型名称，不做任何限制

- **文件处理能力（可扩展）**
  - 自动识别视频 / 图片生成结果  
  - 自动提供下载按钮  
  - 支持多图片打包 ZIP 导出（可选）

- **无后端依赖**
  - 浏览器直接请求用户配置的 API Host（官方或反代）  
  - 应用可单文件静态托管，无需后端服务器

---
## 🔧 部署方式

### 方式一：宝塔 / 服务器部署（推荐）

#### 标准模式（Nginx 静态部署）

```bash
# 克隆项目
git clone https://github.com/Wuniao79/Concurrent-Picture-AND-Video.git
# 安装依赖
npm install

# 构建生产环境
npm run build

# 将 dist文件夹调整为网站根目录
cp -r dist/* /www/wwwroot/aa.wuniao.xyz/
```
示例图
<img width="2169" height="67" alt="image" src="https://github.com/user-attachments/assets/01d0f509-0c5d-4197-8be6-434f058ace0c" />

> 部署完成后，直接访问你的域名即可使用 

---

### 方式二：本地部署（用于开发调试）

```bash
# 克隆项目
git clone https://github.com/Wuniao79/Concurrent-Picture-AND-Video.git

# 安装依赖
npm install

# 启动开发环境
npm run dev
```

访问地址：

```
http://localhost:3000/
```

---



## 🛣️ Roadmap（未来版本计划）
- [ ] 增加历史记录功能
- [ ] 支持Gemini官方API （目前无法使用）
- [ ] 多人在线聊天室？
- [ ] 多模式形态，如加入banana pro的4k 绘图设置选项等
- [ ] 以及其他小细节优化  
---
## 📸 界面概览

### 🖥️ 网页UI
<img width="2559" height="1351" alt="image" src="https://github.com/user-attachments/assets/780ceb21-50b3-4903-9c85-bcfdf80410e7" />

<img width="1379" height="1155" alt="image" src="https://github.com/user-attachments/assets/d1610a33-6b22-4c9b-82e5-ab7af6f7e070" />

<img width="1368" height="1144" alt="image" src="https://github.com/user-attachments/assets/942df47b-03bf-43c9-ad99-baaeecc8d774" />


### ⏰并发场景
<img width="2559" height="1336" alt="image" src="https://github.com/user-attachments/assets/3960e1d9-9eef-4297-8937-29d81d801ada" />

<img width="2558" height="1350" alt="image" src="https://github.com/user-attachments/assets/9df2b3ac-2b4f-49ee-a18e-54118dbd0110" />

<img width="2555" height="1347" alt="image" src="https://github.com/user-attachments/assets/6c376b80-41b2-4c74-9612-f6bcb81f6a33" />



---

## 🤝 与原项目的关系 & 贡献

首先必须感谢 **TheSmallHanCat** 佬的这个项目https://github.com/TheSmallHanCat/sora2api

此项目建立初衷完全是基于使用 **Sora2** 视频创作而建造。

因为 Sora2 视频需要大量摸奖才能得到能用的视频，所以就试着做了个网站。

原本是打算凑合能用的状态并写死模型就分享出来,正准备发的时候 banana pro 出来了

然后我就发现不仅仅是视频需要摸奖，图片也是有并发的需求的！

所以重构了整个网站。



我们欢迎：

1. 提交 Issue 反馈 Bug 或功能建议  
2. 提交 PR 增加新功能 / 修复问题  
3. 帮忙完善文档、示例、预设 Prompt

---

## 📄 License & 免责声明

本项目基于 [MIT License](LICENSE) 开源。

- 本项目本质上只是一个 **API 调用客户端**，不提供任何 AI 模型本身。  
- 请确保你的使用符合各个模型提供方（如 Google、OpenAI 等）的服务条款。  
- 请勿使用本项目生成、传播违反法律法规或平台规范的内容。
---


*   请确保您使用的 API Key 符合 Google Generative AI 的使用条款。
*   请勿利用本项目生成违反法律法规的内容。
