// Physics AI: live PINN demos (noisy data, extrapolation, hidden-parameter discovery, data efficiency),
// a 3D loss landscape, the 3D network and the control loops. Everything is computed in the browser.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// ---------- shared plotting helpers ----------
function axes(ctx, cv, xl, yl) {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = css("--line"); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(48, 20); ctx.lineTo(48, cv.height - 36); ctx.lineTo(cv.width - 16, cv.height - 36); ctx.stroke();
  ctx.fillStyle = css("--muted"); ctx.font = "12px Inter, sans-serif";
  ctx.fillText(xl, cv.width - 16 - ctx.measureText(xl).width, cv.height - 14);
  ctx.save(); ctx.translate(16, 20 + ctx.measureText(yl).width); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore();
}
function legend(ctx, items, x = 60, y = 22) {
  ctx.font = "600 13px Inter, sans-serif";
  for (const [label, col, dashed] of items) {
    ctx.strokeStyle = css(col); ctx.lineWidth = 3; ctx.setLineDash(dashed ? [5, 5] : []);
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 20, y - 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--text"); ctx.fillText(label, x + 26, y);
    x += 34 + ctx.measureText(label).width + 18;
  }
}
function line(ctx, pts, col, width = 3, dashed = false) {
  ctx.strokeStyle = css(col); ctx.lineWidth = width; ctx.setLineDash(dashed ? [5, 5] : []);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
}
function polyFit(pts, deg, ridge = 0) {
  const n = deg + 1, A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (const [x, y] of pts) for (let r = 0; r < n; r++) { for (let c = 0; c < n; c++) A[r][c] += x ** (r + c); A[r][n] += y * x ** r; }
  for (let r = 1; r < n; r++) A[r][r] += ridge;                      // regularized, like a real network's weight decay
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i] / (A[i][i] || 1e-12); for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c]; }
  }
  const w = A.map((row, i) => row[n] / (row[i] || 1e-12));
  return (x) => w.reduce((s, wi, i) => s + wi * x ** i, 0);
}
function loop(fn) { const f = (t) => { fn(t); requestAnimationFrame(f); }; requestAnimationFrame(f); }

// ---------- 0. how a PINN trains (animated diagram) ----------
function flow() {
  const cv = $("pinn-flow"); if (!cv) return; const ctx = cv.getContext("2d");
  const box = (x, y, w, h, title, sub, col) => {
    ctx.fillStyle = css("--surface"); ctx.strokeStyle = css(col); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css("--text"); ctx.font = "600 14px Inter, sans-serif"; ctx.fillText(title, x + 12, y + 24);
    ctx.fillStyle = css("--muted"); ctx.font = "12px Inter, sans-serif"; ctx.fillText(sub, x + 12, y + 44);
  };
  const arrow = (x1, y1, x2, y2, col, t) => {
    ctx.strokeStyle = css(col); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1); ctx.fillStyle = css(col);
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4)); ctx.fill();
    const f = (t % 1); ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 4, 0, 7); ctx.fill();
  };
  loop((ms) => {
    const t = reduce ? 0.5 : ms / 1400;
    ctx.clearRect(0, 0, cv.width, cv.height);
    box(16, 118, 120, 64, "Time, position", "the network's input", "--muted");
    box(186, 118, 130, 64, "Neural network", "predicts the motion", "--accent");
    box(376, 30, 244, 64, "Data error", "vs the few real measurements", "--accent");
    box(376, 206, 244, 64, "Physics error", "a = g + drag, checked everywhere", "--good");
    box(236, 222, 110, 48, "Total score", "", "--hw");
    arrow(136, 150, 186, 150, "--muted", t);
    arrow(316, 138, 376, 62, "--accent", t + 0.3);
    arrow(316, 162, 376, 238, "--good", t + 0.6);
    arrow(376, 90, 320, 222, "--accent", t + 0.1);
    arrow(376, 250, 346, 250, "--good", t + 0.4);
    ctx.setLineDash([4, 5]); arrow(236, 246, 250, 184, "--hw", t + 0.8); ctx.setLineDash([]);
    ctx.fillStyle = css("--hw"); ctx.font = "600 12px Inter, sans-serif"; ctx.fillText("training lowers it", 140, 214);
  });
}

// ---------- 1. noisy measurements of a thrown ball ----------
function flight(v, p, K, n = 200, T = 1.1) {
  const out = []; let [x, y] = p, [vx, vy] = v; const dt = T / n;
  for (let i = 0; i <= n; i++) {
    out.push([x, y]); const sp = Math.hypot(vx, vy);
    vx += -K * sp * vx * dt; vy += (-9.81 - K * sp * vy) * dt; x += vx * dt; y += vy * dt;
  }
  return out;
}
function noisy() {
  const cv = $("pinn"); if (!cv) return; const ctx = cv.getContext("2d");
  const btn = $("pinn-toggle"), again = $("pinn-noise");
  const p0 = [0.2, 1.0], truth = flight([4.2, 5.4], p0, 0.35);
  let meas = [], physics = false, anim = 0, plain, phys;
  const measure = () => {
    meas = [0.08, 0.25, 0.42, 0.58, 0.75, 0.93].map((f) => {
      const [x, y] = truth[Math.round(f * (truth.length - 1))];
      return [x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.4];
    });
    plain = polyFit(meas, 5);
    let best = Infinity;
    for (let vx = 3; vx <= 5.5; vx += 0.05) for (let vy = 4; vy <= 7; vy += 0.05) {
      const path = flight([vx, vy], p0, 0.35, 120); let e = 0;
      for (const [mx, my] of meas) { let d = Infinity; for (const [x, y] of path) d = Math.min(d, (x - mx) ** 2 + (y - my) ** 2); e += d; }
      if (e < best) { best = e; phys = path; }
    }
    anim = 0;
  };
  measure();
  const X = (x) => 48 + (x / 3.4) * (cv.width - 70), Y = (y) => cv.height - 36 - (y / 2.9) * (cv.height - 70);
  loop(() => {
    anim = Math.min(1, anim + 0.02);
    axes(ctx, cv, "distance", "height");
    line(ctx, truth.map(([x, y]) => [X(x), Y(y)]), "--muted", 1.5, true);
    const end = truth[truth.length - 1][0] * anim;
    if (physics) line(ctx, phys.filter(([x]) => x <= end).map(([x, y]) => [X(x), Y(y)]), "--good");
    else { const pts = []; for (let x = p0[0]; x <= end; x += 0.02) pts.push([X(x), Y(plain(x))]); line(ctx, pts, "--hw"); }
    ctx.fillStyle = css("--accent"); for (const [x, y] of meas) { ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, 7); ctx.fill(); }
    legend(ctx, [[physics ? "physics-informed" : "plain network", physics ? "--good" : "--hw"], ["true flight", "--muted", true]]);
  });
  btn.onclick = () => { physics = !physics; btn.setAttribute("aria-pressed", physics); btn.textContent = `Physics: ${physics ? "on" : "off"}`; anim = 0; };
  again.onclick = measure;
}

// ---------- 2. extrapolation: a swinging arm ----------
function pendulum(th0, w0, g_l, c, T, n) {
  const out = []; let th = th0, w = w0; const dt = T / n;
  for (let i = 0; i <= n; i++) { out.push([i * dt, th]); w += (-g_l * Math.sin(th) - c * w) * dt; th += w * dt; }
  return out;
}
function extrap() {
  const cv = $("pinn-extrap"); if (!cv) return; const ctx = cv.getContext("2d");
  const T = 8, SEEN = 2, truth = pendulum(1.0, 0, 9.81 / 0.6, 0.35, T, 800);
  let meas, plain, phys, anim;
  const setup = () => {
    meas = truth.filter(([t]) => t <= SEEN).filter((_, i) => i % 12 === 0).map(([t, th]) => [t, th + (Math.random() - 0.5) * 0.06]);
    plain = polyFit(meas, 6);
    let best = Infinity;                                            // physics fit: start angle + damping from the data
    for (let th0 = 0.85; th0 <= 1.15; th0 += 0.01) for (let c = 0.1; c <= 0.6; c += 0.01) {
      const path = pendulum(th0, 0, 9.81 / 0.6, c, SEEN, 200); let e = 0;
      for (const [t, y] of meas) e += (path[Math.min(200, Math.round(t / SEEN * 200))][1] - y) ** 2;
      if (e < best) { best = e; phys = [th0, c]; }
    }
    phys = pendulum(phys[0], 0, 9.81 / 0.6, phys[1], T, 800);
    anim = 0;
  };
  setup();
  const X = (t) => 48 + (t / T) * (cv.width - 70), Y = (th) => (cv.height - 36) / 2 + 8 - th * ((cv.height - 70) / 2.6);
  loop(() => {
    anim = Math.min(1, anim + (reduce ? 1 : 0.008));
    axes(ctx, cv, "time (s)", "arm angle");
    ctx.fillStyle = css("--accent-soft"); ctx.fillRect(X(0), 20, X(SEEN) - X(0), cv.height - 56);
    ctx.fillStyle = css("--accent"); ctx.font = "600 12px Inter, sans-serif"; ctx.fillText("measured", X(0) + 8, cv.height - 44);
    ctx.fillStyle = css("--muted"); ctx.fillText("never seen: predicted", X(SEEN) + 8, cv.height - 44);
    const tEnd = T * anim;
    line(ctx, truth.filter(([t]) => t <= tEnd).map(([t, y]) => [X(t), Y(y)]), "--muted", 1.5, true);
    const pp = []; for (let t = 0; t <= tEnd; t += 0.02) { const y = Math.max(-1.6, Math.min(1.6, plain(t))); pp.push([X(t), Y(y)]); }
    line(ctx, pp, "--hw");
    line(ctx, phys.filter(([t]) => t <= tEnd).map(([t, y]) => [X(t), Y(y)]), "--good");
    ctx.fillStyle = css("--accent"); for (const [t, y] of meas) { ctx.beginPath(); ctx.arc(X(t), Y(y), 4, 0, 7); ctx.fill(); }
    legend(ctx, [["plain network", "--hw"], ["physics-informed", "--good"], ["real motion", "--muted", true]]);
  });
  $("extrap-play").onclick = setup;
}

// ---------- 3. inverse problem: discover the drag ----------
function inverse() {
  const cv = $("pinn-inverse"); if (!cv) return; const ctx = cv.getContext("2d");
  const TRUE_K = 0.42, p0 = [0.2, 1.0], v0 = [4.4, 5.6];
  let meas, k, hist, step, delta;
  const setup = () => {
    const tr = flight(v0, p0, TRUE_K, 200);
    meas = tr.filter((_, i) => i % 20 === 5).map(([x, y]) => [x + (Math.random() - 0.5) * 0.04, y + (Math.random() - 0.5) * 0.04]);
    k = 0.02; hist = [k]; step = 0; delta = 0.08;
  };
  const err = (kk) => { const path = flight(v0, p0, kk, 200); let e = 0; meas.forEach((m, j) => { const [x, y] = path[j * 20 + 5]; e += (x - m[0]) ** 2 + (y - m[1]) ** 2; }); return e; };
  setup();
  const X = (x) => 48 + (x / 3.4) * (cv.width * 0.62 - 70), Y = (y) => cv.height - 36 - (y / 2.9) * (cv.height - 70);
  let last = 0;
  loop((ms) => {
    if (ms - last > (reduce ? 0 : 60) && step < 60) {                 // one gradient step every 60 ms
      last = ms;
      // move toward lower error; shrink the step whenever it would overshoot (settles smoothly)
      const e0 = err(k), up = err(k + delta), dn = err(Math.max(0, k - delta));
      if (up < e0 && up <= dn) k += delta; else if (dn < e0) k = Math.max(0, k - delta); else delta *= 0.5;
      hist.push(k); step++;
    }
    axes(ctx, cv, "distance", "height");
    line(ctx, flight(v0, p0, TRUE_K, 200).map(([x, y]) => [X(x), Y(y)]), "--muted", 1.5, true);
    line(ctx, flight(v0, p0, k, 200).map(([x, y]) => [X(x), Y(y)]), "--good");
    ctx.fillStyle = css("--accent"); for (const [x, y] of meas) { ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, 7); ctx.fill(); }
    // right panel: the estimate converging
    const L = cv.width * 0.66, R = cv.width - 20, top = 60, bot = cv.height - 60;
    ctx.fillStyle = css("--text"); ctx.font = "600 13px Inter, sans-serif"; ctx.fillText("estimated air drag", L, 40);
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 1; ctx.strokeRect(L, top, R - L, bot - top);
    const ky = (v) => bot - (v / 0.6) * (bot - top);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = css("--muted"); ctx.beginPath(); ctx.moveTo(L, ky(TRUE_K)); ctx.lineTo(R, ky(TRUE_K)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css("--muted"); ctx.font = "12px Inter, sans-serif"; ctx.fillText(`true ${TRUE_K.toFixed(2)}`, L + 6, ky(TRUE_K) - 6);
    line(ctx, hist.map((v, i) => [L + (i / 60) * (R - L), ky(v)]), "--good", 2.5);
    ctx.fillStyle = css("--good"); ctx.font = "700 22px Inter, sans-serif"; ctx.fillText(k.toFixed(3), L, bot + 32);
    ctx.fillStyle = css("--muted"); ctx.font = "12px Inter, sans-serif"; ctx.fillText(`training step ${step}`, L + 80, bot + 30);
    legend(ctx, [["predicted path", "--good"], ["real flight", "--muted", true]]);
  });
  $("inverse-play").onclick = setup;
}

// ---------- 4. accuracy vs number of measurements (computed live) ----------
function dataChart() {
  const cv = $("pinn-data"); if (!cv) return; const ctx = cv.getContext("2d");
  const G = 9.81, T = 1.0, v0 = [3.5, 5.0], y0 = 1.0;
  const ys = (t) => y0 + v0[1] * t - 0.5 * G * t * t;                    // truth (height vs time)
  const grid = Array.from({ length: 101 }, (_, i) => (i / 100) * T);
  const Ns = [2, 3, 4, 5, 6, 8, 10, 12, 16];
  const res = Ns.map((n) => {
    let ep = 0, eq = 0; const trials = 300;
    for (let r = 0; r < trials; r++) {
      const ts = Array.from({ length: n }, () => Math.random() * T * 0.6);   // measurements only early in flight
      const pts = ts.map((t) => [t, ys(t) + (Math.random() - 0.5) * 0.2]);
      const f = polyFit(pts, 4, 0.02);
      // physics: y = y0 + v t - g t^2 / 2, only v unknown -> least squares
      let num = 0, den = 0; for (const [t, y] of pts) { num += (y - y0 + 0.5 * G * t * t) * t; den += t * t; }
      const v = num / (den || 1e-9);
      for (const t of grid) { ep += Math.min(4, Math.abs(f(t) - ys(t))); eq += Math.abs(y0 + v * t - 0.5 * G * t * t - ys(t)); }
    }
    return [n, ep / (trials * grid.length), eq / (trials * grid.length)];
  });
  const maxE = Math.max(...res.map((r) => r[1]));
  const X = (n) => 48 + ((n - 2) / 14) * (cv.width - 80), Y = (e) => cv.height - 36 - (e / maxE) * (cv.height - 80);
  axes(ctx, cv, "number of real measurements", "prediction error");
  line(ctx, res.map(([n, e]) => [X(n), Y(e)]), "--hw");
  line(ctx, res.map(([n, , e]) => [X(n), Y(e)]), "--good");
  for (const [n, a, b] of res) {
    ctx.fillStyle = css("--hw"); ctx.beginPath(); ctx.arc(X(n), Y(a), 4, 0, 7); ctx.fill();
    ctx.fillStyle = css("--good"); ctx.beginPath(); ctx.arc(X(n), Y(b), 4, 0, 7); ctx.fill();
    ctx.fillStyle = css("--muted"); ctx.font = "11px Inter, sans-serif"; ctx.fillText(String(n), X(n) - 4, cv.height - 22);
  }
  legend(ctx, [["plain network", "--hw"], ["physics-informed", "--good"]]);
}

// ---------- 5. loss landscape in 3D ----------
function landscape() {
  const host = $("landscape"); if (!host) return;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(6, 6.5, 8);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.8;
  const N = 90, geo = new THREE.PlaneGeometry(8, 8, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, base = new Float32Array(pos.count), bumpy = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    base[i] = 0.07 * ((x - 0.8) ** 2 + (z + 0.5) ** 2);
    bumpy[i] = 0.018 * ((x - 0.8) ** 2 + (z + 0.5) ** 2) + 0.45 * Math.sin(1.7 * x) * Math.cos(1.5 * z) + 0.3 * Math.sin(0.9 * x + 2.3 * z) + 0.9;
  }
  const colors = new Float32Array(pos.count * 3); geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, flatShading: false });
  const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: css("--muted") || "#888", transparent: true, opacity: 0.08 }));
  scene.add(wire);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), new THREE.MeshStandardMaterial({ color: css("--hw") || "#e07a2f" }));
  scene.add(ball);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7)); const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(4, 10, 6); scene.add(sun);
  const lo = new THREE.Color(css("--good") || "#1a7f4b"), hi = new THREE.Color(css("--accent") || "#2f5bea");
  let mix = 0, target = 0;
  const heightAt = (x, z) => {                                        // for the rolling ball
    const b = 0.07 * ((x - 0.8) ** 2 + (z + 0.5) ** 2), u = 0.018 * ((x - 0.8) ** 2 + (z + 0.5) ** 2) + 0.45 * Math.sin(1.7 * x) * Math.cos(1.5 * z) + 0.3 * Math.sin(0.9 * x + 2.3 * z) + 0.9;
    return u + (b - u) * mix;
  };
  let bx = -3.2, bz = 3.0;
  const resetBall = () => { bx = -3.2; bz = 3.0; };
  const btn = $("land-toggle");
  btn.onclick = () => { target = target ? 0 : 1; btn.setAttribute("aria-pressed", !!target); btn.textContent = `Physics: ${target ? "on" : "off"}`; resetBall(); };
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize(); $("landscape-status").remove();
  loop(() => {
    mix += (target - mix) * 0.06;
    let mn = Infinity, mxv = -Infinity;
    for (let i = 0; i < pos.count; i++) { const y = bumpy[i] + (base[i] - bumpy[i]) * mix; pos.setY(i, y); mn = Math.min(mn, y); mxv = Math.max(mxv, y); }
    for (let i = 0; i < pos.count; i++) { const c = lo.clone().lerp(hi, (pos.getY(i) - mn) / (mxv - mn || 1)); colors.set([c.r, c.g, c.b], i * 3); }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
    wire.geometry.dispose(); wire.geometry = new THREE.WireframeGeometry(geo);
    // gradient descent for the ball
    const e = 0.01, gx = (heightAt(bx + e, bz) - heightAt(bx - e, bz)) / (2 * e), gz = (heightAt(bx, bz + e) - heightAt(bx, bz - e)) / (2 * e);
    if (!reduce) { bx = Math.max(-3.9, Math.min(3.9, bx - 0.05 * gx)); bz = Math.max(-3.9, Math.min(3.9, bz - 0.05 * gz)); }
    ball.position.set(bx, heightAt(bx, bz) + 0.16, bz);
    controls.update(); renderer.render(scene, camera);
  });
}

// ---------- 6. the network in 3D ----------
function network() {
  const host = $("nn3d"); if (!host) return;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(11, 6, 19);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.6;
  const accent = new THREE.Color(css("--accent") || "#2f5bea"), hw = new THREE.Color(css("--hw") || "#e07a2f"), good = new THREE.Color(css("--good") || "#1a7f4b");
  const layers = [{ n: 25, grid: 5, x: -7, color: hw }, { n: 20, grid: 4, x: -2.5, color: accent }, { n: 20, grid: 4, x: 2.5, color: accent }, { n: 8, grid: 0, x: 7, color: good }];
  const nodes = [], sphere = new THREE.SphereGeometry(0.22, 16, 12);
  layers.forEach((L) => {
    const pts = [];
    for (let i = 0; i < L.n; i++) {
      const y = L.grid ? (Math.floor(i / L.grid) - (L.grid - 1) / 2) * 1.1 : (i - (L.n - 1) / 2) * 0.9;
      const z = L.grid ? ((i % L.grid) - (L.grid - 1) / 2) * 1.1 : 0;
      const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: L.color, emissive: L.color, emissiveIntensity: 0.15 }));
      m.position.set(L.x, y, z); scene.add(m); pts.push(m);
    }
    nodes.push(pts);
  });
  const edges = [], eg = [];
  for (let li = 0; li < nodes.length - 1; li++) for (const a of nodes[li]) {
    for (const b of [...nodes[li + 1]].sort(() => Math.random() - 0.5).slice(0, 5)) { eg.push(...a.position.toArray(), ...b.position.toArray()); edges.push([a, b, li]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(eg, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: css("--muted") || "#888", transparent: true, opacity: 0.18 })));
  scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(5, 10, 8); scene.add(sun);
  const label = (text, x, y) => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96; const cx = c.getContext("2d");
    cx.font = "600 44px Inter, sans-serif"; cx.fillStyle = css("--text") || "#16181d"; cx.textAlign = "center"; cx.fillText(text, 256, 62);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); s.scale.set(4, 0.75, 1); s.position.set(x, y, 0); scene.add(s);
  };
  label("what it sees", -7, 4.2); label("learned layers", 0, 3.6); label("its next moves", 7, 4.4);
  const pg = new THREE.SphereGeometry(0.12, 10, 8), pulses = [];
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(m); pulses.push({ m, e: edges[(Math.random() * edges.length) | 0], t: Math.random() }); }
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize(); $("nn3d-status").remove();
  let last = performance.now();
  loop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const p of pulses) {
      p.t += dt * (reduce ? 0 : 0.9);
      if (p.t >= 1) { const next = edges.filter((e) => e[0] === p.e[1]); p.e = next.length ? next[(Math.random() * next.length) | 0] : edges[(Math.random() * 120) | 0]; p.t = 0; p.e[1].material.emissiveIntensity = 0.9; }
      p.m.position.lerpVectors(p.e[0].position, p.e[1].position, p.t);
      p.m.material.color.copy(p.e[2] === 2 ? good : p.e[2] === 0 ? hw : accent).lerp(new THREE.Color(0xffffff), 0.5);
    }
    for (const L of nodes) for (const n of L) n.material.emissiveIntensity = Math.max(0.15, n.material.emissiveIntensity - dt * 1.5);
    controls.update(); renderer.render(scene, camera);
  });
}

// ---------- 7. control loops ----------
function loops() {
  const cv = $("loops"); if (!cv) return; const ctx = cv.getContext("2d");
  const lanes = [["Brain · robot foundation model", 1, "--accent"], ["Checker · vision-language model", 5, "--sw"], ["Reflex · learned skill on the robot", 50, "--good"], ["Motors · servos", 50, "--hw"]];
  const t0 = performance.now();
  loop((now) => {
    const t = reduce ? 0 : (now - t0) / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const left = 330, w = cv.width - left - 20, span = 2;
    lanes.forEach(([name, hz, col], i) => {
      const y = 40 + i * 64;
      ctx.fillStyle = css("--text"); ctx.font = "600 14px Inter, sans-serif"; ctx.fillText(name, 12, y + 5);
      ctx.fillStyle = css("--muted"); ctx.font = "13px Inter, sans-serif"; ctx.fillText(hz === 1 ? "about once a second" : `${hz} times a second`, 12, y + 24);
      ctx.strokeStyle = css("--line"); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + w, y); ctx.stroke();
      const step = 1 / hz;
      for (let s = step - (t % step); s <= span; s += step) {
        const x = left + (s / span) * w, h = hz === 1 ? 26 : hz === 5 ? 18 : 10;
        ctx.fillStyle = css(col); ctx.globalAlpha = s < 0.08 ? 1 : 0.55; ctx.fillRect(x - (hz >= 50 ? 1 : 3), y - h / 2, hz >= 50 ? 2 : 6, h); ctx.globalAlpha = 1;
      }
    });
    ctx.fillStyle = css("--muted"); ctx.font = "12px Inter, sans-serif"; ctx.fillText("now", left - 8, cv.height - 8); ctx.fillText("+2 seconds", left + w - 70, cv.height - 8);
  });
}

for (const f of [flow, noisy, extrap, inverse, dataChart, loops]) { try { f(); } catch (e) { console.error(e); } }
for (const [f, s] of [[landscape, "landscape-status"], [network, "nn3d-status"]]) { try { f(); } catch (e) { const el = $(s); if (el) el.textContent = "3D view needs WebGL."; } }
