#!/usr/bin/env node
// Fetches repository metadata once and writes src/data/bodies.generated.json.
// Run by hand when the repo list changes, then commit the result.
// Not run by the build: a GitHub outage must never break the page.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const EXCLUDED_FORKS = new Set([
  "yfinance", "flash", "OrcaSlicer-bambulab",
  "Exercise01_08", "obsidi-academy-cohort-10",
]);
// Forks kept by exception, with the reason recorded so it can be revoked.
const INCLUDED_FORKS = new Map([["openclaw", "top layer of the orchestrator"]]);

const raw = JSON.parse(execFileSync("gh", [
  "repo", "list", "zubairmuwwakil", "--limit", "100", "--json",
  "name,description,createdAt,pushedAt,isPrivate,isFork,primaryLanguage,repositoryTopics",
], { encoding: "utf8" }));

const bodies = raw
  .filter((r) => (r.isFork ? INCLUDED_FORKS.has(r.name) : true))
  .filter((r) => !EXCLUDED_FORKS.has(r.name))
  .map((r) => ({
    id: r.name,
    bornAt: r.createdAt.split("T")[0],
    lastTouchedAt: r.pushedAt.split("T")[0],
    anonymous: r.isPrivate,
    // Private repos disclose nothing beyond their existence and dates.
    // Stripped HERE, at build time — never shipped and hidden in the client.
    description: r.isPrivate ? null : (r.description ?? null),
    language: r.isPrivate ? null : (r.primaryLanguage?.name ?? null),
    topics: r.isPrivate ? [] : (r.repositoryTopics ?? []).map((t) => t.name ?? t),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(
  "src/data/bodies.generated.json",
  JSON.stringify({ generatedFrom: "zubairmuwwakil", bodies }, null, 2) + "\n",
);
console.log(`wrote ${bodies.length} bodies (${bodies.filter((b) => b.anonymous).length} anonymous)`);
