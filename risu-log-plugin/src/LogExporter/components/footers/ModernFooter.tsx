import React from 'react';
import type { FooterProps } from '../../../types';

/**
 * ModernFooter - Modern minimalist footer featuring a 3-column CSS Grid,
 * an accent color indicator dot, and uppercase tracking for the center label.
 */
const ModernFooter: React.FC<FooterProps> = ({
  color,
  footerLeft,
  footerCenter,
  footerRight,
}) => {
  const textColor = color.textSecondary || color.text;

  const footerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    marginTop: '2.5em',
    padding: '1.2em 0',
    borderTop: `1px solid ${color.border}`,
    fontSize: '0.78em',
    color: textColor,
  };

  const leftStyle: React.CSSProperties = {
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  };

  const dotStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: color.nameColor,
    display: 'inline-block',
    flexShrink: 0,
  };

  const centerStyle: React.CSSProperties = {
    textAlign: 'center',
    fontWeight: 600,
    letterSpacing: '0.5px',
  };

  const rightStyle: React.CSSProperties = {
    textAlign: 'right',
    opacity: 0.7,
  };

  return (
    <footer style={footerStyle}>
      <div style={leftStyle}>
        {footerLeft ? (
          <>
            <span style={dotStyle} aria-hidden="true" />
            <span>{footerLeft}</span>
          </>
        ) : null}
      </div>
      <div style={centerStyle}>
        {footerCenter ? footerCenter.toUpperCase() : null}
      </div>
      <div style={rightStyle}>
        {footerRight}
      </div>
    </footer>
  );
};

export { ModernFooter };
export default ModernFooter;