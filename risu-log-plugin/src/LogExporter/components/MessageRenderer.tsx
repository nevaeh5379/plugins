
import React from 'react';
import type { MessageProps, ThemeKey } from '../../types';
import BasicMessage from './themes/BasicMessage';
import CustomMessage from './themes/CustomMessage';
import ModernMessage from './themes/ModernMessage';
import SmartMessage from './themes/SmartMessage';
import SimpleMessage from './themes/SimpleMessage';
import LogMessage from './themes/LogMessage';
import RawMessage from './themes/RawMessage';

const themeMap: Record<ThemeKey, React.FC<MessageProps>> = {
  basic: BasicMessage,
  custom: CustomMessage,
  modern: ModernMessage,
  smart: SmartMessage,
  simple: SimpleMessage,
  log: LogMessage,
  raw: RawMessage,
};

const MessageRenderer: React.FC<MessageProps> = (props) => {
  const { themeKey, isSelected, onSelect, index, isEditable } = props;
  const MessageComponent = themeMap[themeKey] || BasicMessage;

  const handleContainerClick = (e: React.MouseEvent) => {
    if (onSelect) {
      onSelect(index, e);
    }
  };

  // When the checkbox itself is clicked, we handle the selection
  // and stop it from bubbling to the container to avoid a double-trigger.
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(index, e);
    }
  };

  if (!isEditable) {
    return <MessageComponent {...props} onRendered={props.onRendered} />;
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(0, 123, 255, 0.2)' : undefined,
        borderRadius: '4px',
      }}
      onClick={handleContainerClick}
    >
      <input
        type="checkbox"
        checked={isSelected || false}
        onClick={handleCheckboxClick}
        readOnly // State is controlled by parent
        style={{ margin: '0 10px' }}
      />
      <div style={{ flex: 1 }}>
        <MessageComponent {...props} onRendered={props.onRendered} />
      </div>
    </div>
  );
};

// Custom comparison function to prevent redundant rendering of logs
const arePropsEqual = (prevProps: MessageProps, nextProps: MessageProps) => {
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.themeKey !== nextProps.themeKey) return false;
  if (prevProps.showAvatar !== nextProps.showAvatar) return false;
  if (prevProps.showBubble !== nextProps.showBubble) return false;
  if (prevProps.isEditable !== nextProps.isEditable) return false;
  if (prevProps.fontSize !== nextProps.fontSize) return false;
  if (prevProps.imageScale !== nextProps.imageScale) return false;
  if (prevProps.imageAlign !== nextProps.imageAlign) return false;
  if (prevProps.imageStyle !== nextProps.imageStyle) return false;
  if (prevProps.imageCropActive !== nextProps.imageCropActive) return false;
  if (prevProps.imageCropAspectRatio !== nextProps.imageCropAspectRatio) return false;
  if (prevProps.imageCropVAlign !== nextProps.imageCropVAlign) return false;
  if (prevProps.imageCropHAlign !== nextProps.imageCropHAlign) return false;
  if (prevProps.imageCropHeight !== nextProps.imageCropHeight) return false;
  if (prevProps.isForExport !== nextProps.isForExport) return false;
  if (prevProps.isForArca !== nextProps.isForArca) return false;
  if (prevProps.embedImagesAsBlob !== nextProps.embedImagesAsBlob) return false;
  if (prevProps.allowHtmlRendering !== nextProps.allowHtmlRendering) return false;
  if (prevProps.charInfoName !== nextProps.charInfoName) return false;
  if (prevProps.node !== nextProps.node) return false;

  // Safe checks for objects via JSON stringification to handle reference changes
  if (JSON.stringify(prevProps.color) !== JSON.stringify(nextProps.color)) return false;
  if (JSON.stringify(prevProps.globalSettings) !== JSON.stringify(nextProps.globalSettings)) return false;
  if (JSON.stringify(prevProps.replacementRules) !== JSON.stringify(nextProps.replacementRules)) return false;

  // Custom Map comparison for avatar mappings
  if (prevProps.avatarMap !== nextProps.avatarMap) {
    if (prevProps.avatarMap.size !== nextProps.avatarMap.size) return false;
    for (const [key, val] of prevProps.avatarMap.entries()) {
      if (nextProps.avatarMap.get(key) !== val) return false;
    }
  }

  return true;
};

export default React.memo(MessageRenderer, arePropsEqual);
