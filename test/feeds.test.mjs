import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SOFTWARE_LEAD_WEEKLY_ISSUE_LIMIT,
  parseAnthropicEngineering,
  parseSoftwareLeadWeeklyIssue,
  selectLatestSoftwareLeadWeeklyIssues,
} from "../scripts/feeds.mjs";

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);

test("selects the six newest unique Software Lead Weekly issues", async () => {
  const sitemap = await readFile(
    fixture("software-lead-weekly-sitemap.xml"),
    "utf8",
  );

  const issues = selectLatestSoftwareLeadWeeklyIssues(sitemap);

  assert.equal(SOFTWARE_LEAD_WEEKLY_ISSUE_LIMIT, 6);
  assert.deepEqual(issues, [707, 706, 705, 704, 703, 702]);
});

test("parses a Software Lead Weekly issue title", async () => {
  const html = await readFile(
    fixture("software-lead-weekly-issue.html"),
    "utf8",
  );
  const url = "https://softwareleadweekly.com/issues/707";

  assert.deepEqual(parseSoftwareLeadWeeklyIssue(html, url), {
    title: "Software Lead Weekly #707",
    link: url,
    author: "Oren Ellenbogen",
    source: "Software Lead Weekly",
    date: "2026-08-28T00:00:00.000Z",
  });
});

test("rejects an issue page whose title format changed", () => {
  assert.equal(
    parseSoftwareLeadWeeklyIssue(
      "<title>Software Lead Weekly issue</title>",
      "https://softwareleadweekly.com/issues/707",
    ),
    null,
  );
});

test("parses engineering posts from the Anthropic Engineering payload", async () => {
  const html = await readFile(fixture("anthropic-engineering.html"), "utf8");

  assert.deepEqual(parseAnthropicEngineering(html), [
    {
      title: "Redesigning source control at Anthropic",
      link: "https://www.anthropic.com/research/redesigning-source-control",
      author: "Anthropic",
      source: "Anthropic Engineering",
      date: "2026-10-13T12:00:00.000Z",
    },
    {
      title: 'The "making" of Claude Code',
      link: "https://www.anthropic.com/features/making-of-claude-code",
      author: "Anthropic",
      source: "Anthropic Engineering",
      date: "2026-03-24T12:00:00.000Z",
    },
  ]);
});

test("returns no Anthropic posts when the payload has no posts array", () => {
  assert.deepEqual(
    parseAnthropicEngineering(
      `<script>self.__next_f.push([1,"5:[\\"$\\",\\"div\\",null,{}]\\n"])</script>`,
    ),
    [],
  );
});
