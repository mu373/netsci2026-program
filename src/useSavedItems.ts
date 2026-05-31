import { useCallback, useMemo, useState } from "react";
import { itemAliases, itemById } from "./data";
import type { SavedItem } from "./types";

const SAVED_KEY = "netsci2026.savedItems";

function snapshotForItem(itemId: string): SavedItem["snapshot"] | undefined {
  const item = itemById.get(itemId);
  if (!item) return undefined;
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceKey: item.sourceKey,
    fingerprint: item.fingerprint,
    title: item.title,
    kind: item.kind,
  };
}

function migrateSavedItems(items: SavedItem[]) {
  const migrated = [...items];
  const seen = new Set(migrated.map((item) => item.itemId));

  for (const item of items) {
    const alias = itemAliases[item.itemId];
    if (!alias || seen.has(alias)) continue;
    migrated.push({
      ...item,
      itemId: alias,
      migratedFrom: item.itemId,
      snapshot: snapshotForItem(alias),
    });
    seen.add(alias);
  }

  return migrated;
}

function readSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const migrated = migrateSavedItems(parsed);
    if (migrated.length !== parsed.length) writeSaved(migrated);
    return migrated;
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
          snapshot: snapshotForItem(itemId),
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
