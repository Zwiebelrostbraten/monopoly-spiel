import { board, decks } from "./data.js";
export { board };
const ensure = (ok, msg) => {
  if (!ok) throw Error(msg);
};
export const active = (s) =>
  s.players.map((p, i) => (p.out ? null : i)).filter((i) => i !== null);
export function createGame(players, rng = Math.random) {
  ensure(
    players.length >= 2 && players.length <= 4,
    "2–4 Personen erforderlich.",
  );
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return {
    version: 1,
    players: players.map((p) => ({
      ...p,
      cash: 1500,
      pos: 0,
      jail: null,
      cards: [],
      out: false,
    })),
    estates: Object.fromEntries(
      board
        .filter((b) => ["street", "rail", "utility"].includes(b.type))
        .map((b) => [b.id, { owner: null, level: 0, mortgage: false }]),
    ),
    current: 0,
    phase: "roll",
    doubles: 0,
    extra: false,
    dice: [1, 1],
    houses: 32,
    hotels: 12,
    decks: Object.fromEntries(
      Object.entries(decks).map(([k, v]) => [k, shuffle(v.map((_, i) => i))]),
    ),
    queue: [],
    log: ["Willkommen zum Spielabend!"],
    round: 1,
    card: null,
    auction: null,
    trade: null,
  };
}
export function log(s, t) {
  s.log.push(t);
  if (s.log.length > 150) s.log.shift();
}
const group = (s, id) =>
  board
    .filter((b) => b.type === "street" && b.group === board[id].group)
    .map((b) => b.id);
const complete = (s, id, p) =>
  group(s, id).every((i) => s.estates[i].owner === p);
export function rent(s, id, dice = 7, mult = 1) {
  const b = board[id],
    e = s.estates[id];
  if (!e || e.owner === null || e.mortgage) return 0;
  if (b.type === "rail")
    return (
      25 *
      2 **
        (board.filter(
          (b) => b.type === "rail" && s.estates[b.id].owner === e.owner,
        ).length -
          1) *
      mult
    );
  if (b.type === "utility")
    return (
      dice *
      (mult === 10
        ? 10
        : board.filter(
              (b) => b.type === "utility" && s.estates[b.id].owner === e.owner,
            ).length === 2
          ? 10
          : 4)
    );
  return b.rents[e.level] * (e.level === 0 && complete(s, id, e.owner) ? 2 : 1);
}
function jail(s, p) {
  Object.assign(s.players[p], { pos: 10, jail: 0 });
  s.extra = false;
  s.doubles = 0;
  log(s, `${s.players[p].name} muss ins Gefängnis.`);
}
function enqueue(s, ...tasks) {
  s.queue.unshift(...tasks);
}
function payment(from, to, amount, reason = "Zahlung") {
  return { type: "pay", from, to, amount, reason };
}
function auction(s, id, kind = "deed", eligible = active(s)) {
  s.auction = {
    id,
    kind,
    eligible,
    passed: [],
    bid: 0,
    leader: null,
    turn: eligible[0],
  };
  s.phase = "auction";
  log(
    s,
    `Auktion: ${board[id].name}${kind === "building" ? " · Gebäude" : ""}.`,
  );
}
function cardEffect(s, k, p) {
  const index = s.decks[k].shift(),
    c = decks[k][index];
  s.card = { deck: k, index, text: c.text };
  log(s, `${k === "chance" ? "Ereignis" : "Gemeinschaft"}: ${c.text}`);
  enqueue(s, { type: "applyCard", deck: k, index, player: p });
  s.phase = "card";
}
function applyCard(s, k, index, p) {
  const c = decks[k][index];
  if (c.free) {
    s.players[p].cards.push(k);
  } else s.decks[k].push(index);
  if (c.jail) {
    jail(s, p);
    return;
  }
  if (c.move !== undefined)
    enqueue(s, { type: "move", player: p, target: c.move });
  if (c.back)
    enqueue(s, {
      type: "move",
      player: p,
      target: (s.players[p].pos + 40 - c.back) % 40,
      back: true,
    });
  if (c.nearest) {
    let n = s.players[p].pos;
    do {
      n = (n + 1) % 40;
    } while (board[n].type !== c.nearest);
    enqueue(s, {
      type: "move",
      player: p,
      target: n,
      mult: c.nearest === "rail" ? 2 : 10,
    });
  }
  if (c.money > 0) s.players[p].cash += c.money;
  if (c.money < 0) enqueue(s, payment(p, null, -c.money, "Karte"));
  if (c.repair) {
    let total = 0;
    for (const [id, e] of Object.entries(s.estates))
      if (e.owner === p)
        total += e.level === 5 ? c.repair[1] : e.level * c.repair[0];
    enqueue(s, payment(p, null, total, "Reparaturen"));
  }
  if (c.each)
    enqueue(
      s,
      ...active(s)
        .filter((i) => i !== p)
        .map((i) =>
          c.each > 0
            ? payment(i, p, c.each, "Karte · alle zahlen")
            : payment(p, i, -c.each, "Karte · an alle"),
        ),
    );
}
export function run(s, rng = Math.random) {
  while (s.queue.length) {
    const t = s.queue[0];
    if (t.type === "pay") {
      if (s.players[t.from].out || (t.to !== null && s.players[t.to].out)) {
        s.queue.shift();
        continue;
      }
      if (s.players[t.from].cash < t.amount) {
        s.debt = t;
        s.phase = "debt";
        return;
      }
      s.players[t.from].cash -= t.amount;
      if (t.to !== null) s.players[t.to].cash += t.amount;
      log(
        s,
        `${s.players[t.from].name} zahlt ${t.amount} an ${t.to === null ? "die Bank" : s.players[t.to].name} (${t.reason}).`,
      );
      s.debt = null;
      s.queue.shift();
      continue;
    }
    s.queue.shift();
    if (t.type === "move") {
      const p = s.players[t.player];
      if (p.out) continue;
      if ((!t.back && t.target < p.pos) || (!t.back && t.target === 0)) {
        p.cash += 200;
        log(s, `${p.name} erhält 200 für LOS.`);
      }
      p.pos = t.target;
      enqueue(s, { type: "land", player: t.player, mult: t.mult });
    } else if (t.type === "land") {
      const p = s.players[t.player],
        b = board[p.pos],
        e = s.estates[p.pos];
      log(s, `${p.name} landet auf ${b.name}.`);
      if (e) {
        if (e.owner === null) {
          s.purchase = { id: b.id, player: t.player };
          s.phase = "buy";
          return;
        }
        if (e.owner !== t.player) {
          let d = s.dice.reduce((a, b) => a + b, 0);
          if (b.type === "utility") {
            s.rentDice = [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
            d = s.rentDice[0] + s.rentDice[1];
            log(s, `Werk-Mietwurf: ${s.rentDice.join(" + ")}.`);
          }
          enqueue(
            s,
            payment(
              t.player,
              e.owner,
              rent(s, b.id, d, t.mult),
              "Miete · " + b.name,
            ),
          );
        }
      } else if (b.type === "tax")
        enqueue(s, payment(t.player, null, b.price, b.name));
      else if (b.type === "gojail") jail(s, t.player);
      else if (b.type === "chance" || b.type === "community") {
        cardEffect(s, b.type, t.player);
        if (s.phase === "card") return;
      }
    } else if (t.type === "applyCard") {
      applyCard(s, t.deck, t.index, t.player);
    } else if (t.type === "transferMortgage") {
      if (!s.players[t.player].out && s.estates[t.id].owner === t.player) {
        s.transfer = t;
        s.phase = "transfer";
        return;
      }
    } else if (t.type === "clearMortgage") {
      s.estates[t.id].mortgage = false;
    } else if (t.type === "resume") {
      s.phase = s.players[s.current].out ? "end" : t.phase;
      return;
    } else if (t.type === "jailMove") {
      s.players[t.player].jail = null;
      enqueue(s, {
        type: "move",
        player: t.player,
        target: (s.players[t.player].pos + t.steps) % 40,
      });
    } else if (t.type === "auction") {
      auction(s, t.id);
      return;
    } else if (t.type === "finish") {
      s.phase = s.extra ? "roll" : "end";
      return;
    }
  }
  if (s.phase !== "won") s.phase = s.extra ? "roll" : "end";
}
function manage(s, action, { id, player }) {
  const b = board[id],
    e = s.estates[id],
    p = s.players[player];
  ensure(
    e && e.owner === player && !p.out,
    "Dieses Grundstück gehört dir nicht.",
  );
  ensure(!s.trade && !s.auction, "Zuerst Handel oder Auktion abschließen.");
  if (s.debt)
    ensure(
      s.debt.from === player &&
        ["sell", "sellGroup", "mortgage"].includes(action),
      "Nur die zahlungspflichtige Person kann jetzt Geld beschaffen.",
    );
  const g = b.type === "street" ? group(s, id) : [id];
  if (action === "build") {
    ensure(
      b.type === "street" &&
        complete(s, id, player) &&
        g.every((i) => !s.estates[i].mortgage),
      "Eine vollständige, unbelastete Farbgruppe ist nötig.",
    );
    ensure(
      e.level < 5 && e.level === Math.min(...g.map((i) => s.estates[i].level)),
      "Gleichmäßig bauen, höchstens ein Hotel.",
    );
    ensure(p.cash >= b.build, "Nicht genügend Bargeld.");
    ensure(
      e.level === 4 ? s.hotels > 0 : s.houses > 0,
      "Die Bank hat kein passendes Gebäude.",
    );
    p.cash -= b.build;
    if (e.level === 4) {
      s.hotels--;
      s.houses += 4;
    } else s.houses--;
    e.level++;
  } else if (action === "sell") {
    ensure(
      e.level > 0 && e.level === Math.max(...g.map((i) => s.estates[i].level)),
      "Gebäude gleichmäßig verkaufen.",
    );
    ensure(
      e.level !== 5 || s.houses >= 4,
      "Für den Hoteltausch fehlen vier Häuser. Verkaufe alternativ die gesamte Gruppe.",
    );
    if (e.level === 5) {
      s.hotels++;
      s.houses -= 4;
    } else s.houses++;
    e.level--;
    p.cash += b.build / 2;
  } else if (action === "sellGroup") {
    ensure(
      b.type === "street" && complete(s, id, player),
      "Vollständige Gruppe erforderlich.",
    );
    for (const i of g) {
      const x = s.estates[i];
      p.cash += (x.level * board[i].build) / 2;
      if (x.level === 5) s.hotels++;
      else s.houses += x.level;
      x.level = 0;
    }
  } else if (action === "mortgage") {
    ensure(
      !e.mortgage && g.every((i) => s.estates[i].level === 0),
      "Vorher alle Gebäude der Gruppe verkaufen.",
    );
    e.mortgage = true;
    p.cash += b.price / 2;
  } else if (action === "unmortgage") {
    const amount = Math.ceil(b.price * 0.55);
    ensure(
      e.mortgage && p.cash >= amount,
      "Hypothek fehlt oder Bargeld reicht nicht.",
    );
    p.cash -= amount;
    e.mortgage = false;
  }
  log(
    s,
    `${p.name}: ${{ build: "Gebäude gebaut", sell: "Gebäude verkauft", sellGroup: "Gruppenbebauung verkauft", mortgage: "Hypothek aufgenommen", unmortgage: "Hypothek abgelöst" }[action]} · ${b.name}.`,
  );
  if (s.debt) run(s);
}
function validateTrade(s, t) {
  ensure(
    t.from !== t.to && active(s).includes(t.from) && active(s).includes(t.to),
    "Zwei aktive Personen wählen.",
  );
  for (const [p, ids, cash, cards] of [
    [t.from, t.give, t.cashGive, t.cardsGive],
    [t.to, t.take, t.cashTake, t.cardsTake],
  ]) {
    ensure(
      Number.isInteger(cash) && cash >= 0 && cash <= s.players[p].cash,
      "Bargeld im Handel ist nicht verfügbar.",
    );
    ensure(new Set(ids).size === ids.length, "Grundstück doppelt gewählt.");
    for (const id of ids) {
      ensure(s.estates[id]?.owner === p, "Eigentum im Handel ungültig.");
      ensure(
        board[id].type !== "street" ||
          group(s, id).every((i) => s.estates[i].level === 0),
        "Vor dem Handel alle Gebäude der Farbgruppe verkaufen.",
      );
    }
    const copy = [...s.players[p].cards];
    for (const k of cards) {
      const i = copy.indexOf(k);
      ensure(i >= 0, "Frei-Karte nicht verfügbar.");
      copy.splice(i, 1);
    }
  }
}
function returnCards(s, p) {
  for (const k of s.players[p].cards)
    s.decks[k].push(decks[k].findIndex((c) => c.free));
  s.players[p].cards = [];
}
export function act(s, action, args = {}, rng = Math.random) {
  ensure(s.phase !== "won", "Das Spiel ist beendet.");
  ensure(
    !s.trade || ["acceptTrade", "rejectTrade"].includes(action),
    "Zuerst das Handelsangebot annehmen oder ablehnen.",
  );
  if (
    ["build", "sell", "sellGroup", "mortgage", "unmortgage"].includes(action)
  ) {
    manage(s, action, args);
    return s;
  }
  const p = s.players[s.current];
  if (action === "roll") {
    ensure(s.phase === "roll" && !s.trade, "Würfeln ist jetzt nicht möglich.");
    const d = args.dice || [
      1 + Math.floor(rng() * 6),
      1 + Math.floor(rng() * 6),
    ];
    ensure(
      d.length === 2 && d.every((n) => Number.isInteger(n) && n >= 1 && n <= 6),
      "Ungültige Würfel.",
    );
    s.dice = d;
    s.rentDice = null;
    s.card = null;
    log(s, `${p.name} würfelt ${d.join(" + ")}.`);
    const dbl = d[0] === d[1],
      steps = d[0] + d[1];
    s.extra = false;
    if (p.jail !== null) {
      if (dbl) {
        p.jail = null;
        s.queue = [
          { type: "move", player: s.current, target: (p.pos + steps) % 40 },
          { type: "finish" },
        ];
      } else {
        p.jail++;
        if (p.jail >= 3)
          s.queue = [
            payment(s.current, null, 50, "Dritter Gefängnisversuch"),
            { type: "jailMove", player: s.current, steps },
            { type: "finish" },
          ];
        else s.queue = [{ type: "finish" }];
      }
    } else {
      s.doubles = dbl ? s.doubles + 1 : 0;
      if (s.doubles >= 3) {
        jail(s, s.current);
        s.queue = [{ type: "finish" }];
      } else {
        s.extra = dbl;
        s.queue = [
          { type: "move", player: s.current, target: (p.pos + steps) % 40 },
          { type: "finish" },
        ];
      }
    }
    run(s, rng);
  } else if (action === "jailPay" || action === "jailCard") {
    ensure(s.phase === "roll" && p.jail !== null, "Nur vor dem Gefängniswurf.");
    if (action === "jailPay") {
      ensure(p.cash >= 50, "50 Bargeld erforderlich.");
      p.cash -= 50;
    } else {
      ensure(p.cards.length, "Keine Frei-Karte vorhanden.");
      const k = p.cards.shift();
      s.decks[k].push(decks[k].findIndex((c) => c.free));
    }
    p.jail = null;
    log(s, `${p.name} verlässt das Gefängnis.`);
  } else if (action === "end") {
    ensure(s.phase === "end" && !s.trade, "Zug erst vollständig abschließen.");
    do {
      s.current = (s.current + 1) % s.players.length;
      if (s.current === 0) s.round++;
    } while (s.players[s.current].out);
    s.phase = "roll";
    s.doubles = 0;
    s.extra = false;
    log(s, `${s.players[s.current].name} ist am Zug.`);
  } else if (action === "buy") {
    ensure(s.phase === "buy", "Kein Kauf offen.");
    const { id, player } = s.purchase;
    ensure(
      s.players[player].cash >= board[id].price,
      "Nicht genügend Bargeld. Bitte versteigern.",
    );
    s.players[player].cash -= board[id].price;
    s.estates[id].owner = player;
    log(
      s,
      `${s.players[player].name} kauft ${board[id].name} für ${board[id].price}.`,
    );
    s.purchase = null;
    run(s, rng);
  } else if (action === "decline") {
    ensure(s.phase === "buy", "Kein Kauf offen.");
    const id = s.purchase.id;
    s.purchase = null;
    auction(s, id);
  } else if (action === "bid" || action === "pass") {
    ensure(s.phase === "auction", "Keine Auktion offen.");
    const a = s.auction,
      i = a.turn;
    if (action === "bid") {
      const n = Number(args.amount);
      ensure(
        Number.isInteger(n) &&
          n >= Math.max(10, a.bid + 1) &&
          n <= s.players[i].cash,
        "Gebot muss mindestens 10, höher als bisher und bar bezahlbar sein.",
      );
      a.bid = n;
      a.leader = i;
      log(s, `${s.players[i].name} bietet ${n}.`);
    } else {
      a.passed.push(i);
      log(s, `${s.players[i].name} passt.`);
    }
    const left = a.eligible.filter((i) => !a.passed.includes(i));
    if (!left.length || (left.length === 1 && a.leader === left[0])) {
      if (a.leader !== null) {
        s.players[a.leader].cash -= a.bid;
        if (a.kind === "building") {
          const e = s.estates[a.targets[a.leader]];
          if (e.level === 4) {
            s.hotels--;
            s.houses += 4;
          } else s.houses--;
          e.level++;
        } else s.estates[a.id].owner = a.leader;
        log(s, `${s.players[a.leader].name} gewinnt für ${a.bid}.`);
      } else log(s, "Keine Gebote: Das Grundstück bleibt bei der Bank.");
      s.auction = null;
      run(s, rng);
    } else {
      let next = i;
      do {
        next = (next + 1) % s.players.length;
      } while (!left.includes(next) || next === a.leader);
      a.turn = next;
    }
  } else if (action === "ackCard") {
    ensure(s.phase === "card", "Keine Karte offen.");
    s.card = null;
    run(s, rng);
  } else if (action === "bankrupt") {
    ensure(s.phase === "debt", "Keine unbezahlbare Forderung offen.");
    const d = s.debt,
      loser = s.players[d.from],
      credit = d.to;
    // Sell all buildings to the bank at half price before transfer.
    for (const [id, e] of Object.entries(s.estates))
      if (e.owner === d.from) {
        loser.cash += (e.level * (board[id].build || 0)) / 2;
        if (e.level === 5) s.hotels++;
        else s.houses += e.level;
        e.level = 0;
      }
    // Available mortgage equity must be used when it prevents elimination.
    const available = Object.entries(s.estates).filter(
      ([, e]) => e.owner === d.from && !e.mortgage,
    );
    if (
      loser.cash + available.reduce((n, [id]) => n + board[id].price / 2, 0) >=
      d.amount
    ) {
      for (const [id, e] of available) {
        if (loser.cash >= d.amount) break;
        e.mortgage = true;
        loser.cash += board[id].price / 2;
        log(
          s,
          `${loser.name} nimmt zur Schuldentilgung eine Hypothek auf ${board[id].name} auf.`,
        );
      }
    }
    if (loser.cash >= d.amount) {
      run(s, rng);
      return s;
    }
    if (credit !== null) s.players[credit].cash += loser.cash;
    loser.cash = 0;
    loser.out = true;
    const tasks = [];
    for (const [id, e] of Object.entries(s.estates))
      if (e.owner === d.from) {
        e.owner = credit;
        if (credit === null) {
          e.mortgage = false;
          tasks.push({ type: "auction", id: Number(id) });
        } else if (e.mortgage)
          tasks.push({
            type: "transferMortgage",
            player: credit,
            id: Number(id),
          });
      }
    if (credit !== null) {
      s.players[credit].cards.push(...loser.cards);
      loser.cards = [];
    } else returnCards(s, d.from);
    s.queue.shift();
    s.debt = null;
    if (d.from === s.current) s.extra = false;
    log(s, `${loser.name} ist bankrott und scheidet aus.`);
    if (active(s).length === 1) {
      s.winner = active(s)[0];
      s.phase = "won";
      s.queue = [];
      return s;
    }
    enqueue(s, ...tasks);
    if (!s.queue.some((t) => t.type === "finish"))
      s.queue.push({ type: "finish" });
    run(s, rng);
  } else if (action === "transferKeep" || action === "transferRedeem") {
    ensure(
      s.phase === "transfer" && s.transfer,
      "Keine Hypothekenübernahme offen.",
    );
    const t = s.transfer,
      b = board[t.id];
    s.transfer = null;
    const amount =
      action === "transferRedeem"
        ? Math.ceil(b.price * 0.55)
        : Math.ceil(b.price * 0.05);
    enqueue(
      s,
      payment(
        t.player,
        null,
        amount,
        action === "transferRedeem"
          ? "Hypothek sofort ablösen"
          : "Übernahmezinsen",
      ),
      ...(action === "transferRedeem"
        ? [{ type: "clearMortgage", id: t.id }]
        : []),
    );
    run(s, rng);
  } else if (action === "buildingAuction") {
    ensure(
      ["roll", "end"].includes(s.phase) && !s.trade,
      "Zuerst die laufende Aktion abschließen.",
    );
    const hotel = args.kind === "hotel";
    const stock = hotel ? s.hotels : s.houses;
    ensure(stock > 0, "Die Bank hat kein passendes Gebäude.");
    ensure(
      args.entries?.length > stock,
      "Mehr bauwillige Personen als verfügbare Gebäude wählen.",
    );
    const seen = new Set();
    for (const { player, id } of args.entries) {
      const e = s.estates[id];
      ensure(
        !seen.has(player) && active(s).includes(player),
        "Jede aktive Person darf genau einmal teilnehmen.",
      );
      seen.add(player);
      ensure(
        board[id]?.type === "street" &&
          e.owner === player &&
          complete(s, id, player),
        "Vollständige eigene Farbgruppe erforderlich.",
      );
      const g = group(s, id);
      ensure(
        g.every((i) => !s.estates[i].mortgage) &&
          e.level === Math.min(...g.map((i) => s.estates[i].level)) &&
          e.level === (hotel ? 4 : e.level) &&
          e.level < (hotel ? 5 : 4),
        "Das gewählte Grundstück kann dieses Gebäude nicht erhalten.",
      );
      ensure(
        s.players[player].cash >= 10,
        "Mindestens 10 Bargeld pro Person erforderlich.",
      );
    }
    s.queue.push({ type: "resume", phase: s.phase });
    auction(
      s,
      args.entries[0].id,
      "building",
      args.entries.map((e) => e.player),
    );
    s.auction.targets = Object.fromEntries(
      args.entries.map((e) => [e.player, e.id]),
    );
  } else if (action === "trade") {
    ensure(
      ["roll", "end", "debt"].includes(s.phase) && !s.trade,
      "Handel erst nach der laufenden Aktion.",
    );
    validateTrade(s, args);
    if (s.debt)
      ensure(
        [args.from, args.to].includes(s.debt.from),
        "Die zahlungspflichtige Person muss beteiligt sein.",
      );
    s.trade = structuredClone(args);
  } else if (action === "rejectTrade") {
    ensure(s.trade, "Kein Angebot offen.");
    s.trade = null;
  } else if (action === "acceptTrade") {
    const t = s.trade;
    ensure(t, "Kein Angebot offen.");
    validateTrade(s, t);
    const tasks = [];
    for (const [from, to, ids, cash, cards] of [
      [t.from, t.to, t.give, t.cashGive, t.cardsGive],
      [t.to, t.from, t.take, t.cashTake, t.cardsTake],
    ]) {
      s.players[from].cash -= cash;
      s.players[to].cash += cash;
      for (const id of ids) {
        s.estates[id].owner = to;
        if (s.estates[id].mortgage)
          tasks.push({ type: "transferMortgage", player: to, id });
      }
      for (const k of cards) {
        s.players[from].cards.splice(s.players[from].cards.indexOf(k), 1);
        s.players[to].cards.push(k);
      }
    }
    s.trade = null;
    log(
      s,
      `${s.players[t.from].name} und ${s.players[t.to].name} schließen ihren Handel ab.`,
    );
    if (tasks.length) {
      if (!s.queue.length) s.queue.push({ type: "resume", phase: s.phase });
      enqueue(s, ...tasks);
      run(s, rng);
    } else if (s.debt) run(s, rng);
  } else throw Error("Unbekannte Aktion.");
  return s;
}

// Run only when a new table is created, never when restoring a save.
export function chooseStarter(s, rng = Math.random) {
  let candidates = active(s);
  for (let attempt = 0; attempt < 100; attempt++) {
    const results = candidates.map((player) => {
      const dice = [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
      log(s, `${s.players[player].name}: Startwurf ${dice.join(" + ")}.`);
      return { player, total: dice[0] + dice[1] };
    });
    const high = Math.max(...results.map((r) => r.total));
    candidates = results.filter((r) => r.total === high).map((r) => r.player);
    if (candidates.length === 1) {
      s.current = candidates[0];
      log(
        s,
        `${s.players[s.current].name} beginnt mit dem höchsten Startwurf.`,
      );
      return s.current;
    }
  }
  throw Error("Startwürfe konnten nicht entschieden werden.");
}
