# 条纹纺织调色

Windows 便携桌面软件，用于条纹结构设计、颜色库与色板管理、方案收藏、项目导入导出，以及生产 Excel 数格与结果导出。

## 成品

正式主程序为 `release/成品/条纹纺织调色.exe`。这是单文件便携版，不需要安装 Node.js、开发环境或浏览器扩展。

给现有用户升级时，只需要发送 `release/升级包/条纹纺织调色升级包.exe`。升级包可以放在任意位置运行，会优先通过软件登记信息定位主程序；登记位置失效时会搜索常用文件夹和已连接磁盘，最后才要求用户手动选择一次。升级过程会校验新版、让旧版安全退出、原位替换并自动回滚失败更新。

用户的色库、色板、收藏和持久化数据保存在 `%APPDATA%\StripeStudio`，移动或更新 EXE 不会改变该数据目录。旧 HTML 版导出的固定资产文件可通过软件中的“导入固定资产”载入。

## 开发与构建

- `npm install`：安装构建依赖。
- `npm run self-test`：运行桌面壳自检。
- `npm run dist`：生成 Windows x64 单文件便携版。
- `dotnet publish updater/StripeStudioUpdater.csproj -c Release`：把正式主程序和 SHA-256 清单内嵌为单文件升级包。

更新器的定位、退出、校验、回滚和数据兼容约定见 `docs/UPDATE_CONTRACT.md`。
