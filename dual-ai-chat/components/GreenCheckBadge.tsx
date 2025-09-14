import React, { useEffect, useState } from 'react';

const GreenCheckBadge: React.FC<{ size?: number; className?: string; title?: string }> = ({ size = 16, className = '', title }) => {
  const s = size;
  const [theme, setTheme] = useState<string | null>(() => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null));
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const mo = new MutationObserver(muts => muts.forEach(m => {
      if (m.type === 'attributes' && m.attributeName === 'data-theme') setTheme(el.getAttribute('data-theme'));
    }));
    mo.observe(el, { attributes: true });
    return () => mo.disconnect();
  }, []);
  const circleFill = (theme === 'dark' || theme === 'claude') ? '#C46345' : '#36D399';
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={!title}
      role={title ? 'img' : 'presentation'}
    >
      {title && <title>{title}</title>}
      <circle cx="8" cy="8" r="7" fill={circleFill} />
      <path d="M5 8.2 7.3 10.5 11.2 6.6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default GreenCheckBadge;
