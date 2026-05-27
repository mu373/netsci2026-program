import { Bookmark, BookmarkCheck } from "lucide-react";

export function SaveButton({
  itemId,
  saved,
  onToggle,
  size = 16,
}: {
  itemId: string;
  saved: boolean;
  onToggle: (id: string) => void;
  size?: number;
}) {
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      className={saved ? "saveBtn on" : "saveBtn"}
      title={saved ? "Unsave" : "Save"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(itemId);
      }}
    >
      <Icon size={size} />
    </button>
  );
}
