import React from 'react';
import type { FooterProps } from '../../../types';

const SimpleFooter: React.FC<FooterProps> = ({ color, footerLeft, footerCenter, footerRight }) => {
  return (
    <footer style={{
      display: 'flex', justifyContent: 'center', gap: '16px',
      marginTop: '1.5em', paddingTop: '0.8em',
      borderTop: `1px dashed ${color.border}`,
      fontSize: '0.72em', color: color.textSecondary || color.text,
      opacity: 0.5, fontFamily: 'monospace',
    }}>
      {footerLeft && <span>{footerLeft}</span>}
      {footerCenter && <span>{footerCenter}</span>}
      {footerRight && <span>{footerRight}</span>}
    </footer>
  );
};

export default SimpleFooter;