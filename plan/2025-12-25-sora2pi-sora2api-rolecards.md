---
planning_method: builtin
task: "新增 Sora2pi 开关、Sora2api 模型参考页、角色卡/提示词与 @ / 菜单"
complexity: "L"
created_at: "2025-12-25T01:35:18+08:00"
repo: "Concurrent-Picture-AND-Video-main"
---

## 1) 目标与范围

### 目标

1. **界面页新增开关 `Sora2pi`**（带说明文案），用于控制是否显示设置面板中的 **`Sora2api模型`** 入口。
2. **新增设置页签 `Sora2api模型`**：展示图2/3/4的“模型介绍 + 风格ID”信息；点击模型名称/ID可一键复制，并弹出“已复制模型”的提示。
3. **新增设置页签 `角色卡/提示词`**：
   - 这是设置侧边栏的一个独立页签（与“关于/开发者选项”同级）。
   - 页内左上角有“启动开关”，开启后聊天输入框才会出现 **`@`** 与 **`/`** 的**单层可搜索**弹出菜单。
   - 页内右上角“添加”按钮：弹窗先选择类型：
     - **角色**：必填 `简称`、`@非中文ID`；可选：头像上传、人物备注。
     - **提示词**：必填 `简称`、`插入内容`；可选：头像上传、人物备注（提示词仅通过 `/简称` 调用插入）。

### 非目标（本计划不做）

- 不接入/改造真实 Sora2API 调用链路（仅做“参考页/快捷复制/输入辅助”）。
- 不引入新的后端服务或数据库（全部使用浏览器存储）。

---

## 2) 现状走查（落点文件）

- 设置面板页签/界面开关：`components/SettingsModal.tsx:573`、`components/SettingsModal.tsx:777`
- 设置项持久化（localStorage）：`hooks/useSettings.ts:1`
- 聊天输入框（需要增加 @ / 菜单）：`components/ChatInput.tsx:242`
- 统一组装并传递 settings：`App.tsx:195`、`App.tsx:1528`、`App.tsx:1689`

---

## 3) 需求拆解与交互

### 3.1 `Sora2pi` 开关（界面 → 界面选项）

- 展示位置：`界面 → 界面选项` 的网格开关区域（当前已有“流式 / 并发历史 / 更多图片”）。
- 文案：
  - 名称：`Sora2pi`
  - 介绍：`纪念我搭建此网站最初的的念头】`（按需求原样）
- 行为：
  - 开启：左侧页签列表出现 `Sora2api模型`
  - 关闭：`Sora2api模型` 页签隐藏；若当前正停留在该页签，自动跳回 `界面`
- 需要持久化：刷新后保持开关状态。

### 3.2 `Sora2api模型` 页签（模型介绍 + 一键复制）

- 内容结构（对齐图2/3/4）：
  1. **支持的模型**
     - 图片模型表：模型/说明/尺寸
     - 视频模型表：标准版（Sora2）/ Pro版 / Pro HD版（分区表）
     - Pro 系列备注（例如需要 Pro 订阅的提示）
  2. **视频风格功能**
     - 使用方法说明：在提示词中用 `{风格ID}` 指定风格
     - 风格表：风格ID/显示名称/说明
- 交互：
  - “模型名称/ID”渲染为可点击 pill（或按钮），点击即复制对应字符串
  - 页面右下/右上出现 1.5s toast：`已复制模型：<id>`（或简化为“已复制模型”）

### 3.3 `角色卡/提示词` 页签（管理 + 输入辅助）

- 页面顶部：
  - 左上角：启动开关（仅开启后 ChatInput 才出现 `@` 与 `/` 菜单）
  - 右上角：添加按钮
- 列表区域：
  - 展示已创建条目（头像、简称、@id、备注）
  - 至少支持删除；建议同时提供“复制 @id / 复制简称”便捷动作
- 添加弹窗（“二级菜单”）：
  - 首先选择类型：**角色 / 提示词**
  - 角色必填：简称（可中文/英文），@非中文ID（禁止中文）
  - 提示词必填：简称（可中文/英文），插入内容（任意提示词文本）
  - 可选：头像图片上传（建议压缩/限制尺寸），人物备注
  - 保存后写入本地存储；刷新可保留
- ChatInput 输入辅助（开启开关后）：
  - 输入 `@`：弹出**角色**列表（按输入过滤），点击条目将 `@id` 插入到光标处
  - 输入 `/`：弹出**角色 + 提示词**列表（按输入过滤）
    - 选择“角色”：插入对应的 `@id`
    - 选择“提示词”：插入你填写的 `插入内容`
    - “提示词”仅通过 `/简称` 调用插入（不出现在 `@` 菜单）
  - 支持键盘：↑↓选择，Enter/Tab确认，Esc关闭；菜单打开时 Enter 不应触发“发送”

---

## 4) 数据模型与存储（useSettings）

### 4.1 新增 settings key（建议）

- `sora_sora2pi_enabled`: `'1' | '0'`
- `sora_role_cards_enabled`: `'1' | '0'`
- `sora_role_cards_v1`: JSON 数组（角色卡数据）

### 4.2 角色卡/提示词结构（建议 TypeScript）

```ts
type RoleCardItem = {
  id: string;              // uuid
  kind: 'role' | 'prompt';
  alias: string;           // 简称（可中文/英文）
  atId?: string;           // 仅 role：@ 非中文ID（不含 @）
  insertContent?: string;  // 仅 prompt：插入内容
  avatarDataUrl?: string;  // 可选，压缩后的 dataURL
  note?: string;           // 可选备注
  createdAt: number;
  updatedAt: number;
};
```

---

## 5) 实现分解（按提交粒度）

### Phase 1：设置项落地与传参

1. `hooks/useSettings.ts`
   - 新增 `sora2piEnabled`、`roleCardsEnabled`、`roleCards` 三组 state + 持久化 useEffect
2. `App.tsx`
   - 解构并向 `SettingsModal`、`ChatInput` 透传新增 props
3. `components/SettingsModal.tsx`
   - Props 与 `activeTab` union 扩展
   - `界面选项` 增加 `Sora2pi` 开关
   - tabs 数组：根据 `sora2piEnabled` 动态插入 `Sora2api模型` 页签
   - 新增固定页签 `角色卡/提示词`

验收点：
- 刷新后开关状态保持；关闭开关时 `Sora2api模型` 自动消失且不会卡在空白页。

### Phase 2：`Sora2api模型` 页面（静态内容 + 复制 + toast）

1. `components/SettingsModal.tsx`
   - 新增 `activeTab === 'sora2api'` 的渲染块
   - 写死图2/3/4的数据结构（数组常量）
   - 实现 `copyToClipboard(text)` + toast（本页内的轻量提示即可）

验收点：
- 点击任意模型/风格ID均可复制，且出现“已复制模型”提示。

### Phase 3：角色卡管理页面（新增/删除/持久化）

1. `components/SettingsModal.tsx`
   - `activeTab === 'roleCards'`：开关 + 添加弹窗 + 列表
   - 添加弹窗支持两种类型：角色 / 提示词
   - 表单校验：角色的 @id 禁止中文（可用正则检测 `\\p{Script=Han}` 或简化为“包含中文即报错”）
   - 头像上传压缩：复用 `components/tools/PromptLibraryModal.tsx` 的图片压缩逻辑，或抽到 `utils/` 供复用

验收点：
- 可新增/删除条目；刷新后数据仍在；头像不会把 localStorage 撑爆（至少做尺寸压缩+数量上限）。

### Phase 4：ChatInput 的 `@`/`/` 菜单（开启开关后生效）

1. `components/ChatInput.tsx`
   - 新增 props：`roleCardsEnabled`, `roleCards`
   - 在 `textarea` 的 `onChange`/`onKeyDown` 中解析光标附近 token：
     - `@`：识别 `@` 到光标的查询串
     - `/`：识别 `/` 到光标的查询串
   - 渲染浮层列表（靠近输入框左下/上方即可）
   - 键盘交互：↑↓、Enter/Tab、Esc；菜单打开时阻止 Enter 发送
   - 选中后进行文本替换并更新光标位置

验收点：
- 开关关闭时不出现菜单；开关开启后可稳定弹出、过滤、插入；不破坏原有 Enter 发送/Shift+Enter 换行逻辑。

---

## 6) 验收清单（用户视角）

- [ ] `界面` 页出现 `Sora2pi` 开关与说明文案
- [ ] 开启后左侧出现 `Sora2api模型`；关闭后消失
- [ ] `Sora2api模型` 页面展示图2/3/4信息；点击模型/风格ID复制并提示
- [ ] `角色卡/提示词` 页面可启用/禁用输入辅助；可新增角色卡并持久化
- [ ] 启用后 ChatInput 输入 `@` 与 `/` 触发菜单；点击/键盘选择可插入

---

## 7) 风险与对策

- localStorage 容量：头像 dataURL 可能导致写入失败  
  - 对策：上传即压缩（限制最大边 & jpeg 质量），并限制条目数量（例如 200）
- 输入框插入文本的光标处理：容易出现插入位置不对  
  - 对策：基于 `selectionStart/selectionEnd` 精准替换；只处理“光标处在 token 内”的场景
- 菜单交互复杂度  
  - 对策：先做“单层可搜索列表（MVP）”，需要再升级级联结构

---

## 8) 已确认的关键交互

1. `@` 菜单：仅显示“角色”，选中后插入 `@id`
2. `/` 菜单：显示“角色 + 提示词”
   - 角色：插入 `@id`
   - 提示词：插入 `插入内容`
3. 菜单形态：图5那种**单层可搜索列表**即可
