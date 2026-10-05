---
name: pushplus-timed-push
description: 搭建「定时推送到微信」的自动化系统（PushPlus + 可靠调度器）。当用户说「每天几点提醒我」「定时推送」「微信推送」「计划提醒」「打卡提醒」「PushPlus」时使用。含两种调度方案：Cloudflare Worker + Cron Triggers（推荐，免服务器、准点到秒）与 VPS crontab；并覆盖 PushPlus 实名、标题换行 999 报错、GitHub Actions 定时不准时等已知坑。
agent_created: true
---

# PushPlus 定时推送系统

把任意内容（学习计划表、每日一句、微目标、打卡清单）按北京时间定时推到用户微信。

## 一、方案选型（重要，先选对再动手）

| 方案 | 准点性 | 成本 | 适用 |
|---|---|---|---|
| **Cloudflare Worker + Cron Triggers** ✅ 首选 | 到点几秒内触发 | 免费、无需服务器 | 绝大多数场景 |
| VPS + 系统 crontab | 秒级精准 | 需常开服务器 | 用户已有 VPS |
| GitHub Actions schedule | ❌ **延迟几分钟到几十分钟，高负载时直接丢弃** | 免费 | 不推荐（仅适合不在乎时间的场景） |

**教训（真实踩坑）**：GitHub Actions 的 `schedule` 是「尽力而为」，整点/半点高负载会延迟甚至丢任务。用户明确反馈「完全不准时」后迁到 Cloudflare Worker 解决。**需要准点的定时推送，别用 GitHub Actions。**

## 二、PushPlus 基本规则

- 官网 `pushplus.plus`，注册后拿 **32 位 hex token**
- **必须实名**（`verify.pushplus.plus`），否则请求返回 `code: 905`
- 微信渠道：实名后 **200 条/天**；同内容 1 小时最多 3 条；1 分钟最多 5 次
- 接口：`POST https://www.pushplus.plus/send`
  ```json
  {"token":"<32位>","title":"标题","content":"正文","template":"markdown"}
  ```
- 返回 `{"code":200,...,"msg":"执行成功"}` 即成功

### 已知报错

| code | 原因 | 解法 |
|---|---|---|
| `905` | 未实名 | 去 verify.pushplus.plus 实名 |
| `999` | **标题含换行符** | 标题务必去换行（shell 里 `jq -Rs` 的 `<<<` 会加尾换行，改用 `printf '%s' "$T" \| jq -Rs .`） |
| `903` | token 无效 | 检查 token |

## 三、Cloudflare Worker 方案（推荐）

### 项目文件结构

```
<project>/cloudflare-worker/
├── src/index.js      # scheduled + fetch 双 handler
├── src/data.js       # 内嵌内容数据（自动生成，勿手改）
├── wrangler.toml     # cron 配置
├── worker.js         # 单文件版（粘 Dashboard 用，由 build_single_file.py 生成）
└── test.mjs          # Node 本地测试触发逻辑
```

### 代码要点

**1. 北京时间取日期**（UTC 字段即北京墙钟时间）
```js
export function bjDate(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600 * 1000);
}
// 用 bj.getUTCFullYear() / getUTCMonth() / getUTCDate() 即得北京年月日
```

**2. 日期循环取内容索引**
```js
const START_UTC = Date.UTC(2026, 9, 2); // 起始日
const DAY_MS = 86400000;
function dayIndex(bj) {
  const t = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  return ((Math.floor((t - START_UTC) / DAY_MS) % 100) + 100) % 100;
}
```

**3. 双 handler 结构**（`scheduled` 干活、`fetch` 做测试入口）
```js
export default {
  async scheduled(event, env, ctx) {
    const jobs = pickJobs(event.cron);   // 按 event.cron 判断该发哪几条
    for (const j of jobs) await pushOne(env.PPTOKEN, j);
  },
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.searchParams.get("test") === "1") {
      // 手动发全部 3 条，返回 {"ok":true,...}
    }
    return new Response("daily-reminder ok");
  },
};
```

**4. cron 表达式（UTC，北京时间需 -8）**

| 目标（北京） | cron |
|---|---|
| 每天 08:00 | `0 0 * * *` |
| 每天 09:01 | `1 1 * * *` |
| 21:00–23:30 每半小时 + 00:00 | `*/30 13-16 * * *`（16:30 UTC 那次代码里跳过） |

⚠️ **避免 `*/30 13-16` 的边界坑**：会包含 16:30 UTC = 北京 00:30，超出范围，需在代码里过滤，或拆成 `*/30 13-15` + `0 16`。

### 部署步骤（Dashboard 中文/英文界面）

> ⚠️ **沙箱网络无法访问 Cloudflare 控制台**（`dash.cloudflare.com` 返回 403、`api.cloudflare.com` 返回 000，被代理拦截）。**必须让用户在本机自己操作**，AI 只做分步指路 + 看截图纠错。

1. **创建**：`dash.cloudflare.com` → 左侧 **Workers & Pages** → **Create application** → 选 **Workers** 选项卡 → **Start with Hello World!**（⚠️ 不要选 "Connect GitHub"）→ Name 填项目名 → **Deploy**
2. **贴代码**：进 Worker → **Edit code** → 全选删除默认代码 → 粘贴 `worker.js` 全文 → **Deploy**
3. **设 Secret**：**Settings** → **Variables and Secrets** → **+ Add**
   - Type: **Secret**（不是 Text）
   - Name: `PPTOKEN`
   - Value: 32 位 token
   - ⚠️ 环境勾选 **Production**（Cron 只在 Production 跑；只勾 Previews 会导致定时找不到 token）
4. **加 cron**：**Settings** → **Triggers** → **Cron Triggers** → **+ Add Cron Trigger**
   - ⚠️ **必须点「Cron expression」标签**，不要用默认的「Schedule」可视化模式（Schedule 只能配单一间隔）
   - 逐条添加 cron 表达式
5. **测试**：浏览器打开 `https://<worker名>.<子域>.workers.dev/?test=1` → 返回 `code:200 执行成功` × N + 微信收到 N 条

### 关闭旧的 GitHub Actions（迁移后必做）

避免重复推送。`github.com/<user>/<repo>/actions` → 左侧选工作流 → 右上 **...** → **Disable workflow**（禁用后名称旁出现 ⊘ 图标）。
也可用写权限 token 调 API：
```bash
gh api -X PUT repos/{owner}/{repo}/actions/workflows/{file}/disable
```

## 四、VPS crontab 方案（备选）

- `push_reminders.py`：纯 stdlib `urllib` 调 PushPlus，按北京日期取今日内容，标题去换行
- `crontab.txt`：**cron 用 UTC 还是本地时区取决于服务器设置**，部署前先 `date` 确认服务器时区，别盲目套 UTC
- 安装：`crontab vps-reminders/crontab.txt`

## 五、验证清单（交付前必走）

1. `node --check worker.js` → 语法 0 报错
2. `node test.mjs` → 触发判断与内容组装正确
3. Dashboard 里 cron 的 **"Next" 预览时间** 换算成北京时间核对
4. `?test=1` 实测 → PushPlus 返回 `code:200`
5. 微信实际收到消息（让用户确认）
6. 旧调度器（GitHub Actions）已禁用

## 六、内容管理

- 内容存 `data.js`（数组），版式建议：标题固定 + 正文带序号进度（如「第 12 / 100 句」）
- 从 md 源文件批量生成 data.js 用脚本（如 `generate_worker_data.py`），比手敲可靠
- 单文件版（Dashboard 用）用脚本从 `src/*.js` 拼出 `worker.js`，避免手工维护两份
