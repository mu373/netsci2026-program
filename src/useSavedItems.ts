import { useCallback, useMemo, useState } from "react";
import type { SavedItem } from "./types";

const SAVED_KEY = "netsci2026.savedItems";

function readSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSaved(items: SavedItem[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(items));
}

export function useSavedItems() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(readSaved);

  const persist = useCallback((next: SavedItem[]) => {
    setSavedItems(next);
    writeSaved(next);
  }, []);

  const savedById = useMemo(() => new Map(savedItems.map((item) => [item.itemId, item])), [savedItems]);

  const saveItem = useCallback(
    (itemId: string) => {
      if (savedById.has(itemId)) return;
      persist([
        ...savedItems,
        {
          itemId,
          savedAt: new Date().toISOString(),
          status: "interested",
        },
      ]);
    },
    [persist, savedById, savedItems],
  );

  const unsaveItem = useCallback(
    (itemId: string) => {
      persist(savedItems.filter((item) => item.itemId !== itemId));
    },
    [persist, savedItems],
  );

  const updateSavedItem = useCallback(
    (itemId: string, patch: Partial<SavedItem>) => {
      persist(savedItems.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item)));
    },
    [persist, savedItems],
  );

  const toggleSaved = useCallback(
    (itemId: string) => {
      if (savedById.has(itemId)) unsaveItem(itemId);
      else saveItem(itemId);
    },
    [saveItem, savedById, unsaveItem],
  );

  return {
    savedItems,
    savedById,
    isSaved: (itemId: string) => savedById.has(itemId),
    saveItem,
    unsaveItem,
    updateSavedItem,
    toggleSaved,
    clearSavedItems: () => persist([]),
  };
}
