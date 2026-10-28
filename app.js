import { avatars, resolveAvatar, figureSVG, fieldSVG } from "./visuals.js";
import { createGame, act, board, active, chooseStarter } from "./engine.js";
import { decks } from "./data.js";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  detail = $("#detail"),
  content = $("#detailContent");
const KEY = "stadtvermoegen-v1",
  palette = ["#a8563f", "#436f9b", "#9a6b9e", "#537f59"];
const esc = (x) =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => new Intl.NumberFormat("de-DE").format(n) + " M";
let state = null,
  selected = 0,
  busy = false,
  saveOK = true,
  sound = false,
  toastTimer,
  animPos = null;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (
      parsed.version === 1 &&
      parsed.players?.length >= 2 &&
      parsed.estates &&
      parsed.decks &&
      parsed.queue &&
      parsed.phase
    )
      state = parsed;
    else throw Error("save");
  }
} catch {
  toast(
    "Der gespeicherte Spielstand konnte nicht geladen werden. Ein neues Spiel ist möglich.",
  );
}
if (state) selected = state.current;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveOK = true;
  } catch {
    saveOK = false;
    toast("Speichern ist nicht möglich. Bitte halte diesen Tab geöffnet.");
  }
}
function button(text, action, klass = "", attrs = "") {
  return `<button class="${klass}" data-action="${action}" ${attrs}>${text}</button>`;
}
function token(i) {
  return `<span class="token" style="--player:${palette[i]}" role="img" aria-label="${esc(state.players[i].name)} · ${resolveAvatar(state.players[i].avatar).name}" title="${esc(state.players[i].name)} · ${resolveAvatar(state.players[i].avatar).name}">${figureSVG(state.players[i].avatar)}</span>`;
}
function beep() {
  if (!sound) return;
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    const ctx = new C(),
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 440;
    g.gain.setValueAtTime(0.045, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start();
    o.stop(ctx.currentTime + 0.12);
    o.onended = () => ctx.close();
  } catch {}
}
function setup() {
  app.innerHTML = `<section class="setup"><div class="setup-intro"><p class="eyebrow">GROSSE PLÄNE. GUTE GESELLSCHAFT.</p><h1>Die Stadt liegt euch zu Füßen.</h1><p>Kleine Straßen, große Chancen. Kauft, handelt und baut euer Vermögen auf — gemeinsam an einem Spielbrett.</p><p class="muted">2–4 Personen · Ein Gerät · Euer nächster Spieleabend</p><div class="setup-art" aria-hidden="true"><div class="mini-deed" style="--stripe:#925d43">BADSTRASSE<span>${fieldSVG("house")}</span></div><div class="mini-deed" style="--stripe:#57967c">RATHAUSPLATZ<span>${fieldSVG("hotel")}</span></div><div class="mini-deed" style="--stripe:#526ca8">SCHLOSSALLEE<span>${figureSVG("hat")}</span></div></div></div><form id="setupForm" class="setup-card"><p class="eyebrow">DER TISCH IST GEDECKT</p><h2>Wer spielt mit?</h2><label for="playerCount">Personen am Spielbrett</label><select id="playerCount"><option value="2">2 Personen</option><option value="3">3 Personen</option><option value="4">4 Personen</option></select><div id="playerInputs"></div><p class="muted">Wählt eure Namen und Figuren. Der höchste Startwurf beginnt; danach geht es der Reihe nach weiter.</p><button class="primary" type="submit">Spielabend beginnen <span aria-hidden="true">↗</span></button><p class="muted" style="margin:12px 0 0;font-size:10px">1.500 Startgeld · Klassisches deutsches Brett · Kein Konto nötig</p></form></section>`;
  let choices = avatars.slice(0, 4).map((a) => a.id);
  const inputs = () => {
    const previous = [...document.querySelectorAll(".name-input")].map(
      (e) => e.value,
    );
    $("#playerInputs").innerHTML = Array.from(
      { length: Number($("#playerCount").value) },
      (_, i) =>
        `<div class="player-input" style="--player:${palette[i]}"><input class="name-input" aria-label="Name Person ${i + 1}" placeholder="Person ${i + 1}" maxlength="20" value="${esc(previous[i] || "")}" autocomplete="off"><fieldset class="figure-picker"><legend>Figur Person ${i + 1} · <span class="figure-name">${resolveAvatar(choices[i]).name}</span></legend><div class="figure-options">${avatars.map((a) => `<button type="button" class="figure-choice" data-person="${i}" data-figure="${a.id}" aria-label="${a.name}, Person ${i + 1}" aria-pressed="${choices[i] === a.id}">${figureSVG(a.id)}<span>${a.name}</span></button>`).join("")}</div></fieldset></div>`,
    ).join("");
    $("#playerInputs")
      .querySelectorAll("[data-figure]")
      .forEach(
        (el) =>
          (el.onclick = () => {
            const i = Number(el.dataset.person),
              id = el.dataset.figure,
              other = choices.indexOf(id);
            if (other !== -1 && other !== i) choices[other] = choices[i];
            choices[i] = id;
            // Update in place to preserve keyboard focus and entered names.
            document
              .querySelectorAll("[data-figure]")
              .forEach((b) =>
                b.setAttribute(
                  "aria-pressed",
                  String(
                    choices[Number(b.dataset.person)] === b.dataset.figure,
                  ),
                ),
              );
            document
              .querySelectorAll(".figure-name")
              .forEach(
                (n, j) => (n.textContent = resolveAvatar(choices[j]).name),
              );
            if (other !== -1 && other !== i)
              toast("Figuren getauscht. Jede Person hat ihre eigene Figur.");
          }),
      );
  };
  $("#playerCount").onchange = inputs;
  inputs();
  $("#setupForm").onsubmit = (e) => {
    e.preventDefault();
    const names = [...document.querySelectorAll(".name-input")];
    state = createGame(
      names.map((n, i) => ({
        name: n.value.trim() || `Person ${i + 1}`,
        avatar: choices[i],
      })),
    );
    chooseStarter(state);
    selected = state.current;
    save();
    render();
  };
}
const icons = Object.fromEntries(
  [
    "go",
    "community",
    "chance",
    "tax",
    "rail",
    "utility",
    "jail",
    "parking",
    "gojail",
  ].map((k) => [k, fieldSVG(k)]),
);
function coords(i) {
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [21 - i, 1];
  if (i <= 30) return [1, i - 19];
  return [i - 29, 11];
}
function boardHTML() {
  return `<div class="board-wrap"><div class="board" aria-label="Spielbrett mit 40 Feldern">${board
    .map((b) => {
      const [r, c] = coords(b.id),
        e = state.estates[b.id],
        occupants = state.players
          .map((p, i) =>
            !p.out && (animPos?.player === i ? animPos.pos : p.pos) === b.id
              ? i
              : null,
          )
          .filter((i) => i !== null);
      return `<button class="square ${b.id % 10 === 0 ? "corner" : ""} ${e?.mortgage ? "mortgaged" : ""} ${occupants.length ? "occupied" : ""}" style="grid-row:${r};grid-column:${c};--stripe:${b.color || "#7e9380"};--owner:${e?.owner !== null ? palette[e?.owner] : "transparent"}" data-square="${b.id}" aria-label="${esc(b.name)}${b.price ? ", " + b.price : ""}${e?.owner !== null && e ? " · " + esc(state.players[e.owner].name) : ""}${occupants.length ? " · " + occupants.map((i) => esc(state.players[i].name)).join(", ") : ""}">${b.type === "street" ? '<span class="stripe"></span>' : `<span class="sq-icon" aria-hidden="true">${icons[b.type] || fieldSVG("house")}</span>`}<span class="sq-name">${esc(b.name)}</span>${e?.level ? `<span class="buildings" aria-label="${e.level === 5 ? "Hotel" : e.level + " Häuser"}">${e.level === 5 ? fieldSVG("hotel") : fieldSVG("house").repeat(e.level)}</span>` : ""}<span class="sq-price">${e?.mortgage ? "Hypothek" : b.price ? money(b.price) : b.type === "go" ? "+200" : ""}</span><span class="tokens">${occupants.map(token).join("")}</span>${e?.owner !== null && e ? '<span class="owner-mark"></span>' : ""}</button>`;
    })
    .join(
      "",
    )}<div class="board-center"><div class="center-content"><p class="eyebrow">DAS GLÜCK ZIEHT SEINE KREISE</p><div class="city-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="center-title">Stadtvermögen</div><p class="eyebrow">KAUFEN · HANDELN · BAUEN</p><div class="center-divider"></div><div class="stock">⌂ ${state.houses} Häuser &nbsp; ▣ ${state.hotels} Hotels in der Bank</div><div class="dice" aria-label="Würfel ${state.dice.join(" und ")}">${state.dice.map(die).join("")}</div><div class="center-turn">${esc(state.players[state.current].name)} ${state.phase === "won" ? "· Spiel beendet" : "ist am Zug"}</div><div class="center-hint">${state.extra ? "Pasch — nach der Feldaktion noch einmal würfeln." : `Runde ${state.round} · Gemeinsam am selben Gerät`}</div><button class="explore-board" data-action="explore">Alle Felder groß ansehen ↗</button></div></div></div></div>`;
}
function die(n) {
  const places = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return `<div class="die">${Array.from({ length: 9 }, (_, i) => `<span ${places[n].includes(i) ? 'class="pip"' : ""}></span>`).join("")}</div>`;
}
function actionsHTML() {
  const p = state.players[state.current];
  if (state.trade) {
    const t = state.trade;
    return `<p class="auction-title">ANGEBOT AN ${esc(state.players[t.to].name)}</p>${tradeSummary(t)}<p class="muted">Gib das Gerät an ${esc(state.players[t.to].name)}. Nur diese Person soll die Zustimmung bestätigen.</p><div class="action-buttons">${button("Handel annehmen", "acceptTrade", "primary")}${button("Ablehnen", "rejectTrade")}</div>`;
  }
  if (state.phase === "won")
    return `<div class="won"><p class="eyebrow">DIE STADT HAT EINEN GEWINNER</p><h2>${esc(state.players[state.winner].name)}</h2><p>Das letzte Vermögen am Tisch.<br>Danke für diesen Spielabend!</p>${button("Noch eine Runde", "new", "")}</div>`;
  if (state.phase === "roll")
    return `<p class="action-message">${p.jail !== null ? `Du sitzt im Gefängnis. Versuch ${p.jail + 1} von 3: Würfle einen Pasch oder wähle vor dem Wurf eine andere Befreiung.` : state.extra ? "Ein Pasch! Du darfst noch einmal würfeln." : "Dein nächster Schritt könnte der Beginn einer großen Investition sein."}</p><div class="action-buttons">${button("Würfeln ↗", "roll", "primary")}${p.jail !== null ? button("50 zahlen", "jailPay", "", p.cash < 50 ? "disabled" : "") + button("Frei-Karte nutzen", "jailCard", "", !p.cards.length ? "disabled" : "") : ""}</div>`;
  if (state.phase === "end")
    return `<p class="action-message">${p.out ? "Du bist ausgeschieden." : "Alles erledigt. Du kannst noch bauen und handeln."} Gib das Gerät danach an die nächste Person.</p><div class="action-buttons">${button("Zug beenden →", "end", "primary")}</div>`;
  if (state.phase === "buy") {
    const { id, player } = state.purchase;
    return `<p class="eyebrow">EINE NEUE GELEGENHEIT</p><h3>${esc(board[id].name)}</h3><p class="action-message">Für ${money(board[id].price)} gehört dieses Grundstück ${esc(state.players[player].name)}. Oder alle bieten in einer Auktion.</p><div class="action-buttons">${button("Kaufen · " + money(board[id].price), "buy", "primary", state.players[player].cash < board[id].price ? "disabled" : "")}${button("Versteigern", "decline")}</div>${button("Besitzkarte ansehen", "viewPurchase", "quiet")}`;
  }
  if (state.phase === "card")
    return `<p class="eyebrow">${state.card.deck === "chance" ? "EREIGNIS" : "GEMEINSCHAFT"}</p><div class="card-message">${esc(state.card.text)}</div><div class="action-buttons">${button("Karte ausführen →", "ackCard", "primary")}</div><p class="muted" style="margin:10px 0 0;font-size:11px">Die Karte ist gezogen. Bewegungen und Zahlungen folgen beim Bestätigen.</p>`;
  if (state.phase === "transfer") {
    const t = state.transfer,
      b = board[t.id];
    return `<p class="eyebrow">HYPOTHEK ÜBERNOMMEN</p><h3>${esc(state.players[t.player].name)} · ${esc(b.name)}</h3><p class="action-message">Wähle jetzt: die Hypothek sofort für ${money(Math.ceil((b.price * 11) / 20))} ablösen oder sie behalten und ${money(Math.ceil(b.price / 20))} Übernahmezinsen zahlen. Späteres Ablösen kostet zusätzlich den normalen Ablösebetrag.</p><div class="action-buttons">${button("Sofort ablösen", "transferRedeem", "primary")}${button("Belastet behalten", "transferKeep")}</div>`;
  }
  if (state.phase === "auction") {
    const a = state.auction;
    return `<p class="auction-title">AUKTION · ${a.kind === "building" ? "KNAPPES GEBÄUDE" : esc(board[a.id].name)}</p><h3>${esc(state.players[a.turn].name)} bietet jetzt</h3><p class="action-message">${a.leader === null ? "Noch kein Gebot. Start bei 10." : `${money(a.bid)} von ${esc(state.players[a.leader].name)}`}<br>Verfügbar: ${money(state.players[a.turn].cash)}<br>${a.passed.length ? "Ausgestiegen: " + a.passed.map((i) => esc(state.players[i].name)).join(", ") : "Alle aktiven Personen dürfen mitbieten."}</p><form id="bidForm"><div class="bid-input"><input id="bidAmount" aria-label="Gebot" type="number" min="${Math.max(10, a.bid + 1)}" max="${state.players[a.turn].cash}" value="${Math.max(10, a.bid + 1)}" step="1" required><button class="primary" type="submit">Bieten</button></div></form>${button("Passen · aussteigen", "pass", "small")}<p class="muted" style="font-size:10px;margin:10px 0 0">Gerät reihum weitergeben. Höchstgebot gewinnt; ein Pass ist endgültig.</p>`;
  }
  if (state.phase === "debt") {
    const d = state.debt;
    return `<div class="debt-box"><p class="eyebrow">ZAHLUNG OFFEN</p><h3>${esc(state.players[d.from].name)} braucht ${money(d.amount)}</h3><p class="action-message">An ${d.to === null ? "die Bank" : esc(state.players[d.to].name)} · ${esc(d.reason)}<br>Bargeld: ${money(state.players[d.from].cash)}. Verkaufe Gebäude, nutze Hypotheken oder handle. Wähle dazu unten ein eigenes Grundstück.</p></div><div class="action-buttons">${button("Vermögen verwalten", "showDebtor", "primary")}${button("Insolvenz erklären", "confirmBankrupt", "danger")}</div>`;
  }
  return "";
}
function render() {
  if (!state) {
    setup();
    return;
  }
  if (state.players[selected]?.out) selected = active(state)[0];
  const p = state.players[state.current],
    owner = state.players[selected];
  app.innerHTML = `<div class="topline"><h1>Euer Spielabend.</h1><span class="save-status"><span class="status-dot"></span>${saveOK ? "Lokal gespeichert" : "Speichern nicht verfügbar"} · Runde ${state.round}</span></div><div class="game-layout"><section aria-label="Spielbrett und Besitz">${boardHTML()}<div class="panel asset-panel"><div class="asset-head"><div><p class="eyebrow">DEIN PORTFOLIO</p><h3>${token(selected)} ${esc(owner.name)}</h3></div><span class="muted">Feld anklicken zum Verwalten</span></div><div class="deed-list">${
    Object.entries(state.estates)
      .filter(([, e]) => e.owner === selected)
      .map(
        ([id, e]) =>
          `<button class="deed-chip" style="--stripe:${board[id].color || "#7e9380"}" data-square="${id}">${esc(board[id].name)}<small>${e.mortgage ? "Hypothek" : e.level === 5 ? "1 Hotel" : e.level ? e.level + " Häuser" : "Unbebaut"} · ${money(board[id].price)}</small></button>`,
      )
      .join("") ||
    '<p class="muted">Noch kein Grundbesitz. Jede große Geschichte fängt auf LOS an.</p>'
  }</div></div></section><aside class="sidebar"><section class="panel turn-panel" aria-label="Aktuelle Aktion" aria-live="polite"><div class="turn-label"><p class="eyebrow">${state.phase === "won" ? "SPIELENDE" : "AM ZUG"}</p><span class="badge">${p.jail !== null ? "Gefängnis" : "Runde " + state.round}</span></div><h2 class="turn-name">${token(state.current)} ${esc(p.name)}</h2><div id="actions">${actionsHTML()}</div></section><section class="panel players-panel"><p class="eyebrow">DIE RUNDE</p>${state.players.map((q, i) => `<button class="player-row ${i === state.current ? "current" : ""} ${i === selected ? "chosen" : ""} ${q.out ? "out" : ""}" data-player="${i}" ${q.out ? "disabled" : ""}>${token(i)}<span>${esc(q.name)}<small>${q.out ? "Ausgeschieden" : `${Object.values(state.estates).filter((e) => e.owner === i).length} Grundstücke · ${q.cards.length} Frei-Karten${q.jail !== null ? " · Gefängnis" : ""}`}</small></span><span class="money">${money(q.cash)}</span></button>`).join("")}<div class="tools">${button("⇄ Handeln", "openTrade", "small", !["roll", "end", "debt"].includes(state.phase) || state.trade ? "disabled" : "")}${button("⌂ Gebäudewettbewerb", "buildingContest", "small", !["roll", "end"].includes(state.phase) || state.trade ? "disabled" : "")}</div></section><section class="panel log-panel"><p class="eyebrow">DAS SPIELGESCHICHTEBUCH</p><ol class="log" start="${Math.max(1, state.log.length - 29)}">${state.log
    .slice(-30)
    .map((l) => `<li>${esc(l)}</li>`)
    .join(
      "",
    )}</ol></section></aside></div><span class="board-live" role="status">${esc(p.name)}, ${esc(board[p.pos].name)}.</span>`;
  app
    .querySelectorAll("[data-square]")
    .forEach((el) => (el.onclick = () => showDeed(Number(el.dataset.square))));
  app.querySelectorAll("[data-player]").forEach(
    (el) =>
      (el.onclick = () => {
        selected = Number(el.dataset.player);
        render();
      }),
  );
  wireActions(app);
  if ($("#bidForm"))
    $("#bidForm").onsubmit = (e) => {
      e.preventDefault();
      execute("bid", { amount: Number($("#bidAmount").value) });
    };
  const logEl = $(".log");
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  if (busy)
    app.querySelectorAll("button,input").forEach((b) => (b.disabled = true));
}
function wireActions(root) {
  root
    .querySelectorAll("[data-action]")
    .forEach((el) => (el.onclick = () => handle(el.dataset.action)));
}
function open(html) {
  content.innerHTML = html;
  const heading = content.querySelector("h2");
  if (heading) {
    heading.id = "detailTitle";
    detail.setAttribute("aria-labelledby", "detailTitle");
  }
  wireActions(content);
  if (!detail.open) detail.showModal();
}
function showDeed(id) {
  const b = board[id],
    e = state.estates[id];
  if (!e) {
    open(
      `<p class="eyebrow">FELD ${id}</p><h2>${icons[b.type] || ""} ${esc(b.name)}</h2><p>${{ go: "Beim Vorwärts-Überqueren oder Erreichen zahlt die Bank 200.", chance: "Ziehe eine Ereigniskarte und führe ihre Wirkung aus.", community: "Ziehe eine Gemeinschaftskarte und führe ihre Wirkung aus.", jail: "Hier bist du nur zu Besuch, wenn du regulär landest. Gefängnisstrafen dauern höchstens drei Würfelversuche.", gojail: "Direkt ins Gefängnis, ohne LOS-Gehalt. Dein Zug endet.", parking: "Eine ruhige Pause. Kein Geld und keine weitere Aktion.", tax: "Zahle " + money(b.price) + " an die Bank." }[b.type]}</p>`,
    );
    return;
  }
  const owner = e.owner === null ? null : state.players[e.owner];
  let rows =
    b.type === "street"
      ? b.rents.map((r, i) => [
          i === 0
            ? "Grundmiete"
            : i === 5
              ? "Mit Hotel"
              : `Mit ${i} ${i === 1 ? "Haus" : "Häusern"}`,
          r,
        ])
      : b.type === "rail"
        ? [
            ["1 Bahnhof", 25],
            ["2 Bahnhöfe", 50],
            ["3 Bahnhöfe", 100],
            ["4 Bahnhöfe", 200],
          ]
        : [
            ["1 Werk", "Wurf × 4"],
            ["2 Werke", "Wurf × 10"],
          ];
  if (b.type === "street")
    rows.splice(1, 0, ["Vollständige Farbgruppe", b.rents[0] * 2]);
  open(
    `<div class="deed-color" style="--stripe:${b.color || "#7e9380"}"></div><p class="eyebrow">BESITZKARTE · ${b.type === "street" ? "STRASSE" : b.type === "rail" ? "BAHNHOF" : "VERSORGUNGSWERK"}</p><h2>${esc(b.name)}</h2><p class="muted">${owner ? "Im Besitz von " + token(e.owner) + " " + esc(owner.name) : "Im Besitz der Bank"}${e.mortgage ? " · Mit Hypothek belastet" : ""}${e.level ? " · " + (e.level === 5 ? "1 Hotel" : e.level + " Häuser") : ""}</p><button class="quiet" data-action="explore">← Alle Felder</button><table class="rent-table"><tbody><tr><td>Kaufpreis</td><td>${money(b.price)}</td></tr>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${typeof value === "number" ? money(value) : value}</td></tr>`).join("")}${b.build ? `<tr><td>Je Haus / Hotel (+ 4 Häuser)</td><td>${money(b.build)}</td></tr>` : ""}<tr><td>Hypothekenwert</td><td>${money(b.price / 2)}</td></tr><tr><td>Ablösen inklusive Zinsen</td><td>${money(Math.ceil((b.price * 11) / 20))}</td></tr></tbody></table>${owner && !owner.out && state.phase !== "won" ? `<p class="muted">Verwaltung durch ${esc(owner.name)} · Verfügbar ${money(owner.cash)}. Ungültige Aktionen werden mit Begründung abgewiesen.</p><div class="detail-actions">${b.type === "street" ? `<button data-manage="build">⌂ Bauen</button><button data-manage="sell">Gebäude verkaufen</button><button data-manage="sellGroup">Gruppenbebauung verkaufen</button>` : ""}<button data-manage="${e.mortgage ? "unmortgage" : "mortgage"}">${e.mortgage ? "Hypothek ablösen" : "Hypothek aufnehmen"}</button></div>` : ""}`,
  );
  content.querySelectorAll("[data-manage]").forEach(
    (el) =>
      (el.onclick = () => {
        if (execute(el.dataset.manage, { id, player: e.owner })) {
          selected = e.owner;
          showDeed(id);
        }
      }),
  );
}
function tradeSummary(t) {
  const side = (p, ids, cash, cards) =>
    `<strong>${esc(state.players[p].name)} gibt:</strong><ul>${ids.map((id) => `<li>${esc(board[id].name)}${state.estates[id].mortgage ? " (Hypothek; Ablösewahl bei Übernahme)" : ""}</li>`).join("")}${cash ? `<li>${money(cash)}</li>` : ""}${cards.length ? `<li>${cards.length} Frei-Karte(n)</li>` : ""}${!ids.length && !cash && !cards.length ? "<li>Keine Gegenleistung</li>" : ""}</ul>`;
  return `<div class="trade-summary">${side(t.from, t.give, t.cashGive, t.cardsGive)}${side(t.to, t.take, t.cashTake, t.cardsTake)}</div>`;
}
function openTrade() {
  const ids = active(state);
  if (ids.length < 2) return;
  const first = ids.includes(selected) ? selected : ids[0],
    second = ids.find((i) => i !== first);
  open(
    `<p class="eyebrow">GEMEINSAM VERHANDELN</p><h2>Ein guter Tausch?</h2><p class="muted">Wählt Grundstücke, Bargeld und Frei-Karten. Das Angebot wird erst nach ausdrücklicher Zustimmung der anderen Person ausgeführt.</p><form id="tradeForm"><div class="trade-grid">${[first, second].map((p, j) => `<div class="trade-side"><label for="tradePlayer${j}">${j ? "Andere Person" : "Angebot von"}</label><select id="tradePlayer${j}">${ids.map((i) => `<option value="${i}" ${i === p ? "selected" : ""}>${esc(state.players[i].name)}</option>`).join("")}</select><div id="tradeAssets${j}"></div></div>`).join("")}</div><button class="primary" style="margin-top:18px" type="submit">Angebot zur Zustimmung vorlegen</button></form>`,
  );
  function assets(j) {
    const p = Number($("#tradePlayer" + j).value);
    $("#tradeAssets" + j).innerHTML =
      `<label>Bargeld geben<input type="number" id="tradeCash${j}" min="0" max="${state.players[p].cash}" value="0" step="1" required></label>${
        Object.entries(state.estates)
          .filter(([, e]) => e.owner === p)
          .map(
            ([id, e]) =>
              `<label><input type="checkbox" name="property${j}" value="${id}" ${board[id].type === "street" && board.some((b) => b.type === "street" && b.group === board[id].group && state.estates[b.id].level) ? "disabled" : ""}>${esc(board[id].name)}${e.mortgage ? " · Hypothek" : ""}</label>`,
          )
          .join("") || '<p class="muted">Keine Grundstücke.</p>'
      }${state.players[p].cards.map((k, i) => `<label><input type="checkbox" name="free${j}" value="${k}">Frei-Karte · ${k === "chance" ? "Ereignis" : "Gemeinschaft"}</label>`).join("")}`;
  }
  [0, 1].forEach((j) => {
    assets(j);
    $("#tradePlayer" + j).onchange = () => assets(j);
  });
  $("#tradeForm").onsubmit = (e) => {
    e.preventDefault();
    const checked = (name) =>
      [...content.querySelectorAll(`input[name="${name}"]:checked`)].map(
        (e) => e.value,
      );
    if (
      execute("trade", {
        from: Number($("#tradePlayer0").value),
        to: Number($("#tradePlayer1").value),
        give: checked("property0").map(Number),
        take: checked("property1").map(Number),
        cashGive: Number($("#tradeCash0").value),
        cashTake: Number($("#tradeCash1").value),
        cardsGive: checked("free0"),
        cardsTake: checked("free1"),
      })
    ) {
      detail.close();
      $(".turn-panel")?.scrollIntoView({
        behavior: reduced() ? "instant" : "smooth",
        block: "center",
      });
    }
  };
}
function buildingContest() {
  open(
    `<p class="eyebrow">KNAPPES ANGEBOT</p><h2>Wenn Gebäude knapp werden.</h2><p class="muted">Wenn mehr Personen ein Gebäude wünschen als die Bank vorrätig hat, wird ein Gebäude versteigert. Jede Person wählt ein rechtmäßig bebaubares Grundstück. Der Gewinner baut dort zum Gebotspreis. Bei weiterem Engpass eröffnet ihr die nächste Auktion.</p><form id="buildingForm"><label>Gebäudetyp <select id="buildingKind"><option value="house">Haus (${state.houses} verfügbar)</option><option value="hotel">Hotel (${state.hotels} verfügbar)</option></select></label><div class="building-entries">${active(
      state,
    )
      .map(
        (i) =>
          `<label>${esc(state.players[i].name)}<select data-building-player="${i}"><option value="">Bietet nicht mit</option>${Object.entries(
            state.estates,
          )
            .filter(([id, e]) => e.owner === i && board[id].type === "street")
            .map(
              ([id]) => `<option value="${id}">${esc(board[id].name)}</option>`,
            )
            .join("")}</select></label>`,
      )
      .join(
        "",
      )}</div><button class="primary" type="submit">Gebäude versteigern</button></form>`,
  );
  $("#buildingForm").onsubmit = (e) => {
    e.preventDefault();
    const entries = [...content.querySelectorAll("[data-building-player]")]
      .filter((el) => el.value !== "")
      .map((el) => ({
        player: Number(el.dataset.buildingPlayer),
        id: Number(el.value),
      }));
    if (execute("buildingAuction", { kind: $("#buildingKind").value, entries }))
      detail.close();
  };
}
function handle(action) {
  if (busy) return;
  if (action === "explore") {
    exploreBoard();
    return;
  }
  if (action === "new") {
    confirmNew();
    return;
  }
  if (action === "viewPurchase") {
    showDeed(state.purchase.id);
    return;
  }
  if (action === "openTrade") {
    openTrade();
    return;
  }
  if (action === "buildingContest") {
    buildingContest();
    return;
  }
  if (action === "showDebtor") {
    selected = state.debt.from;
    render();
    $(".asset-panel").scrollIntoView({
      behavior: reduced() ? "instant" : "smooth",
      block: "center",
    });
    return;
  }
  if (action === "confirmBankrupt") {
    open(
      `<p class="eyebrow">INSOLVENZ</p><h2>Vermögen abgeben?</h2><p>Alle Gebäude werden zum halben Preis liquidiert. Falls nötig und ausreichend, werden außerdem Hypotheken aufgenommen. Kann die Forderung damit beglichen werden, wird sie bezahlt. Andernfalls scheidet ${esc(state.players[state.debt.from].name)} aus; die verbleibenden Werte werden nach den Insolvenzregeln übertragen.</p><div class="detail-actions">${button("Insolvenz abwickeln", "bankrupt", "danger")}${button("Weiter Geld beschaffen", "closeDetail")}</div>`,
    );
    return;
  }
  if (action === "closeDetail") {
    detail.close();
    return;
  }
  if (action === "roll") {
    animateRoll();
    return;
  }
  if (execute(action) && ["bankrupt"].includes(action)) detail.close();
}
function focusAction() {
  if (!detail.open && !busy)
    document
      .querySelector("#actions .primary, #actions button")
      ?.focus({ preventScroll: true });
}
function execute(action, args = {}) {
  if (busy) return false;
  try {
    const old = state,
      next = structuredClone(state);
    act(next, action, args);
    state = next;
    if (state.debt) selected = state.debt.from;
    save();
    const moving = state.players.findIndex(
      (p, i) => p.pos !== old.players[i].pos,
    );
    if (moving >= 0 && !reduced()) {
      const back =
        action === "ackCard" &&
        old.card &&
        decks[old.card.deck][old.card.index].back;
      animateMovement(old.players[moving].pos, moving, !!back);
    } else {
      render();
      focusAction();
    }
    beep();
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function animateMovement(old, player, back = false) {
  busy = true;
  animPos = { player, pos: old };
  const end = state.players[player].pos;
  const distance =
    state.players[player].jail !== null
      ? 0
      : back
        ? (old - end + 40) % 40
        : (end - old + 40) % 40;
  if (!reduced() && distance) {
    for (let i = 1; i <= distance; i++) {
      animPos.pos = (old + (back ? -i : i) + 40) % 40;
      render();
      await delay(65);
    }
  }
  animPos = null;
  busy = false;
  render();
  focusAction();
}
async function animateRoll() {
  if (busy) return;
  const old = state.players[state.current].pos,
    player = state.current;
  const next = structuredClone(state);
  try {
    act(next, "roll");
  } catch (e) {
    toast(e.message);
    return;
  }
  // Commit the roll before any visual delay so reloading cannot reroll it.
  state = next;
  if (state.debt) selected = state.debt.from;
  save();
  busy = true;
  animPos = { player, pos: old };
  render();
  document
    .querySelectorAll(".die")
    .forEach((el) => el.classList.add("rolling"));
  await delay(reduced() ? 0 : 650);
  await animateMovement(old, player);
  beep();
}
function confirmNew() {
  if (!state) {
    setup();
    return;
  }
  open(
    `<p class="eyebrow">NEUER SPIELABEND</p><h2>Neu beginnen?</h2><p>Der aktuelle Spielstand wird durch ein neues Spiel ersetzt. Ihr könnt vorher über „Spielstand exportieren“ eine lokale Sicherung herunterladen.</p><div class="new-confirm">${button("Spielstand exportieren", "export")}${button("Neu beginnen", "reset", "danger")}</div>`,
  );
  content.querySelector('[data-action="export"]').onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    a.download = "stadtvermoegen-spielstand.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  content.querySelector('[data-action="reset"]').onclick = () => {
    state = null;
    try {
      localStorage.removeItem(KEY);
    } catch {}
    detail.close();
    setup();
  };
}
$("#rulesButton").onclick = () => $("#rules").showModal();
$("#newButton").onclick = () => !busy && confirmNew();
$("#soundButton").onclick = () => {
  sound = !sound;
  $("#soundButton").textContent = sound ? "Ton an" : "Ton aus";
  $("#soundButton").setAttribute("aria-pressed", String(sound));
  beep();
};
document
  .querySelectorAll("dialog .close")
  .forEach((el) => (el.onclick = () => el.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  }),
);
render();

function exploreBoard() {
  open(
    `<p class="eyebrow">DAS BRETT IM DETAIL</p><h2>40 Felder. Eure Stadt.</h2><div class="field-list">${board
      .map((b) => {
        const e = state.estates[b.id];
        return `<button data-field="${b.id}" style="--stripe:${b.color || "#9baa8d"}"><span class="field-number">${icons[b.type] || fieldSVG("house")}</span><span>${esc(b.name)}<small>${e?.owner !== null && e ? esc(state.players[e.owner].name) + (e.mortgage ? " · Hypothek" : "") : e ? "Bank" : b.type === "tax" ? "Steuer" : ""}</small></span><strong>${b.price ? money(b.price) : icons[b.type] || ""}</strong></button>`;
      })
      .join("")}</div>`,
  );
  content
    .querySelectorAll("[data-field]")
    .forEach((el) => (el.onclick = () => showDeed(Number(el.dataset.field))));
}
