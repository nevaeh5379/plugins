
import { createRoot } from 'react-dom/client';
import LogContainer from '../components/LogContainer';
import type { LogContainerProps } from '../../types';
import { createOffscreenContainer } from '../utils/domUtils';

export const getLogHtml = (props: Omit<LogContainerProps, 'onReady'>): Promise<string> => {
  return new Promise((resolve) => {
    const { container, remove } = createOffscreenContainer();
    const root = createRoot(container);

    const onReady = () => {
      const html = container.innerHTML;
      root.unmount();
      remove();
      resolve(html);
    };

    root.render(
      <LogContainer {...props} onReady={onReady} />
    );
  });
};


