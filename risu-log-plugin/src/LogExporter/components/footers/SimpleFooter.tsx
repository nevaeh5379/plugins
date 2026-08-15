import React from 'react';
import type { FooterProps } from '../../../types';

/**
 * SimpleFooter - Minimalist inline footer with dashed separator and monospace styling.
 */
const SimpleFooter: React.FC<FooterProps> = ({
  color,
  footerLeft,
  footerCenter,
  footerRight,
}) => {
  const textColor = color.textSecondary || color.text;

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '1.5em',
    paddingTop: '0.8em',
    borderTop: `1px dashed ${color.border}`,
    fontSize: '0.72em',
    color: textColor,
    opacity: 0.5,
    fontFamily: 'monospace',
  };

  return (
    <footer style={footerStyle}>
      {footerLeft ? <span>{footerLeft}</span> : null}
      {footerCenter ? <span>{footerCenter}</span> : null}
      {footerRight ? <span>{footerRight}</span> : null}
    </footer>
  );
};

export { SimpleFooter };
export default SimpleFooter;