const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const roots = process.argv.slice(2);
function check(target) {
  if (!fs.existsSync(target)) return;
  if (fs.statSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) check(path.join(target, entry));
  } else if (/\.(c?js)$/.test(target)) {
    const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) { console.error(result.stderr); process.exitCode = 1; }
  }
}
for (const root of roots.length ? roots : ['index.js', 'src', '__tests__', 'tests/integration', 'scripts']) check(root);
if (!process.exitCode) console.log('Verificação sintática JavaScript aprovada.');
