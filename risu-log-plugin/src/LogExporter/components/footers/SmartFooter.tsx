import React from 'react';
import type { ColorPalette } from '../../../types';

interface FooterProps {
  color: ColorPalette;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

const SmartFooter: React.FC<FooterProps> = ({ color, footerLeft, footerCenter, footerRight }) => {
  return (
    <footer style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: '1.5em', padding: '1.2em 1.5em',
      background: color.cardBg,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '14px 14px 0 0',
      border: `1px solid ${color.border}`,
      fontSize: '0.82em', color: color.textSecondary,
      boxShadow: '0 -2px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>{footerLeft}</div>
      <div style={{ flex: 1, textAlign: 'center', opacity: 0.8 }}>{footerCenter}</div>
      <div style={{ flex: 1, textAlign: 'right', fontWeight: 500 }}>{footerRight}</div>
    </footer>
  );
};

export default SmartFooter;