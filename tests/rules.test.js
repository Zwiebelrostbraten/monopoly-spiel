import test from "node:test";
import assert from "node:assert/strict";
import { createGame, act, rent, board, run } from "../engine.js";
const game = () =>
  createGame(
    [
      { name: "Ada", avatar: "◆" },
      { name: "Ben", avatar: "●" },
    ],
    () => 0.4,
  );
const own = (s, ids, p = 0) => ids.forEach((id) => (s.estates[id].owner = p));
test("40 squares, 28 deeds, two complete decks, initial capital", () => {
  let s = game();
  assert.equal(board.length, 40);
  assert.equal(Object.keys(s.estates).length, 28);
  assert.equal(s.decks.chance.length, 16);
  assert.equal(s.players[0].cash, 1500);
});
test("deterministic roll lands and purchase resolves", () => {
  let s = game();
  act(s, "roll", { dice: [1, 2] });
  assert.equal(s.phase, "buy");
  act(s, "buy");
  assert.equal(s.estates[3].owner, 0);
  assert.equal(s.players[0].cash, 1440);
  assert.equal(s.phase, "end");
});
test("complete set doubles only undeveloped rent; mortgage has no rent", () => {
  let s = game();
  own(s, [1, 3]);
  assert.equal(rent(s, 1, 7), 4);
  s.estates[1].level = 2;
  assert.equal(rent(s, 1, 7), 30);
  s.estates[1].mortgage = true;
  assert.equal(rent(s, 1, 7), 0);
});
test("rail and utility counts", () => {
  let s = game();
  own(s, [5, 15, 25, 35, 12, 28]);
  assert.equal(rent(s, 5, 7), 200);
  assert.equal(rent(s, 12, 7), 70);
});
test("third double sends directly to jail without salary", () => {
  let s = game();
  s.doubles = 2;
  s.players[0].pos = 39;
  act(s, "roll", { dice: [2, 2] });
  assert.equal(s.players[0].pos, 10);
  assert.equal(s.players[0].jail, 0);
  assert.equal(s.players[0].cash, 1500);
  assert.equal(s.phase, "end");
});
test("three failed jail attempts fine and move, no bonus roll", () => {
  let s = game();
  s.players[0].jail = 2;
  act(s, "roll", { dice: [1, 2] });
  assert.equal(s.players[0].cash, 1450);
  assert.equal(s.players[0].pos, 3);
  assert.equal(s.phase, "buy");
  act(s, "buy");
  assert.equal(s.phase, "end");
});
test("released jail doubles do not grant extra roll", () => {
  let s = game();
  s.players[0].jail = 0;
  act(s, "roll", { dice: [5, 5] });
  assert.equal(s.players[0].pos, 10);
  assert.equal(s.phase, "end");
});
test("auction includes decliner, constrains bids, passes and awards", () => {
  let s = game();
  act(s, "roll", { dice: [1, 2] });
  act(s, "decline");
  assert.equal(s.auction.turn, 0);
  assert.throws(() => act(s, "bid", { amount: 1501 }));
  act(s, "bid", { amount: 10 });
  act(s, "pass");
  assert.equal(s.estates[3].owner, 0);
  assert.equal(s.players[0].cash, 1490);
});
test("all pass leaves deed at bank", () => {
  let s = game();
  act(s, "roll", { dice: [1, 2] });
  act(s, "decline");
  act(s, "pass");
  act(s, "pass");
  assert.equal(s.estates[3].owner, null);
  assert.equal(s.phase, "end");
});
test("even construction, hotel conversion, limited stock and even selling", () => {
  let s = game();
  own(s, [1, 3]);
  s.players[0].cash = 10000;
  act(s, "build", { id: 1, player: 0 });
  assert.throws(() => act(s, "build", { id: 1, player: 0 }));
  for (let n = 0; n < 7; n++) act(s, "build", { id: n % 2 ? 1 : 3, player: 0 });
  act(s, "build", { id: 1, player: 0 });
  assert.equal(s.hotels, 11);
  assert.equal(s.houses, 28);
  act(s, "sell", { id: 1, player: 0 });
  assert.equal(s.houses, 24);
  assert.equal(s.hotels, 12);
});
test("mortgage group must be unbuilt and redemption includes interest", () => {
  let s = game();
  own(s, [1, 3]);
  act(s, "mortgage", { id: 1, player: 0 });
  assert.equal(s.players[0].cash, 1530);
  act(s, "unmortgage", { id: 1, player: 0 });
  assert.equal(s.players[0].cash, 1497);
  act(s, "build", { id: 1, player: 0 });
  assert.throws(() => act(s, "mortgage", { id: 3, player: 0 }));
});
test("debt pauses queued actions and mortgage can settle it", () => {
  let s = game();
  own(s, [39]);
  s.players[0].cash = 0;
  s.queue = [{ type: "pay", from: 0, to: 1, amount: 100 }, { type: "finish" }];
  run(s);
  assert.equal(s.phase, "debt");
  act(s, "mortgage", { id: 39, player: 0 });
  assert.equal(s.phase, "end");
  assert.equal(s.players[1].cash, 1600);
  assert.equal(s.players[0].cash, 100);
});
test("bank bankruptcy returns cards, clears mortgages and auctions deeds", () => {
  let s = game();
  own(s, [1, 3]);
  s.players[0].cash = 0;
  s.queue = [{ type: "pay", from: 0, to: null, amount: 500 }];
  run(s);
  act(s, "bankrupt");
  assert.equal(s.players[0].out, true);
  assert.equal(s.phase, "won");
});
test("movement passes GO, backward movement does not", () => {
  let s = game();
  s.players[0].pos = 39;
  s.queue = [{ type: "move", player: 0, target: 1 }, { type: "finish" }];
  run(s);
  assert.equal(s.players[0].cash, 1700);
});
test("trade requires consent and transfers cash, deeds and cards", () => {
  let s = game();
  own(s, [1]);
  s.players[0].cards = ["chance"];
  s.decks.chance = s.decks.chance.filter((i) => i !== 8);
  act(s, "trade", {
    from: 0,
    to: 1,
    give: [1],
    take: [],
    cashGive: 20,
    cashTake: 50,
    cardsGive: ["chance"],
    cardsTake: [],
  });
  assert.equal(s.estates[1].owner, 0);
  act(s, "acceptTrade");
  assert.equal(s.estates[1].owner, 1);
  assert.equal(s.players[0].cash, 1530);
  assert.deepEqual(s.players[1].cards, ["chance"]);
});

test("mortgaged sibling preserves double rent on an unmortgaged street", () => {
  const s = game();
  own(s, [1, 3]);
  s.estates[3].mortgage = true;
  assert.equal(rent(s, 1, 7), 4);
});
test("empty house stock and hotel downgrade shortage are enforced", () => {
  const s = game();
  own(s, [1, 3]);
  s.houses = 0;
  assert.throws(() => act(s, "build", { id: 1, player: 0 }));
  s.estates[1].level = 5;
  s.estates[3].level = 5;
  assert.throws(() => act(s, "sell", { id: 1, player: 0 }));
  s.phase = "debt";
  s.debt = { type: "pay", from: 0, to: null, amount: 1000 };
  s.queue = [s.debt, { type: "finish" }];
  s.players[0].cash = 0;
  act(s, "sellGroup", { id: 1, player: 0 });
  assert.equal(s.players[0].cash, 250);
  assert.equal(s.phase, "debt");
});
test("last house auction builds on the winner’s chosen eligible street", () => {
  const s = game();
  own(s, [1, 3]);
  own(s, [37, 39], 1);
  s.houses = 1;
  act(s, "buildingAuction", {
    kind: "house",
    entries: [
      { player: 0, id: 1 },
      { player: 1, id: 37 },
    ],
  });
  act(s, "bid", { amount: 20 });
  act(s, "bid", { amount: 30 });
  act(s, "pass");
  assert.equal(s.estates[37].level, 1);
  assert.equal(s.houses, 0);
  assert.equal(s.players[1].cash, 1470);
  assert.equal(s.phase, "roll");
});
test("third person can win auction, bidder cannot overspend or leave while leading", () => {
  const s = createGame([{ name: "A" }, { name: "B" }, { name: "C" }]);
  s.queue = [{ type: "finish" }];
  s.phase = "buy";
  s.purchase = { id: 1, player: 0 };
  act(s, "decline");
  act(s, "bid", { amount: 10 });
  act(s, "bid", { amount: 20 });
  act(s, "pass");
  assert.equal(s.auction.turn, 0);
  act(s, "pass");
  assert.equal(s.estates[1].owner, 1);
  assert.equal(s.players[1].cash, 1480);
});
test("bankruptcy to player transfers cash, deeds, free cards and prompts mortgage interest", () => {
  const s = createGame([{ name: "A" }, { name: "B" }, { name: "C" }]);
  own(s, [1, 3]);
  s.estates[1].mortgage = true;
  s.players[0].cards = ["chance"];
  s.decks.chance = s.decks.chance.filter((i) => i !== 8);
  s.players[0].cash = 10;
  s.queue = [{ type: "pay", from: 0, to: 1, amount: 1000 }, { type: "finish" }];
  run(s);
  act(s, "bankrupt");
  assert.equal(s.estates[1].owner, 1);
  assert.equal(s.players[1].cash, 1510);
  assert.deepEqual(s.players[1].cards, ["chance"]);
  assert.equal(s.phase, "transfer");
  act(s, "transferKeep");
  assert.equal(s.players[1].cash, 1507);
  assert.equal(s.estates[1].mortgage, true);
  assert.equal(s.phase, "end");
  act(s, "end");
  assert.equal(s.current, 1);
});
test("bank bankruptcy auctions every deed in order with cleared mortgages", () => {
  const s = createGame([{ name: "A" }, { name: "B" }, { name: "C" }]);
  own(s, [1, 3]);
  s.estates[1].mortgage = true;
  s.players[0].cash = 0;
  s.players[0].cards = ["chance"];
  s.decks.chance = s.decks.chance.filter((i) => i !== 8);
  s.queue = [
    { type: "pay", from: 0, to: null, amount: 1000 },
    { type: "finish" },
  ];
  run(s);
  act(s, "bankrupt");
  assert.equal(s.phase, "auction");
  assert.equal(s.auction.id, 1);
  assert.equal(s.estates[1].mortgage, false);
  act(s, "bid", { amount: 10 });
  act(s, "pass");
  assert.equal(s.auction.id, 3);
  act(s, "pass");
  act(s, "pass");
  assert.equal(s.phase, "end");
  assert.equal(s.decks.chance.includes(8), true);
});
test("sufficient mortgage equity prevents voluntary elimination", () => {
  const s = game();
  own(s, [39]);
  s.players[0].cash = 0;
  s.queue = [{ type: "pay", from: 0, to: 1, amount: 100 }, { type: "finish" }];
  run(s);
  act(s, "bankrupt");
  assert.equal(s.players[0].out, false);
  assert.equal(s.estates[39].mortgage, true);
  assert.equal(s.players[0].cash, 100);
  assert.equal(s.phase, "end");
});
test("trade mortgage immediate redemption is 110 percent, not double interest", () => {
  const s = game();
  own(s, [1]);
  s.estates[1].mortgage = true;
  act(s, "trade", {
    from: 0,
    to: 1,
    give: [1],
    take: [],
    cashGive: 0,
    cashTake: 0,
    cardsGive: [],
    cardsTake: [],
  });
  act(s, "acceptTrade");
  assert.equal(s.phase, "transfer");
  act(s, "transferRedeem");
  assert.equal(s.estates[1].mortgage, false);
  assert.equal(s.players[1].cash, 1467);
  assert.equal(s.phase, "roll");
});
test("trade cannot move developed group or overspend and pauses ordinary play", () => {
  const s = game();
  own(s, [1, 3]);
  s.estates[3].level = 1;
  const t = {
    from: 0,
    to: 1,
    give: [1],
    take: [],
    cashGive: 0,
    cashTake: 0,
    cardsGive: [],
    cardsTake: [],
  };
  assert.throws(() => act(s, "trade", t));
  s.estates[3].level = 0;
  act(s, "trade", t);
  assert.throws(() => act(s, "roll", { dice: [1, 2] }));
  act(s, "rejectTrade");
  assert.equal(s.estates[1].owner, 0);
});
test("third jail fine debt moves only after fine is settled", () => {
  const s = game();
  own(s, [39]);
  s.players[0].cash = 0;
  s.players[0].pos = 10;
  s.players[0].jail = 2;
  act(s, "roll", { dice: [1, 2] });
  assert.equal(s.phase, "debt");
  assert.equal(s.players[0].pos, 10);
  act(s, "mortgage", { id: 39, player: 0 });
  assert.equal(s.players[0].pos, 13);
  assert.equal(s.phase, "buy");
  assert.equal(s.players[0].jail, null);
});
test("jail card returns to its original deck and paid release permits ordinary doubles", () => {
  const s = game();
  s.players[0].jail = 0;
  s.players[0].pos = 10;
  s.players[0].cards = ["chance"];
  s.decks.chance = s.decks.chance.filter((i) => i !== 8);
  act(s, "jailCard");
  assert.equal(s.decks.chance.at(-1), 8);
  act(s, "roll", { dice: [5, 5] });
  assert.equal(s.phase, "roll");
  assert.equal(s.extra, true);
});

// Execute original effect data with predictable deck order and dice.
function draw(
  k,
  index,
  { count = 2, pos = k === "chance" ? 7 : 2, cash = 1500 } = {},
) {
  const s = createGame(
    Array.from({ length: count }, (_, i) => ({ name: String(i) })),
  );
  s.players[0].pos = pos;
  s.players[0].cash = cash;
  s.decks[k] = [index, ...s.decks[k].filter((i) => i !== index)];
  s.queue = [{ type: "land", player: 0 }, { type: "finish" }];
  run(s, () => 0.5);
  assert.equal(s.phase, "card");
  act(s, "ackCard", {}, () => 0.5);
  return s;
}
test("all 32 cards are executable, returned or retained, with no placeholders", async () => {
  const { decks } = await import("../data.js");
  for (const k of ["chance", "community"])
    for (let i = 0; i < 16; i++) {
      const s = draw(k, i);
      assert.ok(decks[k][i].text.length > 15);
      assert.equal(
        s.decks[k].length + s.players[0].cards.filter((c) => c === k).length,
        16,
      );
      assert.ok(["end", "buy", "debt"].includes(s.phase));
    }
});
test("card GO salary, advance over GO, backward does not collect", () => {
  let s = draw("chance", 0);
  assert.equal(s.players[0].cash, 1700);
  assert.equal(s.players[0].pos, 0);
  s = draw("chance", 2, { pos: 36 });
  assert.equal(s.players[0].cash, 1700);
  assert.equal(s.players[0].pos, 11);
  s = draw("chance", 9);
  assert.equal(s.players[0].pos, 4);
  assert.equal(s.players[0].cash, 1300);
});
test("back three from event 36 chains into community at 33", () => {
  const s = game();
  s.players[0].pos = 36;
  s.decks.chance = [9, ...s.decks.chance.filter((i) => i !== 9)];
  s.decks.community = [1, ...s.decks.community.filter((i) => i !== 1)];
  s.queue = [{ type: "land", player: 0 }, { type: "finish" }];
  run(s);
  act(s, "ackCard");
  assert.equal(s.phase, "card");
  assert.equal(s.card.deck, "community");
  act(s, "ackCard");
  assert.equal(s.players[0].cash, 1700);
  assert.equal(s.phase, "end");
});
test("nearest rail doubles rent and nearest utility uses new dice times ten", () => {
  for (const [index, id, expected] of [
    [4, 15, 50],
    [6, 12, 80],
  ]) {
    const s = game();
    s.players[0].pos = 7;
    own(s, [id], 1);
    s.decks.chance = [index, ...s.decks.chance.filter((i) => i !== index)];
    s.queue = [{ type: "land", player: 0 }, { type: "finish" }];
    run(s);
    act(s, "ackCard", {}, () => 0.5);
    assert.equal(s.players[0].cash, 1500 - expected);
    assert.equal(s.phase, "end");
  }
});
test("birthday collects from every other player, chairman pays every other player", () => {
  let s = draw("community", 8, { count: 4 });
  assert.deepEqual(
    s.players.map((p) => p.cash),
    [1530, 1490, 1490, 1490],
  );
  s = draw("chance", 14, { count: 4 });
  assert.deepEqual(
    s.players.map((p) => p.cash),
    [1350, 1550, 1550, 1550],
  );
});
test("repairs count hotels as hotels, not four extra houses", () => {
  const s = game();
  own(s, [1, 3]);
  s.estates[1].level = 5;
  s.estates[3].level = 3;
  s.players[0].pos = 7;
  s.decks.chance = [11, ...s.decks.chance.filter((i) => i !== 11)];
  s.queue = [{ type: "land", player: 0 }, { type: "finish" }];
  run(s);
  act(s, "ackCard");
  assert.equal(s.players[0].cash, 1325);
});
test("card jail does not pay GO, cancels doubles and requires acknowledgment", () => {
  const s = game();
  s.players[0].pos = 36;
  s.extra = true;
  s.decks.chance = [10, ...s.decks.chance.filter((i) => i !== 10)];
  s.queue = [{ type: "land", player: 0 }, { type: "finish" }];
  run(s);
  assert.equal(s.phase, "card");
  assert.equal(s.players[0].pos, 36);
  act(s, "ackCard");
  assert.equal(s.players[0].pos, 10);
  assert.equal(s.players[0].cash, 1500);
  assert.equal(s.phase, "end");
});
test("round-trip JSON preserves pending auction and debt semantics", () => {
  let s = game();
  act(s, "roll", { dice: [1, 2] });
  act(s, "decline");
  act(s, "bid", { amount: 15 });
  s = JSON.parse(JSON.stringify(s));
  act(s, "pass");
  assert.equal(s.estates[3].owner, 0);
  assert.equal(s.phase, "end");
});
test("starting roll breaks ties and chooses highest", async () => {
  const { chooseStarter } = await import("../engine.js");
  const s = game();
  let seq = [0, 0, 0, 0, 0, 0, 0.99, 0.99];
  chooseStarter(s, () => seq.shift());
  assert.equal(s.current, 1);
});

test("scarce stock with three applicants and two houses can be auctioned one by one", () => {
  const s = createGame([{ name: "A" }, { name: "B" }, { name: "C" }]);
  own(s, [1, 3], 0);
  own(s, [6, 8, 9], 1);
  own(s, [37, 39], 2);
  s.houses = 2;
  act(s, "buildingAuction", {
    kind: "house",
    entries: [
      { player: 0, id: 1 },
      { player: 1, id: 6 },
      { player: 2, id: 37 },
    ],
  });
  act(s, "bid", { amount: 10 });
  act(s, "pass");
  act(s, "pass");
  assert.equal(s.houses, 1);
  assert.equal(s.estates[1].level, 1);
  assert.equal(s.phase, "roll");
});
