import React from 'react';
import type { ColorPalette } from '../../../types';

interface FooterProps {
  color: ColorPalette;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

const ModernFooter: React.FC<FooterProps> = ({ color, footerLeft, footerCenter, footerRight }) => {
  return (
    <footer style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      marginTop: '2.5em', padding: '1.2em 0',
      borderTop: `1px solid ${color.border}`,
      fontSize: '0.78em', color: color.textSecondary,
    }}>
      <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: color.nameColor, display: 'inline-block',
        }} />
        {footerLeft}
      </div>
      <div style={{ textAlign: 'center', fontWeight: 600, letterSpacing: '0.5px' }}>
        {footerCenter?.toUpperCase()}
      </div>
      <div style={{ textAlign: 'right', opacity: 0.7 }}>
        {footerRight}
      </div>
    </footer>
  );
};

export default ModernFooter;