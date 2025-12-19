<div align="center">

# Concurrent-Picture-AND-Video
 **一个基于 Web 的轻量级、高性能 AI 绘图的在线并发创作工作站**
 </div>
 
## 📸 界面概览

<img width="2527" height="1324" alt="image" src="https://github.com/user-attachments/assets/21b8f8ab-6c45-4edf-b7d2-820a3bcd4247" />



<img width="2551" height="1342" alt="image" src="https://github.com/user-attachments/assets/33c4c1a1-ab36-4821-a985-e79201bae3bf" />


### ⏰并发场景

<img width="2559" height="1433" alt="image" src="https://github.com/user-attachments/assets/852def70-55c7-4962-a8f9-3073a81b257d" />

#### 图片并发
<img width="2555" height="1347" alt="image" src="https://github.com/user-attachments/assets/6c376b80-41b2-4c74-9612-f6bcb81f6a33" />

#### 文字并发
<img width="2559" height="1341" alt="image" src="https://github.com/user-attachments/assets/a82ae624-d9c5-4599-88a8-b13214e67e99" />


</div>

# 🎨核心功能

- ### ⚙️ 支持所有中转站、OpenAI和Gemini的视频、图片和文字模型  
- ### 🔓 可自定义模型名称，无任何限制
- ### 🔗 可同时并发最高20条模型
- ### ✍️ 自带并发历史，可多历史同时运行
- ### 🛡️ **全局提示 / 加载 / 进度条 / 错误处理**，整体体验更顺滑
- ### 🌓 **明暗主题** - 护眼模式，随心切换
- ### 💾 **本地存储** - 隐私安全，数据不上传

---
## ✨ 主要功能一览
###  **同时并发**

  - 🔗 聊天栏支持最高 **20 路并发** 同时运行
  - 🧊 超过 **3 条** 并发任务自动折叠为小方块，界面更清爽

### **多模型并发历史**
  - 🧠 支持多个模型 **独立并发运行**
  - 🧩 各模型并发记录互不干扰，可随时切换查看与继续执行

### **可自定义并发模型**
  - ✍️ 可手动输入需要并发的模型名称/别名
  - ⚙️ 支持中转站自定义模型、OpenAI 以及 Gemini 官方模型并发调用

### **支持多站点｜密钥轮询**
  - 🔁 支持配置多家站点地址与多把密钥，并可自主选择启用
  - 🗝️ 支持 Gemini 官方多 Key 轮询，提高稳定性与吞吐

### **自带图片、视频下载功能**
  - ⬇️ 自动识别可下载的图片/视频并提供下载按钮，无需手动提取链接
  - 🖼️ 单击图片进入灯箱预览（Lightbox），支持查看大图与细节

### **Sora2 视频的 Remix 复制按钮**
  - 🧷 识别到 Sora2 的 Remix 内容后自动弹出 **一键复制** 按钮
  - **“📌 一键复制 Remix Prompt”** / **“🎬 复制视频 Remix”**

---
## 🔧 部署方式

### 方式一：宝塔 / 服务器部署（推荐）

#### 标准模式（Nginx 静态部署）

```bash
# 克隆项目
git clone https://github.com/Wuniao79/Concurrent-Picture-AND-Video.git

# 跳转目录
cd Concurrent-Picture-AND-Video

# 安装依赖
npm install

# 构建生产环境
npm run build


```
## 将 dist文件夹调整为网站根目录
示例图
<img width="2169" height="67" alt="image" src="https://github.com/user-attachments/assets/01d0f509-0c5d-4197-8be6-434f058ace0c" />

> 部署完成后，直接访问你的域名即可使用 

---

### 方式二：本地部署（即开即用）

```bash
# 克隆项目
git clone https://github.com/Wuniao79/Concurrent-Picture-AND-Video.git

# 跳转目录
cd Concurrent-Picture-AND-Video

#安装依赖
npm install

#构建生产环境代码
npm run build

#在本地预览生产环境效果
npm run preview

```

访问地址：

```
http://localhost:5015
```

## 🤔懒得部署？

### 稳定站：https://kk.wuniao.xyz/

除非有重大更新，否则不会有随意变动——给那些懒得动手的创作者。



---
# ✍️更新日志

##### 2025年12月05日:  V2.2-V1 第二次重构整个项目，彻底解决了前端臃肿的代码块！  更新了可自主选择中转站以及Gemini密钥、半成品历史记录以及小细节优化。
##### 2025年12月13日:  V3.0-v1 更新并发历史功能，修复Gemini官方模型偶尔无法获取图片或图片格式解析错误问题。美化UI以及小细节优化。
##### 2025年12月19日： V3.4-v1 新增图片一键下载按钮，谷歌密钥轮询。修复了并发历史还存在的部分bug以及小细节UI优化。

---
## 🛣️ Roadmap（3.1及未来版本计划）
-  优化更多其他小细节优化
-  多人在线聊天室？
-  多模式形态切换，如加入banana pro的4k 绘图设置选项等
-  Sora2故事版功能以及banana提示词小组件等...
- ✅ ~~支持Gemini官方API~~
- ✅~~增加历史记录功能（目前还不稳定）~~
- 更多...
---



---

## 🤝 与原项目的关系 & 贡献

首先必须感谢 **TheSmallHanCat** 佬的这个项目https://github.com/TheSmallHanCat/sora2api

此项目建立初衷完全是基于使用 **Sora2** 视频创作而建造。

因为 Sora2 视频需要大量摸奖才能得到能用的视频，所以就试着做了个网站。

原本是打算凑合能用的状态并写死模型就分享出来,正准备发的时候 banana pro 出来了

发现不仅仅是视频需要摸奖，图片也是有并发的需求的！

所以重构了整个网站。

### 🖼️网站UI-参考
https://github.com/yeahhe365/All-Model-Chat

### 🍌香蕉提示词组件（未来可期）

### 🍌香蕉官方4k调用以及其他小工具（未来可期）

---
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

- **无后端依赖**
  - 浏览器直接请求用户配置的 API Host（官方或反代）  
  - 应用可单文件静态托管，无需后端服务器





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
