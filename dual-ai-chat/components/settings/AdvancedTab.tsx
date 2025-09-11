import React from 'react';

const AdvancedTab: React.FC = () => {
  return (
    <section className="space-y-2" aria-labelledby="advanced-settings-heading">
      <h3 id="advanced-settings-heading" className="text-lg font-medium text-gray-800 mb-2 border-b pb-2">高级设置</h3>
      <p className="text-sm text-gray-600">暂无设置，后续将提供更多高级选项。</p>
    </section>
  );
};

export default AdvancedTab;

