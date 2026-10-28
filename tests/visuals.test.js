import test from "node:test";
import assert from "node:assert/strict";
import { avatars, resolveAvatar, figureSVG, fieldSVG } from "../visuals.js";
import { createGame } from "../engine.js";
test("all historical avatars resolve deterministically without changing saved state", () => {
  const symbols = ["◆", "●", "▲", "★", "♟", "✿", "☀", "⬟"];
  const state = createGame(
    symbols.slice(0, 4).map((avatar, i) => ({ name: `Name ${i}`, avatar })),
  );
  const before = JSON.stringify(state);
  symbols.forEach((symbol, i) =>
    assert.equal(resolveAvatar(symbol).id, avatars[i].id),
  );
  state.players.forEach((p) => assert.match(figureSVG(p.avatar), /<svg/));
  assert.equal(JSON.stringify(state), before);
});
test("eight distinct named objects have original SVG previews and stable unknown fallback", () => {
  assert.equal(new Set(avatars.map((a) => a.path)).size, 8);
  avatars.forEach((a) => {
    assert.ok(a.name);
    assert.equal(resolveAvatar(a.id), a);
    assert.match(figureSVG(a.id), /linearGradient/);
  });
  assert.equal(resolveAvatar("unknown").id, "dog");
  assert.equal(resolveAvatar(null).id, "dog");
  assert.doesNotMatch(figureSVG("<script>"), /script/);
});
test("special fields use SVG illustrations", () => {
  [
    "go",
    "jail",
    "rail",
    "utility",
    "community",
    "chance",
    "tax",
    "parking",
    "gojail",
    "house",
    "hotel",
  ].forEach((k) => assert.match(fieldSVG(k), /<svg/));
});
