// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { findPreviousNodeWithin } from "../../src/adapters/semantic-adapter";

describe("bounded semantic DOM traversal", () => {
  it("stops a deep previous subtree before traversing more than the supplied move budget", () => {
    const root = document.createElement("main");
    const previousBranch = document.createElement("section");
    let deepest: Node = previousBranch;
    for (let depth = 0; depth < 1_000; depth += 1) {
      const child = document.createElement("div");
      deepest.appendChild(child);
      deepest = child;
    }
    const currentTurn = document.createElement("article");
    root.append(previousBranch, currentTurn);

    expect(findPreviousNodeWithin(root, currentTurn, 32)).toEqual({
      node: null,
      moves: 32,
      exhausted: true,
    });
  });
});
