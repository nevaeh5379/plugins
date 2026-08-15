import { useState, useCallback, useMemo } from 'react';
import type { ProgressState } from './types';
import { INITIAL_PROGRESS } from './types';

/**
 * Lifecycle status of an async progress operation.
 */
export type ProgressStatus = 'idle' | 'running' | 'completed' | 'error';

/**
 * Extended progress state containing optional stage and status metadata.
 */
export interface ExtendedProgressState extends ProgressState {
  /** Optional high-level stage or phase name (e.g., 'capturing', 'rendering', 'uploading') */
  stage?: string;
  /** Current operational status */
  status?: ProgressStatus;
}

/**
 * Payload for updating progress state.
 * Supports partial updates of counts, messages, stages, or statuses.
 */
export interface ProgressUpdate {
  /** Current progress count/step */
  current?: number;
  /** Total progress count/steps (optional, sets or updates total) */
  total?: number;
  /** Current progress message */
  message?: string;
  /** High-level stage or phase name */
  stage?: string;
  /** Explicit operational status */
  status?: ProgressStatus;
}

/**
 * Options for starting a progress tracking session.
 */
export interface StartProgressOptions {
  /** Total count or steps (0 for indeterminate / spinner) */
  total?: number;
  /** Optional initial stage identifier */
  stage?: string;
}

/**
 * Return type interface for the `useProgress` hook.
 */
export interface UseProgressReturn {
  /** Current core progress state */
  progress: ExtendedProgressState;
  /** Percentage completed (0 - 100). Returns 0 for indeterminate or non-positive total */
  percentage: number;
  /** Current operational status */
  status: ProgressStatus;
  /** Current active stage identifier or empty string */
  stage: string;
  /** Whether a progress operation is currently in progress */
  isActive: boolean;
  /** Whether the progress operation is indeterminate (active without a known total) */
  isIndeterminate: boolean;
  /** Whether all items have completed (current >= total && total > 0) */
  isComplete: boolean;

  /** Start progress with a message and an optional total or options object */
  startProgress: (message: string, totalOrOptions?: number | StartProgressOptions) => void;
  /** Update progress using an update object, a message string shorthand, or an updater function */
  updateProgress: (update: ProgressUpdate | string | ((prev: ExtendedProgressState) => ExtendedProgressState)) => void;
  /** Increment progress count by a given step (default: 1) with an optional message */
  incrementProgress: (step?: number, message?: string) => void;
  /** Transition to a new stage or phase with an optional message */
  setStage: (stage: string, message?: string) => void;
  /** Mark progress as completed with an optional final message */
  completeProgress: (message?: string) => void;
  /** Mark progress as failed with an error message */
  failProgress: (errorMessage: string) => void;
  /** End progress tracking and reset state to initial values */
  endProgress: () => void;
  /** Reset progress state back to initial values (alias for endProgress) */
  resetProgress: () => void;
  /** Direct state setter for custom state transitions */
  setProgress: React.Dispatch<React.SetStateAction<ExtendedProgressState>>;
}

const DEFAULT_EXTENDED_PROGRESS: ExtendedProgressState = {
  ...INITIAL_PROGRESS,
  stage: '',
  status: 'idle',
};

/**
 * Custom React hook for managing async task progress, stages, and status indicators.
 *
 * Provides reactive progress tracking with backward-compatible primitives
 * (`progress`, `startProgress`, `updateProgress`, `endProgress`) along with rich
 * computed properties (`percentage`, `status`, `stage`, `isActive`, `isIndeterminate`, `isComplete`)
 * and granular transition helpers (`incrementProgress`, `setStage`, `completeProgress`, `failProgress`).
 */
export function useProgress(): UseProgressReturn {
  const [progress, setProgress] = useState<ExtendedProgressState>(DEFAULT_EXTENDED_PROGRESS);

  /**
   * Initiates a new progress operation.
   *
   * @param message Initial progress message to display
   * @param totalOrOptions Total count of items/steps, or an options object with total and stage
   */
  const startProgress = useCallback((message: string, totalOrOptions?: number | StartProgressOptions) => {
    let total = 0;
    let stage = '';

    if (typeof totalOrOptions === 'number') {
      total = Math.max(0, Number.isFinite(totalOrOptions) ? totalOrOptions : 0);
    } else if (totalOrOptions && typeof totalOrOptions === 'object') {
      total = Math.max(0, Number.isFinite(totalOrOptions.total) ? (totalOrOptions.total ?? 0) : 0);
      stage = totalOrOptions.stage ?? '';
    }

    setProgress({
      active: true,
      message,
      current: 0,
      total,
      stage,
      status: 'running',
    });
  }, []);

  /**
   * Updates the progress state with partial values, a new message string, or an updater function.
   *
   * @param update ProgressUpdate object, string message shorthand, or updater callback
   */
  const updateProgress = useCallback(
    (update: ProgressUpdate | string | ((prev: ExtendedProgressState) => ExtendedProgressState)) => {
      setProgress(prev => {
        if (typeof update === 'string') {
          return { ...prev, message: update };
        }

        if (typeof update === 'function') {
          return update(prev);
        }

        const nextCurrent =
          update.current !== undefined
            ? Math.max(0, Number.isFinite(update.current) ? update.current : 0)
            : prev.current;

        const nextTotal =
          update.total !== undefined
            ? Math.max(0, Number.isFinite(update.total) ? update.total : 0)
            : prev.total;

        return {
          ...prev,
          ...update,
          current: nextCurrent,
          total: nextTotal,
        };
      });
    },
    []
  );

  /**
   * Increments current progress by a specific step count (default 1) and optionally updates the message.
   *
   * @param step Number of items/steps completed in this tick (default: 1)
   * @param message Optional progress message update
   */
  const incrementProgress = useCallback((step = 1, message?: string) => {
    const validStep = Number.isFinite(step) ? step : 1;
    setProgress(prev => {
      const nextCurrent = Math.max(0, prev.current + validStep);
      return {
        ...prev,
        current: nextCurrent,
        ...(message !== undefined ? { message } : {}),
      };
    });
  }, []);

  /**
   * Transitions to a new stage or phase with an optional message.
   *
   * @param stage Name or identifier of the new stage
   * @param message Optional progress message update
   */
  const setStage = useCallback((stage: string, message?: string) => {
    setProgress(prev => ({
      ...prev,
      stage,
      ...(message !== undefined ? { message } : {}),
    }));
  }, []);

  /**
   * Marks progress as completed, setting current = total (if total > 0) and status to 'completed'.
   *
   * @param message Optional completion message to display
   */
  const completeProgress = useCallback((message?: string) => {
    setProgress(prev => ({
      ...prev,
      current: prev.total > 0 ? prev.total : prev.current,
      status: 'completed',
      ...(message !== undefined ? { message } : {}),
    }));
  }, []);

  /**
   * Marks progress as failed with an error status and message.
   *
   * @param errorMessage Error message describing the failure
   */
  const failProgress = useCallback((errorMessage: string) => {
    setProgress(prev => ({
      ...prev,
      status: 'error',
      message: errorMessage,
    }));
  }, []);

  /**
   * Ends progress tracking and resets all state values back to initial defaults.
   */
  const endProgress = useCallback(() => {
    setProgress(DEFAULT_EXTENDED_PROGRESS);
  }, []);

  /**
   * Alias for endProgress to clearly signal a complete state reset.
   */
  const resetProgress = useCallback(() => {
    setProgress(DEFAULT_EXTENDED_PROGRESS);
  }, []);

  // Computed properties
  const isActive = progress.active;
  const stage = progress.stage ?? '';

  const percentage = useMemo(() => {
    if (!progress.active || progress.total <= 0) return 0;
    const rawPercent = (progress.current / progress.total) * 100;
    return Math.min(100, Math.max(0, Math.round(rawPercent)));
  }, [progress]);

  const isIndeterminate = progress.active && progress.total <= 0;
  const isComplete = progress.active && progress.total > 0 && progress.current >= progress.total;

  const status: ProgressStatus = useMemo(() => {
    if (progress.status) return progress.status;
    if (!progress.active) return 'idle';
    if (progress.total > 0 && progress.current >= progress.total) return 'completed';
    return 'running';
  }, [progress]);

  return {
    progress,
    percentage,
    status,
    stage,
    isActive,
    isIndeterminate,
    isComplete,
    startProgress,
    updateProgress,
    incrementProgress,
    setStage,
    completeProgress,
    failProgress,
    endProgress,
    resetProgress,
    setProgress,
  };
}

