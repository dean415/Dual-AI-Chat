const fs = require('fs');
const path = require('path');
const files = ['App.tsx', path.join('components','TeamManagementModal.tsx')];
const fix = (p) => {
  try {
    let s = fs.readFileSync(p, 'utf8');
    // Replace any single-quoted Chinese placeholder starting with 未... to 未指定
    s = s.replace(/'未[^']*'/g, "'未指定'");
    // Also fix template literals fallback occurrences like || '未...'
    s = s.replace(/\|\|\s*'未[^']*'\}/g, "|| '未指定'}");
    fs.writeFileSync(p, s, { encoding: 'utf8' });
    console.log('fixed', p);
  } catch (e) { console.error('failed', p, e.message); }
};
files.forEach(fix);
