import { ChevronLeft, Info, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { itemsForPerson, personBySlug, relatedPeopleForPerson, searchPeople } from "../data";
import { DAYS, pushUrl, scrollPageToTop } from "../lib/navigation";
import { sortItems, titleCase, useTableSort } from "../lib/programHelpers";
import { PEOPLE_LIST_SCROLL_KEY } from "../lib/scrollPositions";
import type { SavedItem } from "../types";
import { ItemsTable } from "./ItemsTable";

const RELATED_PEOPLE_LIMIT = 15;
const RELATED_PEOPLE_HELP =
  "Calculated from each person's normalized average program embedding, then ranked by vector similarity. Shows up to 15 matches above 0.90; shared is the number of overlapping program items.";

function savePeopleListScroll() {
  const scroller = document.scrollingElement || document.documentElement;
  sessionStorage.setItem(PEOPLE_LIST_SCROLL_KEY, String(scroller.scrollTop));
}

function restorePeopleListScroll() {
  const raw = sessionStorage.getItem(PEOPLE_LIST_SCROLL_KEY);
  if (!raw) return;
  const top = Number(raw);
  if (!Number.isFinite(top)) return;
  requestAnimationFrame(() => {
    const scroller = document.scrollingElement || document.documentElement;
    scroller.scrollTo({ top, left: 0 });
  });
}

function PersonDetail({
  slug,
  savedById,
  onToggleSaved,
}: {
  slug: string;
  savedById: Map<string, SavedItem>;
  onToggleSaved: (id: string) => void;
}) {
  const { sortKey, sortDir, onSortChange } = useTableSort("day");
  const [relatedHelpOpen, setRelatedHelpOpen] = useState(false);
  const dayOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    DAYS.forEach((day, i) => map.set(day.key, i));
    return map;
  }, []);

  const person = personBySlug.get(slug);
  const rows = useMemo(() => {
    if (!person) return [];
    const items = itemsForPerson(slug).map((item) => ({ item, score: 0 }));
    return sortItems(items, sortKey, sortDir, dayOrderMap);
  }, [dayOrderMap, person, slug, sortDir, sortKey]);
  const relatedPeople = useMemo(() => {
    if (!person) return [];
    return relatedPeopleForPerson(person.id)
      .filter(({ score }) => score > 0.9)
      .slice(0, RELATED_PEOPLE_LIMIT);
  }, [person]);

  useEffect(() => {
    scrollPageToTop();
  }, [slug]);

  if (!person) {
    return (
      <div className="peoplePane">
        <button className="backBtn" onClick={() => pushUrl("/people")}>
          <ChevronLeft size={14} /> People
        </button>
        <p className="muted">Person not found.</p>
      </div>
    );
  }

  return (
    <div className="peoplePane personDetailPane">
      <button className="backBtn" onClick={() => pushUrl("/people")}>
        <ChevronLeft size={14} /> People
      </button>
      <h1>{person.name}</h1>
      <p className="muted">
        {person.roles.map(titleCase).join(", ")} · {rows.length} items
      </p>
      <h2 className="personSectionTitle">Programs</h2>
      <ItemsTable
        rows={rows}
        showScore={false}
        savedById={savedById}
        onToggleSaved={onToggleSaved}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={onSortChange}
      />
      {relatedPeople.length > 0 && (
        <section className="relatedPeopleSection">
          <div className="relatedSectionHeader">
            <h2>Similar People</h2>
            <button
              type="button"
              className="infoTooltip"
              title={RELATED_PEOPLE_HELP}
              aria-label="About similar people"
              aria-expanded={relatedHelpOpen}
              aria-describedby={relatedHelpOpen ? "related-people-help" : undefined}
              onClick={() => setRelatedHelpOpen((open) => !open)}
            >
              <Info size={13} />
            </button>
            <div
              id="related-people-help"
              className={relatedHelpOpen ? "infoPopover open" : "infoPopover"}
              role="tooltip"
              aria-hidden={!relatedHelpOpen}
            >
              {RELATED_PEOPLE_HELP}
            </div>
          </div>
          <div className="peopleGrid">
            {relatedPeople.map(({ person: related, score, sharedItemCount }) => (
              <button
                key={related.id}
                className="personCard"
                onClick={() => pushUrl(`/people/${related.slug}`)}
              >
                <strong>{related.name}</strong>
                <span>
                  {score.toFixed(2)} match · {related.itemIds.length} items
                  {sharedItemCount ? ` · ${sharedItemCount} shared` : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function PeoplePage({
  slug,
  savedById,
  onToggleSaved,
}: {
  slug?: string;
  savedById: Map<string, SavedItem>;
  onToggleSaved: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!slug) restorePeopleListScroll();
  }, [slug]);

  if (slug) {
    return <PersonDetail slug={slug} savedById={savedById} onToggleSaved={onToggleSaved} />;
  }

  const filtered = searchPeople(debouncedQuery);
  return (
    <div className="peoplePane">
      <div className="peopleHead">
        <label className="searchBox compact">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search presenters and authors"
          />
        </label>
      </div>
      <div className="peopleGrid">
        {filtered.map((person) => (
          <button
            key={person.id}
            className="personCard"
            onClick={() => {
              savePeopleListScroll();
              pushUrl(`/people/${person.slug}`);
            }}
          >
            <strong>{person.name}</strong>
            <span>
              {person.itemIds.length} items · {person.roles.map(titleCase).join(", ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
