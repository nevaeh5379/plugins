import { useState, useCallback } from 'react';

export function useSelection<T>(items: T[]) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const handleSelectionChange = useCallback((newSelection: Set<number>) => {
    setSelectedIndices(newSelection);
  }, []);

  const handleLastSelectedIndexChange = useCallback((index: number | null) => {
    setLastSelectedIndex(index);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(items.map((_, i) => i)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
  }, []);

  const invertSelection = useCallback(() => {
    setSelectedIndices(prev => {
      const allIndices = new Set(items.map((_, i) => i));
      return new Set([...allIndices].filter(i => !prev.has(i)));
    });
  }, [items]);

  const deleteSelected = useCallback((): T[] => {
    if (selectedIndices.size === 0) return items;
    const newItems = items.filter((_, i) => !selectedIndices.has(i));
    setSelectedIndices(new Set());
    setLastSelectedIndex(null);
    return newItems;
  }, [items, selectedIndices]);

  const getFilteredItems = useCallback((): T[] => {
    if (selectedIndices.size === 0) return items;
    return items.filter((_, i) => selectedIndices.has(i));
  }, [items, selectedIndices]);

  return {
    selectedIndices,
    lastSelectedIndex,
    handleSelectionChange,
    handleLastSelectedIndexChange,
    selectAll,
    deselectAll,
    invertSelection,
    deleteSelected,
    getFilteredItems,
    hasSelection: selectedIndices.size > 0,
  };
}
