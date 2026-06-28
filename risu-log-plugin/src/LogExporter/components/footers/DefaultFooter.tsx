import React from 'react';
import type { FooterProps } from '../../../types';

const DefaultFooter: React.FC<FooterProps> = ({ color, footerLeft, footerCenter, footerRight }) => {
  return (
    <footer style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      textAlign: 'center',
      marginTop: '2.5em', paddingTop: '1.2em',
      borderTop: `1px solid ${color.border}`,
      fontSize: '0.78em', color: color.textSecondary || color.text,
      opacity: 0.7,
    }}>
      <div style={{ flex: 1, textAlign: 'left' }}>{footerLeft}</div>
      <div style={{ flex: 1, textAlign: 'center' }}>{footerCenter}</div>
      <div style={{ flex: 1, textAlign: 'right' }}>{footerRight}</div>
    </footer>
  );
};

export default DefaultFooter;