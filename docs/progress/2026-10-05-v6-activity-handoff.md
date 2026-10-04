# V6 活动流程交接（2026-10-05）

目标：把 Luma 学习 1–4（报名卡、日期方块、一页表单、安静的次要操作）做进 App，并保证每个界面先有 Pen 画板。

## 已确认的决定
- 用户批准三张：`V6 / 活动详情（报名卡）` Czib6、`V6 / 报名卡 · 其他状态` BExSK、`V6 / 发起活动（一页表单）` l8rkBv。
- 实现中补画（由已批准画板和旧画板 `activity-chat / 活动讨论`、`03 / Join review` 推出，待用户过目）：
  `V6 / 活动讨论` p59aZA、`V6 / 报名卡 · 发起人与其他状态` RyOui、`V6 / 确认报名（面板）` brKH6、`V6 / 发起活动 · 选项展开与提示` IlP6B。
- 待批准、未实现：`V6 / 全部活动（按日期分组）` H4f7id、`V6 / 官方活动面板（App 内）` z2v9N、`V6 / 分类显示真实数量` R64Nw。

## 代码（分支 `claude/native-ui-refresh`，提交 d581ba7）
- `apps/mobile/src/social/ActivityDetail.tsx`：报名卡状态机、讨论子页、无标签栏、浮动评论栏。
- `apps/mobile/src/social/JoinActivitySheet.tsx` + `src/ui/BottomSheet.tsx`：按内容高度的面板（iOS pageSheet 半高会遮住确认按钮）；成功自动关闭；拒绝时按服务器错误码说真实原因。
- `apps/mobile/src/social/ActivityForm.tsx`：一页表单，默认开始时间避开深夜（夜里改为 18:00）。
- `apps/mobile/src/social/DiscoverScreen.tsx`：状态标签只在已确认（绿）/候补（橙）时出现。
- `apps/mobile/src/ui/Pen.tsx`：lucide 1.x 改名的表情图标映射；缺图标时开发环境告警。
- `apps/mobile/src/ui/PlainField.tsx`：搜索框自绘占位文字（中文输入法下 iOS 原生占位被裁切/下沉）。

## 验证
- 模拟器逐项：报名→面板→成功关闭→你已报名；加入日历；提醒（提前 30 分钟）；讨论发评论/删除/举报展开；表单校验、步进器、可见范围、时间选择、发布；发起人视图；删除活动。
- 对照图：`docs/progress/evidence/native-ui-refresh/v6-activity/`。
- `npm test`：72 文件 / 406 通过。移动端 `tsc`：仍是 `src/product` 的 10 个既有错误。

## 下一步
1. 用户在 Pen 按 ⌘S，复制 `campus-apple.pen` 到 worktree `design/` 并提交；用户说“推”后合并到 `feat/hkust-life-mcp`。
2. 用户批准后实现 H4f7id / z2v9N / R64Nw。
3. 旧样式遗留：举报表单展开后的大按钮、帖子详情页的蓝色“举报 / 屏蔽”×3，需要先画 V6 板。
