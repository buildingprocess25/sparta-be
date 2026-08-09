const fs = require('fs');
const log = fs.readFileSync('C:/Users/tezow/.gemini/antigravity-ide/brain/382e52f3-13bb-4ec4-83a0-21b730f885bf/.system_generated/logs/transcript_full.jsonl', 'utf-8');
const lines = log.split('\n');
let inserts = [];
for (const line of lines) {
  try {
    const p = JSON.parse(line);
    if (p.content && p.content.includes('[INSERT] Gantt')) {
      const matches = p.content.matchAll(/\[INSERT\] Gantt (\d+) \| "([^"]+)"/g);
      for (const m of matches) {
        if (!m[2].startsWith('[IL]')) {
          inserts.push({ ganttId: m[1], name: m[2] });
        }
      }
    }
  } catch(e){}
}
console.log('Found inserts:', inserts.length);
if (inserts.length > 0) console.log(inserts.slice(0, 10));
