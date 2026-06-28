import { useState, useCallback } from 'react';
import type { ProgressState } from './types';
import { INITIAL_PROGRESS } from './types';

export function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);

  const startProgress = useCallback((message: string, total = 0) => {
    setProgress({ active: true, message, current: 0, total });
  }, []);

  const updateProgress = useCallback((update: { current?: number; message?: string }) => {
    setProgress(prev => ({ ...prev, ...update }));
  }, []);

  const endProgress = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
  }, []);

  return {
    progress,
    startProgress,
    updateProgress,
    endProgress,
  };
}
