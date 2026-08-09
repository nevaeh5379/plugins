
import { createRoot } from 'react-dom/client';
import LogContainer from '../components/LogContainer';
import type { LogContainerProps } from '../../types';
import { createOffscreenContainer } from '../utils/domUtils';

export const getLogHtml = (props: Omit<LogContainerProps, 'onReady'>): Promise<string> => {
  return new Promise((resolve) => {
    const { container, remove } = createOffscreenContainer();
    const root = createRoot(container);
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      const html = container.innerHTML;
      root.unmount();
      remove();
      resolve(html);
    };

    const onReady = () => {
      Promise.resolve().then(finish);
    };

    root.render(
      <LogContainer {...props} onReady={onReady} />
    );

    // Safety timeout: if onReady never fires, resolve with current HTML after 15s.
    setTimeout(finish, 15000);
  });
};

