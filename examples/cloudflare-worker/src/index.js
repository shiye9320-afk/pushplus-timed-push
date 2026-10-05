import { encouragements, microgoals, ielts } from "./data.js";

const START_UTC = Date.UTC(2026, 9, 2); // 起始日 2026-10-02
const DAY_MS = 86400000;
const PUSHPLUS = "https://www.pushplus.plus/send";

// 返回一个"北京墙钟时间"的 Date：其 UTC 字段即为北京时间
export function bjDate(nowMs = Date.now()) {
  return new Date(nowMs + 8 * 3600 * 1000);
}

function dayIndex(bj) {
  const t = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  return ((Math.floor((t - START_UTC) / DAY_MS) % 100) + 100) % 100;
}

export function buildEncourage(bj) {
  const i = dayIndex(bj);
  const msg = encouragements[i % encouragements.length];
  return {
    title: "今日一句 · 自我鼓励",
    content: `## 今日一句 · 自我鼓励（第 ${i + 1} / ${encouragements.length} 句）\n\n> ${msg}\n\n新的一天，先对自己说一句好话 🌟`,
  };
}

export function buildMicrogoal(bj) {
  const i = dayIndex(bj);
  const msg = microgoals[i % microgoals.length];
  return {
    title: "今日微目标",
    content: `## 今日微目标（Day ${i + 1} / ${microgoals.length}）\n\n> ${msg}\n\n5 分钟内能完成，重点是持续不是用力 ✅`,
  };
}

export function buildIelts(bj) {
  const ymd = bj.toISOString().slice(0, 10);
  const row = ielts.find((r) => r.date === ymd);
  let content;
  if (row) {
    content = `## 今日雅思任务（Day ${row.day} ｜ ${row.week} ｜ ${row.weekday}）\n\n- 精听·跟读：${row.listen}\n- 开口·输出：${row.speak}\n- 时长：${row.minutes} 分钟\n\n完成后打卡 ✅`;
  } else {
    content = "今天不在计划期内（2026-10-08 ~ 2027-01-03）。保持每日 60 分钟 4 段法节奏～";
  }
  return { title: "今日雅思任务", content };
}

// 按北京时间决定这一刻要发哪几条
export function pickJobs(bj) {
  const hh = bj.getUTCHours();
  const mm = bj.getUTCMinutes();
  const jobs = [];
  if (hh === 8 && mm === 0) jobs.push("ielts", "encourage");
  if (hh === 9 && mm === 1) jobs.push("microgoal");
  const evening = (hh === 21 || hh === 22 || hh === 23) && (mm === 0 || mm === 30);
  const midnight = hh === 0 && mm === 0;
  if (evening || midnight) jobs.push("ielts");
  return jobs;
}

const BUILDERS = { ielts: buildIelts, encourage: buildEncourage, microgoal: buildMicrogoal };

async function pushOne(env, kind, bj) {
  const { title, content } = BUILDERS[kind](bj);
  const resp = await fetch(PUSHPLUS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: env.PPTOKEN, title, content, template: "markdown" }),
  });
  const text = await resp.text();
  console.log(kind, "->", text);
  return text;
}

// 访问 Worker 网址（可加 ?test=1）用于手动验证推送
async function handleFetch(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.get("test") === "1") {
    if (env.TEST_KEY && url.searchParams.get("key") !== env.TEST_KEY) {
      return new Response("forbidden", { status: 403 });
    }
    const bj = bjDate();
    const out = [];
    for (const kind of ["ielts", "encourage", "microgoal"]) {
      out.push(await pushOne(env, kind, bj));
    }
    return new Response("test sent:\n" + out.join("\n"), { status: 200 });
  }
  return new Response("daily-reminder is running. 访问 ?test=1 可发一条测试推送。", { status: 200 });
}

export default {
  async scheduled(event, env, ctx) {
    const bj = bjDate();
    const jobs = pickJobs(bj);
    console.log("scheduled", event.cron, "bj=", bj.toISOString(), "jobs=", jobs.join(","));
    const results = [];
    for (const kind of jobs) results.push(await pushOne(env, kind, bj));
    return results.join(" | ");
  },
  fetch: handleFetch,
};
