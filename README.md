<div align="center">

# Concurrent-Picture-AND-Video
 **一个基于 Web 的轻量级、高性能 AI 绘图的在线并发创作工作站**
 </div>
 
## 📸 界面概览

<img width="2304" height="1209" alt="image" src="https://github.com/user-attachments/assets/a51c4e12-cee0-4d21-8801-6f9166b0066d" />




<img width="2304" height="1209" alt="image" src="https://github.com/user-attachments/assets/a6b6b8dd-0e10-4304-9e14-2ce3141caa97" />





### ⏰并发场景

<img width="2522" height="1303" alt="image" src="https://github.com/user-attachments/assets/16cd350e-6770-49e0-a60d-e003775f639d" />

<img width="2529" height="1332" alt="image" src="https://github.com/user-attachments/assets/9ad4c09d-6ff0-4736-ae5d-6f8dc4ddd3b8" />



#### 🧩图片并发

<img width="2539" height="1301" alt="image" src="https://github.com/user-attachments/assets/83e18614-394d-4809-8863-b78691e6ad95" />


#### 📋文字并发
<img width="2544" height="1303" alt="image" src="https://github.com/user-attachments/assets/59872002-61fc-4365-ad71-f5f7f499e46c" />


</div>

# 🎨核心功能

- ### 🔗 可同时并发最高20条模型
- ### ⚙️ 支持所有中转站、OpenAI和Gemini的视频、图片和文字模型  
- ### 🔓 可自定义模型名称，无任何限制
- ### ✍️ 自带并发历史，可多历史同时运行
- ### 🎭 角色卡与提示词，无需反复复制角色ID与描述词
- ### 🏭 自带素材库，可快速保存需要的图片或视频，追求更高效的效率
- ### 🪞 新增九宫格分镜和简易时间线，可快速筛选合适的视频并进一步优化
- ### 🖼️ 提示词库，图片分割以及视频首尾帧提取等便携工具
- ### 🛡️ **全局提示 / 加载 / 进度条 / 错误处理**，整体体验更顺滑
- ### 🌓 **明暗主题** - 护眼模式，随心切换
- ### 💾 **本地存储** - 隐私安全，数据不上传

---
## ✨ 主要功能一览
###  **可同时并发任何模型**

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

### **超多工具在线调用**
  - 🏭图片分割工厂、提取视频帧和XHS 灵感实验室等在线工具站
  - 💿未来会新增更多功能

### **快速素材库和简易时间线**
  - 🗃️可快速将视频保存在本地进行验收或保存图片进行首尾帧生成
  - 🔐所有素材均本地保存，无任何泄露风险

### **📂角色卡与提示词库**
  - ✍️可自定义快捷角色和提示词，快速调用无需反复复制。
  - 🗒️在提示框内使用【@】或【/】即可快速调用。


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

##### 2025年12月05日： V2.2-V1 第二次重构整个项目，彻底解决了前端臃肿的代码块！  更新了可自主选择中转站以及Gemini密钥、半成品历史记录以及小细节优化。
##### 2025年12月13日： V3.0-v1 更新并发历史功能，修复Gemini官方模型偶尔无法获取图片或图片格式解析错误问题。美化UI以及小细节优化。
##### 2025年12月19日： V3.4-v1 新增图片一键下载按钮，谷歌密钥轮询。修复了并发历史还存在的部分bug以及小细节UI优化。
##### 2025年12月23日： V3.9-v1 新增并发间隔、一键下载地址和图片分割工厂等快捷功能，以及UI方面小细节优化。
##### 2025年12月25日： V4.0-v1 新增角色卡与提示词和Sora2pi提示词选项。UI方面小细节优化和部分bug修复。
##### 2025年12月31日： V4.2 新增素材库与简易时间线。UI方面小细节优化和部分bug修复。
##### 2026年01月08日： V4.3 新增分镜设计在线工具并增加了模型名称导入导出，UI方面小细节优化和部分bug修复。
##### 2026年01月20日： V4.4 新增视频抽帧拼贴（3×3/5×5、可清除上一帧、下载拼贴），并将“提取视频首尾帧”改名为“提取视频帧”。

---
## 🛣️ Roadmap（未来版本计划）
-  优化更多其他小细节优化
-  多人在线聊天室？（存疑）
-  加入如的DeepSeek、魔塔等官方接口？（存疑）
- ✅~~增加图片分镜功能~~
- ✅~~Sora2故事版功能~~
- ✅~~多模式形态切换，如加入banana pro的4k 绘图设置选项等~~
- ✅~~以及banana提示词小组件等...~~
- ✅ ~~支持Gemini官方API~~
- ✅~~增加历史记录功能（目前还不稳定）~~
- 更多...
---



---

## 🤝 与原项目的关系 & 贡献

首先必须感谢 **TheSmallHanCat** 佬的这个项目
https://github.com/TheSmallHanCat/sora2api

此项目建立初衷完全是基于使用 **Sora2** 视频创作而建造。

因为 Sora2 视频需要大量摸奖才能得到能用的视频，所以就试着做了个网站。

原本是打算凑合能用的状态并写死模型就分享出来,正准备发的时候 banana pro 出来了

发现不仅仅是视频需要摸奖，图片也是有并发的需求的！

所以重构了整个网站。

### 🖼️网站UI-参考
https://github.com/yeahhe365/All-Model-Chat

### 🍌香蕉提示词组件-项目原地址
https://github.com/glidea/banana-prompt-quicker

### Gemini官方4k调用以及其他小工具代码参考-项目原地址
https://github.com/Tansuo2021/gemini-3-pro-image-preview

---

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
