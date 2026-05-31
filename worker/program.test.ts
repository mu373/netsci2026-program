import { describe, expect, test } from "vitest";
import { findPeopleByTopic, TOPIC_PERSON_RETRIEVAL_LIMIT } from "./program";

describe("findPeopleByTopic", () => {
  test("retrieves enough topical documents to avoid broad-topic people misses", () => {
    expect(TOPIC_PERSON_RETRIEVAL_LIMIT).toBeGreaterThanOrEqual(120);

    const results = findPeopleByTopic("epidemic modeling", 30);
    const people = new Set(results.map((result) => result.person.name));

    expect(people.has("Nathan Brack")).toBe(true);
    expect(people.has("Alessandro Vespignani")).toBe(true);
  });
});
