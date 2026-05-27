export type ProgramKind = "session" | "talk" | "poster";

export type Ranking = {
  rank: number;
  score: number;
  source: string;
  topClusters: { clusterId: string; score: number }[];
};

export type ProgramItem = {
  id: string;
  sourceId: string;
  kind: ProgramKind;
  title: string;
  abstract: string;
  type: string;
  dayKey: string;
  dayLabel: string;
  time: string;
  startH: number | null;
  endH: number | null;
  room: string;
  presenter: string;
  chair: string;
  authors: string;
  url: string;
  sessionId: string;
  sessionTitle: string;
  posterNum: number | null;
  talkCount?: number;
  talkIndex?: number | null;
  ranking: Ranking | null;
};

export type Person = {
  id: string;
  slug: string;
  name: string;
  roles: string[];
  itemIds: string[];
  embedding: {
    itemCount: number;
    dimensions: number;
  } | null;
};

export type RelatedPerson = {
  id: string;
  score: number;
  sharedItemCount: number;
};

export type SavedItem = {
  itemId: string;
  savedAt: string;
  status: "interested" | "must-see" | "maybe" | "attended";
  note?: string;
};

export type Cluster = {
  id: number;
  label: string;
  description: string;
  size: number;
};

export type ItemClusterAssignment = {
  primary: number;
  probability: number;
  top: { clusterId: number; score: number }[];
};

export type AppData = {
  generatedAt: string;
  days: {
    main: { key: string; abbr: string; date: string }[];
    all: { key: string; abbr: string; date: string }[];
    labels: Record<string, string>;
  };
  items: ProgramItem[];
  people: Person[];
  peopleByItem: Record<string, { id: string; slug: string; name: string; roles: string[] }[]>;
  relatedPeople: Record<string, RelatedPerson[]>;
  related: Record<string, { id: string; score: number }[]>;
  clusters: Cluster[];
  clusterByItem: Record<string, ItemClusterAssignment>;
  rankingMeta: {
    model: string;
    netsciCount: number;
    namedVectors: string[];
    centroidCount: number;
    personVectorCount: number;
  };
};
