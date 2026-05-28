import { jsonSchema, tool } from "ai";
import {
  clusterById,
  compactItemSummary,
  compactRelatedItems,
  findPeopleByTopic,
  itemById,
  itemsForTopic,
  limitNumber,
  searchItems,
  searchPeople,
  searchTopicSummaries,
} from "../program";
import type {
  FindPeopleByTopicInput,
  ListRelatedItemsInput,
  ListTopicItemsInput,
  ListTopicsInput,
  SearchPeopleInput,
  SearchProgramsInput,
} from "../program";
import type { Cluster, ProgramItem } from "../../src/types";

export const chatTools = {
  searchPrograms: tool<
    SearchProgramsInput,
    {
      query: string;
      results: Array<ReturnType<typeof compactItemSummary> & { searchScore: number }>;
    }
  >({
    description:
      "Search all program items with local lexical search, including breaks, meals, titles, abstracts, people, day, time, and room. Use this for general schedule questions such as lunch, coffee, registration, rooms, dates, and keyword searches.",
    inputSchema: jsonSchema<SearchProgramsInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, for example lunch, coffee, registration, Wednesday morning, or graph neural networks.",
        },
        limit: {
          type: "number",
          description: "Maximum program items to return. Defaults to 12.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query, limit }) => ({
      query,
      results: searchItems(query, limitNumber(limit, 12, 40)).map(({ item, score }) => ({
        ...compactItemSummary(item),
        searchScore: score,
      })),
    }),
  }),

  listTopics: tool<ListTopicsInput, ReturnType<typeof searchTopicSummaries>>({
    description:
      "List NetSci program topics/clusters. Use this when the user asks what topics exist, asks for topic options, or uses a broad topical phrase before selecting items.",
    inputSchema: jsonSchema<ListTopicsInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional words to filter topic labels and descriptions.",
        },
        limit: {
          type: "number",
          description: "Maximum topics to return. Defaults to 12.",
        },
      },
      additionalProperties: false,
    }),
    execute: ({ query = "", limit }) => searchTopicSummaries(query, limitNumber(limit, 12, 30)),
  }),

  listItemsInTopic: tool<
    ListTopicItemsInput,
    { topic: Cluster; items: Array<ReturnType<typeof compactItemSummary> & { topicScore: number }> }
  >({
    description:
      "List program items whose primary topic is a given topic id. Use topic ids from listTopics or from previous context.",
    inputSchema: jsonSchema<ListTopicItemsInput>({
      type: "object",
      properties: {
        topicId: {
          type: "number",
          description: "Numeric topic id from the topics list.",
        },
        limit: {
          type: "number",
          description: "Maximum items to return. Defaults to 12.",
        },
      },
      required: ["topicId"],
      additionalProperties: false,
    }),
    execute: ({ topicId, limit }) => {
      const topic = clusterById.get(topicId);
      if (!topic) throw new Error(`Topic ${topicId} was not found.`);
      return {
        topic,
        items: itemsForTopic(topicId, limitNumber(limit, 12, 40)).map(({ item, score }) => ({
          ...compactItemSummary(item),
          topicScore: score,
        })),
      };
    },
  }),

  listRelatedItems: tool<
    ListRelatedItemsInput,
    { item: ReturnType<typeof compactItemSummary>; related: ReturnType<typeof compactRelatedItems> }
  >({
    description:
      "List items that are semantically related to a known program item id. Use this when the user asks for similar talks/posters, alternatives, or follow-up recommendations.",
    inputSchema: jsonSchema<ListRelatedItemsInput>({
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "Program item id, such as talk:123, poster:45, or session:w-s1.",
        },
        limit: {
          type: "number",
          description: "Maximum related items to return. Defaults to 8.",
        },
      },
      required: ["itemId"],
      additionalProperties: false,
    }),
    execute: ({ itemId, limit }) => {
      const item = itemById.get(itemId);
      if (!item) throw new Error(`Item ${itemId} was not found.`);
      return {
        item: compactItemSummary(item),
        related: compactRelatedItems(item.id, limitNumber(limit, 8, 20)),
      };
    },
  }),

  findPeopleByTopic: tool<
    FindPeopleByTopicInput,
    {
      query: string;
      results: ReturnType<typeof findPeopleByTopic>;
    }
  >({
    description:
      "Find presenters, authors, and chairs connected to a topical query by searching matching program items and aggregating their people. Use this for questions like 'who works on mobility?' or 'who works on science of science?'",
    inputSchema: jsonSchema<FindPeopleByTopicInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Topical phrase to search for, for example mobility, science of science, epidemics, or temporal networks.",
        },
        limit: {
          type: "number",
          description: "Maximum people to return. Defaults to 10.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query, limit }) => ({
      query,
      results: findPeopleByTopic(query, limitNumber(limit, 10, 30)),
    }),
  }),

  searchPeople: tool<
    SearchPeopleInput,
    {
      query: string;
      results: Array<{
        score: number;
        person: {
          id: string;
          slug: string;
          name: string;
          roles: string[];
          itemCount: number;
          path: string;
        };
        items: ReturnType<typeof compactItemSummary>[];
      }>;
    }
  >({
    description:
      "Fuzzy-search presenters, authors, and chairs by name. Use this for person-name queries or when a user asks what someone is presenting.",
    inputSchema: jsonSchema<SearchPeopleInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Person name or partial name to search for.",
        },
        limit: {
          type: "number",
          description: "Maximum people to return. Defaults to 8.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query, limit }) => ({
      query,
      results: searchPeople(query, limitNumber(limit, 8, 20)).map(({ person, score }) => ({
        score,
        person: {
          id: person.id,
          slug: person.slug,
          name: person.name,
          roles: person.roles,
          itemCount: person.itemIds.length,
          path: `/people/${person.slug}`,
        },
        items: person.itemIds
          .map((id) => itemById.get(id))
          .filter((item): item is ProgramItem => Boolean(item))
          .slice(0, 8)
          .map(compactItemSummary),
      })),
    }),
  }),
};
