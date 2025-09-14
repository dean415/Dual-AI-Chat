import React from 'react';
import './typingCaret.css';

interface TypingCaretProps {
  hidden?: boolean;        // hide without unmounting (keeps layout stable)
  className?: string;      // extra classes
  title?: string;          // optional tooltip
  style?: React.CSSProperties; // allow absolute positioning when needed
}

const TypingCaret: React.FC<TypingCaretProps> = ({ hidden, className, title, style }) => {
  const cls = `typing-caret${hidden ? ' typing-caret--hidden' : ''}${className ? ' ' + className : ''}`;
  return (
    <span className={cls} aria-hidden="true" title={title} style={style} />
  );
};

export default TypingCaret;
