import React from 'react';
import type { FooterProps } from '../../../types';

/**
 * LogThemeFooter - Terminal/CLI styled footer for code/log themes.
 * Emulates a monospace console terminal prompt with system status and metadata.
 */
const LogThemeFooter: React.FC<FooterProps> = ({
  color,
  footerLeft,
  footerCenter,
  footerRight,
}) => {
  const hasMetadata = Boolean(footerLeft || footerCenter || footerRight);

  const footerStyle: React.CSSProperties = {
    marginTop: '2em',
    padding: '1em',
    backgroundColor: '#1e1e1e',
    color: '#6a9955',
    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
    fontSize: '0.85em',
    borderLeft: `4px solid ${color.nameColor}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const systemPrefixStyle: React.CSSProperties = {
    color: '#569cd6',
  };

  const metadataRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    opacity: 0.7,
    marginTop: '0.5em',
    fontSize: '0.9em',
  };

  return (
    <footer style={footerStyle}>
      <div>
        <span style={systemPrefixStyle}>&gt; SYSTEM:</span> End of transmission.
      </div>
      {hasMetadata && (
        <div style={metadataRowStyle}>
          <span>{footerLeft}</span>
          <span>{footerCenter}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </footer>
  );
};

export { LogThemeFooter };
export default LogThemeFooter;
