// The AI page: a 3D neural network you can orbit, a live PINN-vs-plain-network demo, and the control loops.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- 1. the neural network in 3D ----------
function network() {
  const host = document.getElementById("nn3d");
  const status = document.getElementById("nn3d-status");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(11, 6, 19);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.6;

  const accent = new THREE.Color(css("--accent") || "#2f5bea");
  const hw = new THREE.Color(css("--hw") || "#e07a2f");
  const good = new THREE.Color(css("--good") || "#1a7f4b");
  const lineCol = new THREE.Color(css("--muted") || "#646a76");

  // layers: inputs (camera grid + joints + words), two hidden layers, outputs (joint commands)
  const layers = [
    { n: 25, grid: 5, x: -7, color: hw },      // camera pixels
    { n: 20, grid: 4, x: -2.5, color: accent },
    { n: 20, grid: 4, x: 2.5, color: accent },
    { n: 8, grid: 0, x: 7, color: good },      // shoulder, elbow, wrist, fingers...
  ];
  const nodes = [];
  const sphere = new THREE.SphereGeometry(0.22, 16, 12);
  layers.forEach((L, li) => {
    const pts = [];
    for (let i = 0; i < L.n; i++) {
      let y, z;
      if (L.grid) { y = (Math.floor(i / L.grid) - (L.grid - 1) / 2) * 1.1; z = ((i % L.grid) - (L.grid - 1) / 2) * 1.1; }
      else { y = (i - (L.n - 1) / 2) * 0.9; z = 0; }
      const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: L.color, emissive: L.color, emissiveIntensity: 0.15 }));
      m.position.set(L.x, y, z);
      scene.add(m);
      pts.push(m);
    }
    nodes.push(pts);
  });
  // connections: every node to a few in the next layer (all-to-all is too dense to read)
  const edges = [];
  const edgeGeo = [];
  for (let li = 0; li < nodes.length - 1; li++) {
    for (const a of nodes[li]) {
      const picks = [...nodes[li + 1]].sort(() => Math.random() - 0.5).slice(0, li === 2 ? 4 : 5);
      for (const b of picks) {
        edgeGeo.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
        edges.push([a, b, li]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(edgeGeo, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: lineCol, transparent: true, opacity: 0.18 })));
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(5, 10, 8); scene.add(sun);

  // labels drawn as sprites
  function label(text, x, y) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96;
    const ctx = c.getContext("2d");
    ctx.font = "600 44px Inter, system-ui, sans-serif"; ctx.fillStyle = css("--text") || "#16181d"; ctx.textAlign = "center";
    ctx.fillText(text, 256, 62);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    s.scale.set(4, 0.75, 1); s.position.set(x, y, 0); scene.add(s);
  }
  label("what it sees", -7, 4.2);
  label("learned layers", 0, 3.6);
  label("its next moves", 7, 4.4);

  // pulses: small glowing dots running along random edges, layer by layer
  const pulseGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const pulses = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(m);
    pulses.push({ m, e: edges[(Math.random() * edges.length) | 0], t: Math.random() });
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  status.remove();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const p of pulses) {
      p.t += dt * (reduce ? 0 : 0.9);
      if (p.t >= 1) {                                    // hand the signal on to an edge leaving where it arrived
        const next = edges.filter((e) => e[0] === p.e[1]);
        p.e = next.length ? next[(Math.random() * next.length) | 0] : edges.filter((e) => e[2] === 0)[(Math.random() * 100) | 0] || edges[0];
        p.t = 0;
        p.e[1].material.emissiveIntensity = 0.9;          // the node lights up
      }
      p.m.position.lerpVectors(p.e[0].position, p.e[1].position, p.t);
      p.m.material.color.copy(p.e[2] === 2 ? good : p.e[2] === 0 ? hw : accent).lerp(new THREE.Color(0xffffff), 0.5);
    }
    for (const L of nodes) for (const n of L) n.material.emissiveIntensity = Math.max(0.15, n.material.emissiveIntensity - dt * 1.5);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------- 2. PINN vs plain network ----------
function pinn() {
  const cv = document.getElementById("pinn"), ctx = cv.getContext("2d");
  const btn = document.getElementById("pinn-toggle"), again = document.getElementById("pinn-noise");
  const G = 9.81, K = 0.35;                              // gravity, drag per unit mass (a light ball)
  const T = 1.1, v0 = [4.2, 5.4], p0 = [0.2, 1.0];
  function flight(v, p, n = 200) {                       // the real physics: a' = g + drag
    const out = []; let [x, y] = p, [vx, vy] = v; const dt = T / n;
    for (let i = 0; i <= n; i++) {
      out.push([x, y]);
      const sp = Math.hypot(vx, vy);
      vx += (-K * sp * vx) * dt; vy += (-G - K * sp * vy) * dt; x += vx * dt; y += vy * dt;
    }
    return out;
  }
  const truth = flight(v0, p0);
  let meas = [], physics = false, anim = 1;
  function measure() {
    meas = [0.08, 0.25, 0.42, 0.58, 0.75, 0.93].map((f) => {
      const [x, y] = truth[Math.round(f * (truth.length - 1))];
      return [x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.4];
    });
    anim = 0;
  }
  function polyFit(pts, deg) {                           // "plain network": fits the points, ignores physics
    const n = deg + 1, A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    for (const [x, y] of pts) for (let r = 0; r < n; r++) { for (let c = 0; c < n; c++) A[r][c] += x ** (r + c); A[r][n] += y * x ** r; }
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]];
      for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c]; }
    }
    const w = A.map((row, i) => row[n] / row[i]);
    return (x) => w.reduce((s, wi, i) => s + wi * x ** i, 0);
  }
  function pinnFit() {                                   // physics-informed: only paths that obey a' = g + drag
    let best = null, bestErr = Infinity;
    for (let vx = 3; vx <= 5.5; vx += 0.05) for (let vy = 4; vy <= 7; vy += 0.05) {
      const path = flight([vx, vy], p0, 120);
      let e = 0;
      for (const [mx, my] of meas) { let d = Infinity; for (const [x, y] of path) d = Math.min(d, (x - mx) ** 2 + (y - my) ** 2); e += d; }
      if (e < bestErr) { bestErr = e; best = path; }
    }
    return best;
  }
  let plain = null, phys = null;
  function recompute() { plain = polyFit(meas, 5); phys = pinnFit(); }
  measure(); recompute();
  const X = (x) => 40 + (x / 3.4) * (cv.width - 70), Y = (y) => cv.height - 40 - (y / 2.9) * (cv.height - 70);
  function draw() {
    anim = Math.min(1, anim + 0.02);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, cv.height - 40); ctx.lineTo(cv.width - 20, cv.height - 40); ctx.stroke();
    ctx.fillStyle = css("--muted"); ctx.font = "13px Inter, sans-serif";
    ctx.fillText("distance →", cv.width - 100, cv.height - 18); ctx.fillText("height", 6, 24);
    // true path, faint
    ctx.setLineDash([4, 6]); ctx.strokeStyle = css("--muted"); ctx.beginPath();
    truth.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); ctx.setLineDash([]);
    // the fit, drawn up to anim
    const end = truth[truth.length - 1][0] * anim;
    ctx.lineWidth = 3;
    if (!physics) {
      ctx.strokeStyle = css("--hw"); ctx.beginPath();
      for (let x = p0[0], i = 0; x <= end; x += 0.02, i++) { const y = plain(x); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
      ctx.stroke();
    } else {
      ctx.strokeStyle = css("--good"); ctx.beginPath();
      phys.filter(([x]) => x <= end).forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (const [x, y] of meas) { ctx.fillStyle = css("--accent"); ctx.beginPath(); ctx.arc(X(x), Y(y), 6, 0, 7); ctx.fill(); }
    ctx.font = "600 14px Inter, sans-serif";
    ctx.fillStyle = physics ? css("--good") : css("--hw");
    ctx.fillText(physics ? "physics-informed: a real arc, right between the points too" : "plain network: hits the points, wrong in between", 50, 26);
    ctx.fillStyle = css("--accent"); ctx.fillText("● measured (noisy)", 50, 48);
    ctx.fillStyle = css("--muted"); ctx.fillText("- - - true flight", 210, 48);
    requestAnimationFrame(draw);
  }
  btn.onclick = () => { physics = !physics; btn.setAttribute("aria-pressed", physics); btn.textContent = `Physics loss: ${physics ? "on" : "off"}`; anim = 0; };
  again.onclick = () => { measure(); recompute(); };
  requestAnimationFrame(draw);
}

// ---------- 3. the control loops ----------
function loops() {
  const cv = document.getElementById("loops"), ctx = cv.getContext("2d");
  const lanes = [
    { name: "Brain  · 3B-parameter robot model (cloud GPU)", hz: 1, col: "--accent" },
    { name: "Checker · vision-language model (Cerebras)", hz: 5, col: "--sw" },
    { name: "Reflex · small learned skill (on the robot)", hz: 50, col: "--good" },
    { name: "Motors · servos", hz: 50, col: "--hw" },
  ];
  let t0 = performance.now();
  function draw(now) {
    const t = reduce ? 0 : (now - t0) / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const left = 330, w = cv.width - left - 20, span = 2;                 // show 2 seconds
    lanes.forEach((L, i) => {
      const y = 40 + i * 64;
      ctx.fillStyle = css("--text"); ctx.font = "600 14px Inter, sans-serif"; ctx.fillText(L.name, 12, y + 5);
      ctx.fillStyle = css("--muted"); ctx.font = "13px Inter, sans-serif";
      ctx.fillText(L.hz === 1 ? "about 1 decision a second" : `${L.hz} times a second`, 12, y + 24);
      ctx.strokeStyle = css("--line"); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + w, y); ctx.stroke();
      const step = 1 / L.hz, phase = t % step;
      for (let s = -phase; s <= span; s += step) {
        if (s < 0) continue;
        const x = left + (s / span) * w;
        const fresh = s < 0.08;
        ctx.fillStyle = css(L.col);
        ctx.globalAlpha = fresh ? 1 : 0.55;
        const h = L.hz === 1 ? 26 : L.hz === 5 ? 18 : 10;
        ctx.fillRect(x - (L.hz >= 50 ? 1 : 3), y - h / 2, L.hz >= 50 ? 2 : 6, h);
        ctx.globalAlpha = 1;
      }
    });
    ctx.fillStyle = css("--muted"); ctx.font = "12px Inter, sans-serif";
    ctx.fillText("now", left - 8, cv.height - 8); ctx.fillText("+2 seconds", left + w - 70, cv.height - 8);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

try { network(); } catch (e) { document.getElementById("nn3d-status").textContent = "3D view needs WebGL."; }
pinn();
loops();
