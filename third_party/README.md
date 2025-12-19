# third_party（第三方开源功能存放区）

这里用于放置从其他开源 GitHub 项目“搬运/参考/裁剪”的功能代码，方便后续升级与排查。

## 建议约定（推荐）

- 一个来源一个文件夹：`third_party/<项目名>/`
- 该文件夹内至少保留：
  - `SOURCE.md`：来源仓库链接、commit/tag、许可证、引入的文件列表、你做过的修改说明
  - 原项目 `LICENSE`（如果你复制了对方代码进来）
- 不要直接改第三方原文件逻辑：能包一层适配就包一层，避免后续难以同步上游。

## 模板

你可以复制下面内容到 `third_party/<项目名>/SOURCE.md`：

```md
# Source
- Repo:
- Commit/Tag:
- License:

# Imported
- (files…)

# Local Changes
- (what changed and why…)
```

