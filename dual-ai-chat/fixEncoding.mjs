import fs from 'fs';
import path from 'path';
const files = ['App.tsx', path.join('components','TeamManagementModal.tsx')];
const fix = (p) => {
  try {
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/'未[^']*'/g, "'未指定'");
    s = s.replace(/\|\|\s*'未[^']*'\}/g, "|| '未指定'}");
    fs.writeFileSync(p, s, { encoding: 'utf8' });
    console.log('fixed', p);
  } catch (e) { console.error('failed', p, e.message); }
};
files.forEach(fix);
