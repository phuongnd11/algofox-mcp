import { test } from "node:test";
import assert from "node:assert/strict";
import { renderArray, renderLinkedList, renderTree } from "../src/render/ascii.js";

test("array render", () => {
  assert.match(renderArray([2, 7, 11]), /\[ 2 \| 7 \| 11 \]/);
});
test("linked list render", () => {
  assert.equal(renderLinkedList([1, 2, 3]), "[1]→[2]→[3]→∅");
  assert.equal(renderLinkedList([]), "(empty list)");
});
test("tree render is non-empty and contains all values", () => {
  const out = renderTree([1, 2, 3, null, 4]);
  for (const v of ["1", "2", "3", "4"]) assert.ok(out.includes(v), `${v} missing in:\n${out}`);
  assert.equal(renderTree([]), "(empty tree)");
});
