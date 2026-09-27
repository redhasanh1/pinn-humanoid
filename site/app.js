// Renders the site from data/*.json and research/*.md.
const DOCS = [
  ["Cerebras thesis", "/research/cerebras_thesis.md"],
  ["Fast-inference physical AI", "/research/physical_ai_fast_inference.md"],
  ["Cerebras platform", "/research/cerebras_platform.md"],
  ["Physical-AI brief", "/research/physical_ai_research.md"],
  ["Kimi review", "/research/kimi_research.md"],
  ["XLeRobot BOM", "/research/xlerobot_official_bom.md"],
];

// What the robot is for. "now" = targeted in the 16-week build, "next" = after it.
const JOBS = [
  ["Cooking prep", "now"], ["Tidying up", "now"], ["Fetching things", "now"],
  ["Wiping surfaces", "next"], ["Laundry", "next"], ["Walking the dog", "next"],
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n, cur = "CAD") => (cur === "USD" ? "US$" : "$") + Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (rows) => rows.reduce((t, r) => t + r.price * r.qty, 0);
const getJSON = (url) => fetch(url).then((r) => r.json());

function table(el, rows, cur, extra = []) {
  const head = `<thead><tr><th>Item</th><th>Product</th><th class="num">Unit</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>`;
  const body = rows
    .map((r) => `<tr><td>${esc(r.item)}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.product)}</a><div class="note">${esc(r.notes)}</div></td>`
      + `<td class="num">${money(r.price, cur)}</td><td class="num">${r.qty}</td><td class="num">${money(r.price * r.qty, cur)}</td></tr>`)
    .join("");
  const foot = extra.map(([label, val, cls]) => `<tr class="${cls}"><td colspan="4">${label}</td><td class="num">${val}</td></tr>`).join("");
  el.innerHTML = head + `<tbody>${body}${foot}</tbody>`;
}

// Each page only has some of these sections; render whichever exist.
async function home() {
  if (!$("stats")) return;
  const [bom, road] = await Promise.all([getJSON("/data/bom.json"), getJSON("/data/roadmap.json")]);
  const taxed = sum(bom.phase1.core) * (1 + bom.tax_rate);
  const cards = road.steps.flatMap((st) => [st.hardware, st.software]);
  $("jobs").innerHTML = JOBS.map(([j, w]) => `<li class="${w}">${esc(j)}<span>${w === "now" ? "16-week build" : "next"}</span></li>`).join("");
  $("stats").innerHTML = [
    ["Life-size", "InMoov-based humanoid, 1.8 m"],
    ["C$1,500", "Whole-robot budget, printing free"],
    [money(taxed), "Hands cart incl. tax"],
    [`${cards.filter((c) => c.done).length}/${cards.length}`, "Plan steps done"],
  ].map(([v, k]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join("");
}

async function parts() {
  if (!$("p1-core")) return;
  const bom = await getJSON("/data/bom.json");
  const p1 = bom.phase1, p2 = bom.phase2;
  const core = sum(p1.core), opt = sum(p1.optional), taxed = core * (1 + bom.tax_rate), p2usd = sum(p2.items);
  $("parts-updated").textContent = `Prices checked on the linked pages on ${bom.updated}. They change, so re-check before ordering.`;
  $("p1-title").textContent = p1.title;
  table($("p1-core"), p1.core, "CAD", [
    ["Subtotal", money(core), "sub"],
    [`HST ${Math.round(bom.tax_rate * 100)}%`, money(core * bom.tax_rate), "sub"],
    ["Total", money(taxed), "total"],
  ]);
  table($("p1-opt"), p1.optional, "CAD", [["With sensors, incl. tax", money((core + opt) * (1 + bom.tax_rate)), "total"]]);
  table($("p1-alt"), p1.alternatives, "CAD");
  $("p2-title").textContent = p2.title;
  const cur2 = p2.currency || "USD";
  table($("p2"), p2.items, cur2, cur2 === "CAD"
    ? [["Subtotal", money(p2usd), "sub"], [`Total incl. the $316.40 hands cart`, money(p2usd + 316.40), "total"]]
    : [["Subtotal", money(p2usd, "USD"), "sub"], [`≈ CAD at ${bom.usd_to_cad}`, money(p2usd * bom.usd_to_cad), "total"]]);
  if (bom.phase3 && $("p3")) {
    const p3 = sum(bom.phase3.items);
    $("p3-title").textContent = bom.phase3.title;
    table($("p3"), bom.phase3.items, "CAD", [
      ["Subtotal", money(p3), "sub"],
      [`With HST ${Math.round(bom.tax_rate * 100)}%`, money(p3 * (1 + bom.tax_rate)), "total"],
    ]);
  }
  if (bom.sizes && $("sizes")) sizes(bom.sizes);
}

// Screws and bolts side by side at real size, so "is this the right size?" is answered at a glance.
function sizes(rows) {
  const S = 3, gap = 40, top = 34, h = 100 * S + top + 40;
  let x = 20;
  const shapes = rows.map((r) => {
    const w = r.thick_mm * S, len = r.long_mm * S, cx = x + Math.max(w, 13 * S) / 2;
    const ball = r.part.includes("ball");
    const g = ball
      ? `<circle cx="${cx}" cy="${top + w / 2}" r="${w / 2}" fill="var(--muted)"/>`
      : `<rect x="${cx - w * 0.9}" y="${top}" width="${w * 1.8}" height="${w * 0.8}" rx="2" fill="var(--muted)"/>`
        + `<rect x="${cx - w / 2}" y="${top + w * 0.8}" width="${w}" height="${len}" fill="var(--muted)" opacity="0.75"/>`;
    const label = `<text x="${cx}" y="${top - 12}" text-anchor="middle" font-size="12" fill="currentColor">${esc(r.part.replace(" mm bolt", "").replace(" mm self-tapper", "").replace(" (BB)", ""))}</text>`;
    x += Math.max(w * 1.8, 13 * S) + gap;
    return g + label;
  }).join("");
  $("sizes-draw").innerHTML = `<svg viewBox="0 0 ${x} ${h}" width="${x}" height="${h}" role="img" aria-label="Screws drawn to real size">${shapes}`
    + `<line x1="20" y1="${h - 16}" x2="${20 + 50 * S}" y2="${h - 16}" stroke="currentColor"/><text x="${20 + 25 * S}" y="${h - 4}" text-anchor="middle" font-size="11" fill="currentColor">50 mm</text></svg>`;
  $("sizes").innerHTML = `<thead><tr><th>Part</th><th class="num">Thick</th><th class="num">Long</th><th>Goes in</th><th>Tool</th><th>Status</th></tr></thead><tbody>`
    + rows.map((r) => `<tr><td>${esc(r.part)}</td><td class="num">${r.thick_mm} mm</td><td class="num">${r.long_mm} mm</td><td>${esc(r.where)}</td><td>${esc(r.tool)}</td><td>${esc(r.status)}</td></tr>`).join("")
    + "</tbody>";
}

// Part list next to a 3D view: pointing at a part lights it up in the model.
async function partList(listId, url) {
  if (!$(listId)) return null;
  const data = await getJSON(url);
  const list = $(listId);
  list.innerHTML = data.parts
    .map((p, i) => `<li tabindex="0" data-i="${i}"><div class="ap-head"><b>${esc(p.name)}</b><span class="muted">${esc(p.joints)}</span><span class="pill ${p.status}">${p.status}</span></div>`
      + `<div class="ap-row"><span>Moves by</span>${esc(p.actuator)}</div><div class="ap-row"><span>Made of</span>${esc(p.made)}</div></li>`)
    .join("");
  const pick = (li) => {
    list.querySelectorAll("li").forEach((x) => x.classList.toggle("on", x === li));
    window.robot3d?.highlight(li ? data.parts[+li.dataset.i] : null);
  };
  for (const li of list.querySelectorAll("li")) {
    for (const ev of ["mouseenter", "focus", "click"]) li.addEventListener(ev, () => pick(li));
  }
  list.addEventListener("mouseleave", () => pick(null));
  return data;
}

async function legs() {
  const data = await partList("leg-parts", "/data/legs.json");
  if (!data) return;
  $("leg-stages").innerHTML = data.stages
    .map((s) => `<li><span class="when">${esc(s.when)}</span><b>${esc(s.title)}</b><span>${esc(s.text)}</span></li>`).join("");
}

async function plan() {
  if (!$("plan-list")) return;
  renderPlan(await getJSON("/data/roadmap.json"));
}

function card(c, lane) {
  const img = c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy">` : "";
  return `<div class="card ${lane}${c.done ? " done" : ""}">${img}<div class="ct"><span class="tick"></span>${esc(c.title)}</div><div class="cx">${esc(c.text)}</div></div>`;
}

function renderPlan(road) {
  const L = road.lanes;
  $("lanes-head").innerHTML = ["hardware", "software"]
    .map((k) => `<div class="lane-label ${k}"><b>${esc(L[k].name)}</b> · ${esc(L[k].owner)}</div>`).join("");
  $("plan-progress").textContent = `16 weeks from ${road.start}`;
  $("plan-list").innerHTML = road.steps
    .map((st) => `<li class="${st.hardware.done && st.software.done ? "done" : ""}">${card(st.hardware, "hardware")}<div class="wk"><span>Wk ${esc(st.weeks)}</span></div>${card(st.software, "software")}</li>`)
    .join("");
}

async function showDoc(i) {
  document.querySelectorAll("#doc-tabs button").forEach((b, j) => b.setAttribute("aria-selected", i === j));
  const md = await fetch(DOCS[i][1]).then((r) => (r.ok ? r.text() : "Document not found."));
  $("doc").innerHTML = marked.parse(md);
  $("doc").querySelectorAll("a").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
}

function research() {
  if (!$("doc-tabs")) return;
  $("doc-tabs").innerHTML = DOCS.map(([name], i) => `<button role="tab" data-i="${i}">${esc(name)}</button>`).join("");
  $("doc-tabs").addEventListener("click", (e) => e.target.dataset.i && showDoc(+e.target.dataset.i));
  showDoc(0);
}

document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === location.pathname));
document.querySelectorAll(".moves button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".moves button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  window.robot3d_setMove?.(b.dataset.move);
}));
home(); parts(); partList("arm-parts", "/data/arm.json"); legs(); plan(); research();
