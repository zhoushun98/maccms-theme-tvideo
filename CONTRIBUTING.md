# 参与贡献

感谢你愿意改进 TVideo！提交 issue 和 PR 前请先读完本文。

## 提 issue

- **Bug**：请写明 maccms 版本、PHP 版本、浏览器与设备，以及出错页面的地址和截图；最好再附上浏览器控制台或 PHP 错误日志。
- **新需求**：先说清楚使用场景，再给出期望的效果。

## 开发环境

主题没有构建步骤，需要一个能访问的 maccms10 站点（本地或测试服均可）：

1. 把 `template/tvideo` 同步到站点的 `template/` 下，例如：

   ```bash
   rsync -a --delete template/tvideo/ user@host:/path/to/maccms10/template/tvideo/
   ```

2. 后台的「网站模板」和「手机模板」都选 `tvideo`。
3. 改了模板后要清空 `runtime/temp`，因为 maccms 会缓存编译后的模板。CSS 和 JS 不用清：链接上带有按文件修改时间生成的版本号，会自动刷新。

## 代码约定

- **不引入构建工具、npm 运行时依赖和外部 CDN。**
  - 样式用原生 CSS 变量，设计变量集中在 `main.css` 开头。
  - 脚本用原生 JS，ES5 写法加 IIFE，按 `data-tv-*` 属性挂载功能。
  - 只依赖 maccms 自带的 jQuery 和 `home.js`。
- **缩进**：模板、CSS、JS 用 2 个空格，PHP 用 4 个空格，详见 `.editorconfig`。
- **资源路径**：一律用 `{$maccms.path_tpl}`，不要写死 `template/tvideo`。
- **注释**：用中文，写清楚「为什么」，不要只复述代码。

## maccms 模板引擎的注意事项

- **缺模板直接报错**：maccms 遇到缺失的模板（包括被 include 的片段）会直接抛 `TemplateNotFoundException`，不会回退到默认主题。
  - 新增可访问的路由时，必须配好模板。
  - 不打算支持的页面，模板里只写 `{include file="public/fallback" /}`。
- **`{php}` 块**：里面不能出现 `{$`；`{:(expr)}` 这种写法也不会被解析。
- **嵌套标签**：嵌套的 maccms 标签，`id` 和 `key` 不能重名。
- **分页**：分页片段必须紧跟在对应的 `paging="yes"` 标签后面。
- **会被替换的字符串**：不要在模板里写 `__STATIC__` 这类会被引擎替换的字符串。
- **判断当前页面**：用 `$maccms.aid`，`head.html` 里已经算好放在 `$tv_aid` 中。

  | aid | 页面 |
  | --- | --- |
  | 1 | 首页 |
  | 4 | 留言 |
  | 6 | 会员 |
  | 7 | 排行 |
  | 11 | 分类 |
  | 12 | 筛选 |
  | 13 | 搜索 |
  | 14 | 详情 |
  | 15 | 播放 |
  | 16 | 下载 |

- **ajax 片段**：`comment/ajax`、`gbook/ajax` 以片段形式返回，不经过 `public/head`，所以要自己 include `public/fn`。
- **相对时间**：不要用核心的 `mac_friend_date`，它会把今天的时间显示成「昨天」。请用 `public/fn` 里的 `tv_ago()`。
- **`home.js` 的 DOM 契约**：
  - 依赖的类名：`.mac_hits`、`.mac_ulog`、`.digg_link`、`.mac_comment`、`.comment_form`、`.gbook_form`、`.mac_verify_img` 等。
  - 页面上必须有一个 `.mac_user` 元素，主题已用隐藏的 span 占位。
  - 不要使用 `.mac_wd`、`img.lazy`、`.mac_shorten` 这些类名。`.mac_shorten` 会请求外站。

## 验收

`qa/` 目录下是 Playwright 脚本。页面地址按开启伪静态后的格式书写。

```bash
cd qa
npm ci
npx playwright install chromium webkit

BASE=https://your-test-site node shot.mjs            # 主要页面的 PC + 手机截图，输出到 out/，并汇总报错、失败请求和第三方请求
BASE=https://your-test-site node play.mjs /vodplay/1-1-1.html   # 真实播放验证（需要本机安装 Google Chrome）
BASE=https://your-test-site node autoplay.mjs        # 模拟 Safari 自动播放策略（需先打 DPlayer 补丁）
```

提交 PR 前请至少确认：
- 改到的页面在 PC（1440 宽）和手机（iPhone 尺寸）上都截图看过。
- `out/report.json` 里没有新增的控制台报错或失败请求。

## 提交 PR

1. Fork 后从 `main` 新建分支，一个 PR 只做一件事。
2. 提交信息用中文，第一行概括改了什么，正文说明原因和影响。
3. 涉及界面的改动请附修改前后的截图。
4. 修改 `tools/patch-dplayer.php` 时，请同时递增其中的 `PATCH_VERSION`，并在 `CHANGELOG.md` 里记一笔。
