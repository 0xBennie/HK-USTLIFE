# Pen UI 阶段交接

- 目标：将 iPhone App 完整 UI 整理进 Pen，提供可直接打开的设计与 App 展示。
- 已确认：Apple 风格、五个 Tab、学习/校园/社交联通、社交自愿；不需要 Xcode 完成本设计阶段。
- 完成：102 个页面与状态、8 个深色样例、7 个可复用组件；Pen 内 live browser、完整图层 HTML、102 页 PDF。
- 主文件：`design/campus-apple.pen`。交付索引：`design/presentation/README.md`。
- 展示：`http://127.0.0.1:14331/`；启动：`zsh scripts/preview-pen-ui.sh`。
- 验证：报名/候补/失败重试/退出、日程与消息联动、任务校验/草稿/跨页保存、活动预览、窄屏、明暗对比与减少动态效果。详见 `design/presentation/verification.json`。
- 保存：Pen 原生 Save 已执行，磁盘文件从约 456KB 更新为约 1.6MB；原文件备份于 `.local/pen-complete/campus-apple.before.pen`。
- 下一步：按模块把已确认设计接入既有 Expo 实现，再做真机运行、原生动画和实际授权/API 验收。这些未作为本阶段完成项，也没有改变原生交付 goal 的 blocked 状态。
- 边界：本次没有部署、没有新增账号/学校权限、没有发送任何外部消息；保留现有未提交代码。官网/管理端不在本次 iPhone 画板统计内。
