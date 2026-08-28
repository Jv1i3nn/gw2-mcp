import assert from "node:assert/strict";
import test from "node:test";
import { v2Endpoints } from "../src/endpoints.js";

test("catalog maps the complete official API v2 surface", () => {
  assert.ok(v2Endpoints.length >= 170, `only ${v2Endpoints.length} endpoints mapped`);
  assert.equal(new Set(v2Endpoints).size, v2Endpoints.length, "endpoint catalog contains duplicates");

  for (const endpoint of [
    "v2/account/homestead/decorations",
    "v2/characters/:id/equipmenttabs/active",
    "v2/guild/:id/treasury",
    "v2/pvp/seasons/:id/leaderboards/:board/:region",
    "v2/wvw/matches/stats/:id/teams/:team/top/kdr",
  ]) {
    assert.ok((v2Endpoints as readonly string[]).includes(endpoint), `${endpoint} is missing`);
  }
});
