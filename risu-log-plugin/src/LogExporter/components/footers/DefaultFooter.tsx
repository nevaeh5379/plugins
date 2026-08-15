import React from 'react';
import type { FooterProps } from '../../../types';

/**
 * DefaultFooter - Standard footer layout for basic/default themes.
 * Features a single top separator border with a 3-column distributed layout.
 */
const DefaultFooter: React.FC<FooterProps> = ({
  color,
  footerLeft,
  footerCenter,
  footerRight,
}) => {
  const textColor = color.textSecondary || color.text;

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '2.5em',
    paddingTop: '1.2em',
    borderTop: `1px solid ${color.border}`,
    fontSize: '0.78em',
    color: textColor,
    opacity: 0.7,
  };

  const leftStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'left',
  };

  const centerStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
  };

  const rightStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'right',
  };

  return (
    <footer style={footerStyle}>
      <div style={leftStyle}>{footerLeft}</div>
      <div style={centerStyle}>{footerCenter}</div>
      <div style={rightStyle}>{footerRight}</div>
    </footer>
  );
};

export { DefaultFooter };
export default DefaultFooter;