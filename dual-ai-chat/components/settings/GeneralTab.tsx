import React from 'react';

interface Props {
  isLoading?: boolean;
  fontSizeScale: number;
  onFontSizeScaleChange: (scale: number) => void;
}

const FONT_SIZE_OPTIONS = [
  { label: '小', value: 0.875 },
  { label: '中', value: 1.0 },
  { label: '大', value: 1.125 },
  { label: '特大', value: 1.25 },
];

const GeneralTab: React.FC<Props> = ({ isLoading, fontSizeScale, onFontSizeScaleChange }) => {
  return (
    <section aria-labelledby="font-size-settings-heading" className="space-y-2">
      <h3 id="font-size-settings-heading" className="text-lg font-medium text-gray-800 mb-2 border-b pb-2">文字大小</h3>
      <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700 font-medium whitespace-nowrap">界面文字:</label>
          <div className="flex flex-wrap gap-2">
            {FONT_SIZE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => !isLoading && onFontSizeScaleChange(option.value)}
                disabled={!!isLoading}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 ${
                  fontSizeScale === option.value
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed'
                }`}
                aria-pressed={fontSizeScale === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
      </div>
    </section>
  );
};

export default GeneralTab;

