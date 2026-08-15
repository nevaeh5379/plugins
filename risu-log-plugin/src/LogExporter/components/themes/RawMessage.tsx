import React from 'react';
import type { MessageProps } from '../../../types';
import { useMessageProcessor } from '../../hooks/useMessageProcessor';

/**
 * RawMessage
 *
 * Theme component that renders raw HTML chat message content directly.
 * Preserves the original DOM structure while embedding media (images as blobs)
 * and applying custom regex replacement rules.
 */
const RawMessage: React.FC<MessageProps> = (props) => {
  const {
    node,
    embedImagesAsBlob,
    color,
    imageScale,
    onRendered,
    replacementRules,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight,
  } = props;

  // We set allowHtmlRendering=true to trigger processRawHtmlContent in useMessageProcessor,
  // which preserves the original DOM hierarchy while processing replacements and image embeddings.
  const messageHtml = useMessageProcessor(
    node,
    embedImagesAsBlob,
    /* allowHtmlRendering */ true,
    color,
    imageScale,
    onRendered,
    replacementRules,
    /* imageAlign */ undefined,
    /* imageStyle */ undefined,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight
  );

  return (
    <div
      className="raw-message-wrapper"
      dangerouslySetInnerHTML={{ __html: messageHtml }}
    />
  );
};

RawMessage.displayName = 'RawMessage';

export default RawMessage;

