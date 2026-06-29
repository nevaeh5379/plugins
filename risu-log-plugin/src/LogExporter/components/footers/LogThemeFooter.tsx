import React from 'react';
import type { FooterProps } from '../../../types';

const LogThemeFooter: React.FC<FooterProps> = ({ color, footerLeft, footerCenter, footerRight }) => {
  return (
    <footer style={{
      marginTop: '24px',
      padding: '16px 24px',
      borderTop: `1px solid ${color.border}44`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '0.85em',
    }}>

      {(footerLeft || footerCenter || footerRight) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          color: color.textSecondary,
          opacity: 0.8, 
          fontSize: '0.95em' 
        }}>
          <span>{footerLeft}</span>
          <span style={{ fontWeight: 500 }}>{footerCenter}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </footer>
  );
};

export default LogThemeFooter;
