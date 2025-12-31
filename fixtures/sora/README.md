# Sora fixtures（回归样本）

本目录用于固化 Sora 典型返回 payload，给 `utils/parseSoraPayload.ts` 的解析与渲染回归使用。

## 格式

每个样本是一个 `*.json` 文件：

- `name`：样本名称（简短、可维护）
- `input`：原始文本（保持换行/HTML/实体编码等真实形态）
- `expected`：期望解析结果（用于回归校验）
  - `logsText`：进度/日志文本（或 `null`）
  - `videoSrc`：视频直链（或 `null`）
  - `fullHtml`：原始 HTML（或 `null`）
  - `remixId`：Post/Remix ID（或 `null`）

注意：所有样本必须脱敏，不应包含密钥、真实用户信息或可追溯的私有链接。

