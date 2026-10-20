import assert from "node:assert/strict";
import { test } from "node:test";
import { ZodError } from "zod";
import { getMunicipalities, searchJobs } from "./job-search.ts";

const advertisement = {
  id: "example-001",
  headline: "  Example Developer  ",
  webpage_url: "https://example.test/jobs/001",
  employer: { name: "Example Company", email: "not-retained@example.test" },
  description: { text: "First paragraph.\n\nSecond paragraph.", text_formatted: "<p>Not used</p>" },
  publication_date: "2026-10-21T10:30:00",
  application_deadline: "2026-11-30T23:59:59",
};

function respond(payload: unknown): typeof fetch {
  return async () => Response.json(payload);
}

test("sends an encoded search and municipality filter, and returns our opportunity format", async () => {
  let requestedUrl: URL | undefined;
  const fetcher: typeof fetch = async (input, options) => {
    requestedUrl = new URL(String(input));
    assert.equal(options?.cache, "no-store");
    assert.deepEqual(options?.headers, { Accept: "application/json" });
    assert.ok(options?.signal instanceof AbortSignal);
    return Response.json({ total: { value: 42 }, hits: [advertisement] });
  };
  const result = await searchJobs({ query: "  C++ & utvecklare  ", municipality: "0180" }, fetcher);
  assert.equal(requestedUrl?.origin, "https://jobsearch.api.jobtechdev.se");
  assert.equal(requestedUrl?.pathname, "/search");
  assert.equal(requestedUrl?.searchParams.get("q"), "C++ & utvecklare");
  assert.equal(requestedUrl?.searchParams.get("municipality"), "0180");
  assert.equal(requestedUrl?.searchParams.get("limit"), "20");
  assert.deepEqual(result, {
    total: 42,
    skippedCount: 0,
    opportunities: [{
      source: "platsbanken",
      sourceId: "example-001",
      title: "Example Developer",
      company: "Example Company",
      description: "First paragraph.\n\nSecond paragraph.",
      url: "https://example.test/jobs/001",
      applicationDeadline: "2026-11-30T23:59:59",
      publishedAt: "2026-10-21T10:30:00",
    }],
  });
});

test("allows national searches and unknown optional advertisement fields", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.has("municipality"), false);
    assert.equal(url.searchParams.get("limit"), "5");
    return Response.json({ total: { value: 1 }, hits: [{
      id: "example-002", headline: "Developer", webpage_url: "https://example.test/jobs/002",
    }] });
  };
  const result = await searchJobs({ query: "developer", limit: 5 }, fetcher);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.opportunities[0]?.company, null);
  assert.equal(result.opportunities[0]?.description, null);
  assert.equal(result.opportunities[0]?.publishedAt, null);
  assert.equal(result.opportunities[0]?.applicationDeadline, null);
});

test("skips unusable advertisements, reports the count, and keeps valid results", async () => {
  const result = await searchJobs({ query: "developer" }, respond({
    total: { value: 7 },
    hits: [
      advertisement,
      { ...advertisement, id: " " },
      { ...advertisement, headline: "\t\n " },
      { ...advertisement, webpage_url: "javascript:alert(1)" },
      { ...advertisement, publication_date: "2026-02-30T12:00:00" },
      { ...advertisement, description: { text: 123 } },
      null,
    ],
  }));
  assert.equal(result.skippedCount, 6);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.total, 7);
});

test("returns an empty search as a successful result", async () => {
  assert.deepEqual(
    await searchJobs({ query: "developer" }, respond({ total: { value: 0 }, hits: [] })),
    { total: 0, opportunities: [], skippedCount: 0 },
  );
});

test("rejects invalid searches before contacting the API", async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    return Response.json({});
  };
  for (const input of [
    { query: " \t " }, { query: "developer", municipality: " " },
    { query: "developer", limit: 0 }, { query: "developer", limit: 101 },
    { query: "developer", limit: 1.5 },
  ]) {
    await assert.rejects(searchJobs(input, fetcher), ZodError);
  }
  assert.equal(requests, 0);
});

test("reports HTTP, network, and timeout failures without returning partial results", async () => {
  for (const status of [400, 429, 500]) {
    await assert.rejects(
      searchJobs({ query: "developer" }, async () => new Response(null, { status })),
      { message: `Platsbanken search failed (HTTP ${status}).` },
    );
  }
  for (const error of [new TypeError("fetch failed"), new DOMException("Timed out", "TimeoutError")]) {
    await assert.rejects(searchJobs({ query: "developer" }, async () => { throw error; }), {
      message: "Could not reach Platsbanken. Please try again.",
      cause: error,
    });
  }
});

test("rejects invalid JSON and malformed search responses", async () => {
  await assert.rejects(
    searchJobs({ query: "developer" }, async () => new Response("not JSON")),
    /unreadable search response/,
  );
  for (const payload of [null, {}, { total: { value: -1 }, hits: [] }, { total: { value: 1 }, hits: {} }]) {
    await assert.rejects(searchJobs({ query: "developer" }, respond(payload)), /unexpected search response/);
  }
});

test("loads official municipality identifiers and sorts their names in Swedish order", async () => {
  const locations = await getMunicipalities(async (input, options) => {
    assert.equal(new URL(String(input)).hostname, "taxonomy.api.jobtechdev.se");
    assert.deepEqual(options?.next, { revalidate: 86400 });
    return Response.json([
      { "taxonomy/id": "example-orebro", "taxonomy/preferred-label": "Örebro" },
      { "taxonomy/id": "example-alvesta", "taxonomy/preferred-label": "Alvesta" },
      { "taxonomy/id": "example-are", "taxonomy/preferred-label": "Åre" },
    ]);
  });
  assert.deepEqual(locations, [
    { id: "example-alvesta", name: "Alvesta" },
    { id: "example-are", name: "Åre" },
    { id: "example-orebro", name: "Örebro" },
  ]);
});

test("rejects unavailable or malformed municipality lists so the page can offer national search", async () => {
  await assert.rejects(getMunicipalities(async () => new Response(null, { status: 500 })));
  await assert.rejects(getMunicipalities(async () => { throw new Error("Network unavailable"); }));
  for (const payload of [[], null, [{ "taxonomy/id": "example-001" }]]) {
    await assert.rejects(getMunicipalities(respond(payload)));
  }
});
