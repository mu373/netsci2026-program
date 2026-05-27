import { useEffect, useRef } from "react";
import { openItem } from "../lib/navigation";
import { displayTitle, timeRange, titleCase } from "../lib/programHelpers";
import type { SortDir, SortKey } from "../lib/programHelpers";
import { useIsMobile } from "../hooks/useIsMobile";
import type { ProgramItem, SavedItem } from "../types";
import { SaveButton } from "./SaveButton";

export function ItemsTable({
  rows,
  showScore,
  savedById,
  onToggleSaved,
  sortKey,
  sortDir,
  onSortChange,
  activeItemId,
}: {
  rows: { item: ProgramItem; score: number }[];
  showScore: boolean;
  savedById: Map<string, SavedItem>;
  onToggleSaved: (id: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey) => void;
  activeItemId?: string | null;
}) {
  const isMobile = useIsMobile();
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  const activeCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
    activeCardRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeItemId]);

  if (isMobile) {
    return (
      <div className="cardList">
        {rows.map(({ item, score }) => (
          <button
            key={item.id}
            ref={item.id === activeItemId ? activeCardRef : undefined}
            className={item.id === activeItemId ? "itemCard active" : "itemCard"}
            onClick={() => openItem(item.id)}
          >
            <div className="itemCardTop">
              <span className={`kindTag k-${item.kind}`}>{titleCase(item.kind)}</span>
              <span
                className="cardSave"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <SaveButton
                  itemId={item.id}
                  saved={savedById.has(item.id)}
                  onToggle={onToggleSaved}
                />
              </span>
            </div>
            <div className="itemCardTitle">{displayTitle(item)}</div>
            {(item.presenter || item.authors) && (
              <div className="itemCardPresenter">{item.presenter || item.authors}</div>
            )}
            <div className="itemCardMeta">
              {[item.dayLabel, timeRange(item), item.room, item.posterNum ? `P${item.posterNum}` : ""]
                .filter(Boolean)
                .join(" · ")}
              {showScore && <span className="cardScore">{score.toFixed(2)}</span>}
            </div>
          </button>
        ))}
      </div>
    );
  }

  function SortHeader({ field, label }: { field: SortKey; label: string }) {
    const active = sortKey === field;
    return (
      <th
        className={active ? "sortable active" : "sortable"}
        onClick={() => onSortChange(field)}
      >
        {label}
        {active && <span className="sortArrow">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </th>
    );
  }

  return (
    <div className="tableWrap">
      <table className="progTable">
        <thead>
          <tr>
            <th className="colSave" />
            <SortHeader field="kind" label="Kind" />
            <SortHeader field="title" label="Title" />
            <SortHeader field="presenter" label="Presenter" />
            <SortHeader field="day" label="Day" />
            <SortHeader field="time" label="Time" />
            <SortHeader field="room" label="Room" />
            {showScore && <SortHeader field="score" label="Score" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, score }) => (
            <tr
              key={item.id}
              ref={item.id === activeItemId ? activeRowRef : undefined}
              className={item.id === activeItemId ? "active" : undefined}
              onClick={() => openItem(item.id)}
            >
              <td className="colSave" onClick={(event) => event.stopPropagation()}>
                <SaveButton
                  itemId={item.id}
                  saved={savedById.has(item.id)}
                  onToggle={onToggleSaved}
                />
              </td>
              <td>
                <span className={`kindTag k-${item.kind}`}>{titleCase(item.kind)}</span>
              </td>
              <td className="colTitle">{displayTitle(item)}</td>
              <td className="colPresenter">{item.presenter || item.authors || ""}</td>
              <td className="colDay">{item.dayLabel || ""}</td>
              <td className="colTime">{timeRange(item)}</td>
              <td className="colRoom">
                {item.room}
                {item.posterNum ? ` · P${item.posterNum}` : ""}
              </td>
              {showScore && <td className="colScore">{score.toFixed(2)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
