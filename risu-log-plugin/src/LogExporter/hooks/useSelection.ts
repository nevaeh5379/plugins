import { useState, useCallback } from 'react';

/**
 * Pure helper to compute a new Set with an inclusive range of indices [start, end] added.
 *
 * @param currentIndices - The existing set of selected indices.
 * @param startIndex - The starting index of the range.
 * @param endIndex - The ending index of the range.
 * @returns A new Set with the range indices added.
 */
export function addRangeToIndices(
  currentIndices: ReadonlySet<number>,
  startIndex: number,
  endIndex: number,
): Set<number> {
  const result = new Set(currentIndices);
  const min = Math.min(startIndex, endIndex);
  const max = Math.max(startIndex, endIndex);
  for (let i = min; i <= max; i++) {
    result.add(i);
  }
  return result;
}

/**
 * Pure helper to compute a new Set with a single index toggled (added if absent, removed if present).
 *
 * @param currentIndices - The existing set of selected indices.
 * @param index - The index to toggle.
 * @returns A new Set with the index toggled.
 */
export function toggleIndexInIndices(
  currentIndices: ReadonlySet<number>,
  index: number,
): Set<number> {
  const result = new Set(currentIndices);
  if (result.has(index)) {
    result.delete(index);
  } else {
    result.add(index);
  }
  return result;
}

/**
 * Return interface for the `useSelection` hook.
 */
export interface UseSelectionResult<T> {
  /** The set of currently selected indices. */
  selectedIndices: Set<number>;
  /** The index of the most recently clicked/selected item, or null if none. */
  lastSelectedIndex: number | null;
  /** Whether at least one item is currently selected. */
  hasSelection: boolean;
  /** The total number of currently selected items. */
  selectedCount: number;
  /** Checks whether a specific index is selected. */
  isSelected: (index: number) => boolean;
  /** Direct setter for the selected indices set. */
  handleSelectionChange: (newSelection: Set<number>) => void;
  /** Direct setter for the last selected index. */
  handleLastSelectedIndexChange: (index: number | null) => void;
  /** Toggles selection for an index, supporting Shift+Click range selection. */
  toggleSelection: (index: number, shiftKey?: boolean) => void;
  /** Selects a contiguous range of indices [startIndex, endIndex]. */
  selectRange: (startIndex: number, endIndex: number) => void;
  /** Selects all items in the list. */
  selectAll: () => void;
  /** Deselects all items and resets the last selected index. */
  deselectAll: () => void;
  /** Inverts the current selection across all items. */
  invertSelection: () => void;
  /** Removes selected items from the provided array, clears selection, and returns the remaining items. */
  deleteSelected: () => T[];
  /** Returns the items that are currently selected, or all items if none are selected. */
  getFilteredItems: () => T[];
}

/**
 * Custom hook to manage item selection state, supporting single select,
 * multi-select, shift-click range selection, inversion, and batch operations.
 *
 * @template T - The type of items being managed.
 * @param items - The array of items available for selection.
 * @returns An object containing selection state and helper callbacks.
 */
export function useSelection<T>(items: T[] = []): UseSelectionResult<T> {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSelectionChange = useCallback((newSelection: Set<number>) => {
    setSelectedIndices(newSelection);
  }, []);

  const handleLastSelectedIndexChange = useCallback((index: number | null) => {
    setLastSelectedIndex(index);
  }, []);

  const isSelected = useCallback(
    (index: number): boolean => selectedIndices.has(index),
    [selectedIndices],
  );

  const toggleSelection = useCallback(
    (index: number, shiftKey: boolean = false) => {
      setSelectedIndices(prev => {
        if (shiftKey && lastSelectedIndex !== null) {
          return addRangeToIndices(prev, lastSelectedIndex, index);
        }
        return toggleIndexInIndices(prev, index);
      });
      setLastSelectedIndex(index);
    },
    [lastSelectedIndex],
  );

  const selectRange = useCallback((startIndex: number, endIndex: number) => {
    setSelectedIndices(prev => addRangeToIndices(prev, startIndex, endIndex));
    setLastSelectedIndex(endIndex);
  }, []);

  const selectAll = useCallback(() => {
    const allIndices = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      allIndices.add(i);
    }
    setSelectedIndices(allIndices);
  }, [items.length]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
  }, []);

  const invertSelection = useCallback(() => {
    setSelectedIndices(prev => {
      const inverted = new Set<number>();
      for (let i = 0; i < items.length; i++) {
        if (!prev.has(i)) {
          inverted.add(i);
        }
      }
      return inverted;
    });
  }, [items.length]);

  const deleteSelected = useCallback((): T[] => {
    if (selectedIndices.size === 0) return items;
    const remainingItems = items.filter((_, i) => !selectedIndices.has(i));
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
    return remainingItems;
  }, [items, selectedIndices]);

  const getFilteredItems = useCallback((): T[] => {
    if (selectedIndices.size === 0) return items;
    return items.filter((_, i) => selectedIndices.has(i));
  }, [items, selectedIndices]);

  return {
    selectedIndices,
    lastSelectedIndex,
    hasSelection: selectedIndices.size > 0,
    selectedCount: selectedIndices.size,
    isSelected,
    handleSelectionChange,
    handleLastSelectedIndexChange,
    toggleSelection,
    selectRange,
    selectAll,
    deselectAll,
    invertSelection,
    deleteSelected,
    getFilteredItems,
  };
}
