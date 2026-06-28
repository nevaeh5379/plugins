import { useState, useEffect } from 'react';

export function useWindowWidth(initialWidth = 1200): number {
  const [width, setWidth] = useState(() => window.innerWidth || initialWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);
    handleResize();

    // iframe display: none -> block transition re-measurement
    const timers = [
      setTimeout(handleResize, 50),
      setTimeout(handleResize, 150),
      setTimeout(handleResize, 300),
    ];

    return () => {
      window.removeEventListener('resize', handleResize);
      timers.forEach(clearTimeout);
    };
  }, []);

  return width;
}
