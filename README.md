# pushplus-timed-push

> 一个 WorkBuddy / Claude Code Skill：把任意内容按北京时间**准点**推送到微信。基于 PushPlus + Cloudflare Worker Cron Triggers，免服务器、免费、误差以秒计。

[![Skill](https://img.shields.io/badge/type-Skill-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 这个 Skill 解决什么问题

想每天固定时间收到提醒（学习计划、打卡、每日一句、微目标……），但：

- ❌ **GitHub Actions 的 `schedule` 完全不准时** —— 它是「尽力而为」，整点/半点高负载时延迟几分钟到几十分钟，甚至直接丢弃任务
- ❌ 不想为了定时推送租一台 24 小时开机的服务器
- ❌ 不想写一堆代码

这个 Skill 用 **Cloudflare Worker + Cron Triggers** 解决：免费、免服务器、到点几秒内触发。

---

## 三种方案对比

| 方案 | 准点性 | 成本 | 适用 |
|---|---|---|---|
| **Cloudflare Worker + Cron Triggers** ✅ | 到点几秒内触发 | 免费、无需服务器 | **绝大多数场景（推荐）** |
| VPS + 系统 crontab | 秒级精准 | 需常开服务器 | 已有 VPS |
| GitHub Actions `schedule` | ❌ 延迟几分钟~几十分钟，高负载丢弃 | 免费 | 不推荐 |

> **实测教训**：本项目作者最初用 GitHub Actions，用户反馈「完全不准时」，迁到 Cloudflare Worker 后解决。

---

## 快速开始

### 1. 准备 PushPlus token

1. 注册 [pushplus.plus](https://www.pushplus.plus/)
2. **必须实名**（[verify.pushplus.plus](https://verify.pushplus.plus/)），否则接口返回 `code: 905`
3. 复制你的 32 位 token

> 免费额度：微信渠道实名后 **200 条/天**；同内容 1 小时最多 3 条；1 分钟最多 5 次。

### 2. 部署 Cloudflare Worker

完整分步指引见 [`SKILL.md`](./SKILL.md)。核心 5 步：

1. **创建**：`dash.cloudflare.com` → 左侧 **Workers & Pages** → **Create application** → 选 **Workers** → **Start with Hello World!**（⚠️ 不要选 Connect GitHub）→ 命名 → **Deploy**
2. **贴代码**：进入 Worker → **Edit code** → 全选删除默认代码 → 粘贴 [`examples/cloudflare-worker/worker.js`](./examples/cloudflare-worker/worker.js) → **Deploy**
3. **设 Secret**：**Settings** → **Variables and Secrets** → **+ Add**
   - Type: **Secret**（不是 Text）
   - Name: `PPTOKEN`
   - Value: 你的 token
   - ⚠️ **必须勾 Production 环境**（Cron 只在 Production 跑）
4. **加 cron**：**Settings** → **Triggers** → **Cron Triggers** → **+ Add Cron Trigger**
   - ⚠️ **必须点「Cron expression」标签**，不要用默认的 Schedule 可视化模式
5. **测试**：浏览器访问 `https://<你的Worker>.workers.dev/?test=1` → 返回 `code:200` + 微信收到消息

### 3. 关闭旧的调度器

如果之前用过 GitHub Actions，记得去 `github.com/<user>/<repo>/actions` 把旧工作流 **Disable workflow**，避免重复推送。

---

## Cron 表达式速查（UTC → 北京时间）

cron 用 **UTC**，北京时间 = UTC + 8。

| 目标（北京） | cron |
|---|---|
| 每天 08:00 | `0 0 * * *` |
| 每天 09:01 | `1 1 * * *` |
| 21:00–23:30 每半小时 + 00:00 | `*/30 13-16 * * *`（16:30 UTC 那次需代码过滤） |

---

## 已知坑（都已收录进 SKILL.md）

| 现象 | 原因 | 解法 |
|---|---|---|
| PushPlus `code: 905` | 未实名 | 去 verify.pushplus.plus 实名 |
| PushPlus `code: 999` | **标题含换行符** | 标题去换行（`printf '%s' \| jq -Rs .`） |
| `code: 903` | token 无效 | 检查 token |
| 定时不触发 | Secret 只勾了 Previews | 改勾 **Production** |
| cron 配不了复杂时间 | 用了 Schedule 可视化模式 | 切到 **Cron expression** 标签 |
| 推送延迟/丢失 | 用了 GitHub Actions | 迁到 Cloudflare Worker |

---

## 目录结构

```
.
├── SKILL.md                          # 技能主文档（完整部署指引）
├── LICENSE
├── README.md
└── examples/
    └── cloudflare-worker/            # 可直接运行的最小示例
        ├── src/index.js              # scheduled + fetch 双 handler
        ├── src/data.js               # 内容数据（示例：100 鼓励 + 100 微目标 + 88 天雅思）
        ├── worker.js                 # 单文件版（粘 Dashboard 用）
        ├── wrangler.toml             # cron 配置
        ├── package.json
        └── test.mjs                  # 本地触发逻辑测试
```

---

## 示例：本地测试

```bash
cd examples/cloudflare-worker
node --check worker.js   # 语法检查
node test.mjs            # 触发判断与内容组装测试
```

---

## 安装为 Skill

把 `SKILL.md` 放到：

```
~/.workbuddy/skills/pushplus-timed-push/SKILL.md
```

之后在 WorkBuddy / Claude Code 里直接说：

- 「每天 21 点给我推送一条今天的学习总结」
- 「帮我加一个每日单词推送」
- 「改一下推送时间」

即可自动加载本技能。

---

## License

MIT
