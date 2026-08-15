import React from 'react';
import type { FooterProps } from '../../../types';

/**
 * SmartFooter - Glassmorphism card-styled footer for the "smart" theme.
 * Features a frosted glass effect with rounded top corners and subtle elevation.
 */
const SmartFooter: React.FC<FooterProps> = ({
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
    marginTop: '1.5em',
    padding: '1.2em 1.5em',
    background: color.cardBg,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '14px 14px 0 0',
    border: `1px solid ${color.border}`,
    fontSize: '0.82em',
    color: textColor,
    boxShadow: '0 -2px 16px rgba(0,0,0,0.04)',
  };

  const leftStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'left',
    fontWeight: 500,
  };

  const centerStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
    opacity: 0.8,
  };

  const rightStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'right',
    fontWeight: 500,
  };

  return (
    <footer style={footerStyle}>
      <div style={leftStyle}>{footerLeft}</div>
      <div style={centerStyle}>{footerCenter}</div>
      <div style={rightStyle}>{footerRight}</div>
    </footer>
  );
};

export { SmartFooter };
export default SmartFooter;