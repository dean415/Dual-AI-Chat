import fs from 'fs';
let s = fs.readFileSync('App.tsx', 'utf8');
const startMarker = '<div className="flex items-center space-x-1';
const headerClose = '</header>';
const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf(headerClose, startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  const before = s.slice(0, startIdx);
  const after = s.slice(endIdx);
  const newBlock = `
<div className="flex items-center space-x-1 md:space-x-2 flex-wrap justify-end gap-y-2">
  <button onClick={openTeamModal}
    className="p-1.5 md:p-2 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-50 rounded-md shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
    aria-label="打开团队管理" title="打开团队管理" disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}>
    <Database size={20} />
  </button>
  <button onClick={openSettingsModal}
    className="p-1.5 md:p-2 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-50 rounded-md shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
    aria-label="打开设置" title="打开设置" disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}>
    <Settings2 size={20} />
  </button>
  <button onClick={handleClearChat}
    className="p-1.5 md:p-2 text-gray-500 hover:text-sky-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-50 rounded-md shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
    aria-label="清空会话" title="清空会话" disabled={isLoading && !cancelRequestRef.current && !failedStepInfo}>
    <RefreshCwIcon size={20} />
  </button>
</div>
`;
  s = before + newBlock + after;
  fs.writeFileSync('App.tsx', s, { encoding: 'utf8' });
  console.log('Rewrote header action block.');
} else {
  console.log('Could not locate header block, skipping.');
}
