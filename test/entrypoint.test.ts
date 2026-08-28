import assert from "node:assert/strict";
import test from "node:test";
import handler from "../index.js";

test("Vercel Node entrypoint exports an HTTP handler", () => {
  assert.equal(typeof handler, "function");
});
