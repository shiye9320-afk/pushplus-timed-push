import { pickJobs, buildEncourage, buildMicrogoal, buildIelts } from "./src/index.js";
import { encouragements, microgoals, ielts } from "./src/data.js";

console.log("counts:", { enc: encouragements.length, mg: microgoals.length, ielts: ielts.length });

const bj = (h, m, d = 5) => new Date(Date.UTC(2026, 9, d, h, m));
const cases = [[8, 0], [9, 1], [21, 0], [21, 30], [23, 30], [0, 0], [0, 30], [12, 0], [16, 30]];
console.log("---- 触发判断（北京时间 → 要发的任务）----");
for (const [h, m] of cases) {
  console.log(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ->`, JSON.stringify(pickJobs(bj(h, m))));
}
console.log("---- 今日(2026-10-05)内容示例 ----");
console.log(buildEncourage(bj(8, 0)).content);
console.log("====");
console.log(buildMicrogoal(bj(9, 1)).content);
console.log("====");
console.log(buildIelts(bj(8, 0)).content);
console.log("==== 计划期内 2026-10-12 ====");
console.log(buildIelts(new Date(Date.UTC(2026, 9, 12, 8, 0))).content);
