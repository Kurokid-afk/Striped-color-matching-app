# 条纹纺织调色

Windows 便携桌面软件，用于条纹结构设计、颜色库与色板管理、方案收藏、项目导入导出，以及生产 Excel 数格与结果导出。

## 成品

运行 `release/条纹纺织调色.exe`。这是单文件便携版，不需要安装 Node.js、开发环境或浏览器扩展。

用户的色库、色板、收藏和持久化数据保存在 `%APPDATA%\StripeStudio`，移动或更新 EXE 不会改变该数据目录。旧 HTML 版导出的固定资产文件可通过软件中的“导入固定资产”载入。

## 开发与构建

- `npm install`：安装构建依赖。
- `npm run self-test`：运行桌面壳自检。
- `npm run dist`：生成 Windows x64 单文件便携版。

外部更新器的定位、退出和数据兼容约定见 `docs/UPDATE_CONTRACT.md`。
