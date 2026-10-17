# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-10-18

首个公开版本。

### 新增

- 深色响应式主题，PC 和手机共用一套模板：
  - PC 端：左侧频道栏加吸顶搜索栏。
  - 手机端：频道条加底部 Tab 栏。
- 页面：首页、分类频道页、片库筛选、搜索、详情、播放、排行榜、会员中心、评论、留言、系统提示页。
- 兜底：未覆盖的模块统一显示「暂未开放」兜底页。
- 播放器：
  - 主题自带加载层和缓冲动画。
  - `player-guard.js` 拦截播放器向外站注入的页面和推广脚本。
- `tools/patch-dplayer.php`：DPlayer 增强补丁（补丁版本 1）。
  - 强制用 hls.js 播放。
  - 缓冲层不拦截点击。
  - 自动播放被拦时静音起播，用户第一次交互时恢复声音。
- `qa/`：Playwright 截图、播放和自动播放验收脚本。

[1.0.0]: https://github.com/zhoushun98/maccms-theme-tvideo/releases/tag/v1.0.0
