// --- Config ---
const CONFIG = {
  W: 1100,
  H: 640,
  RECT_COUNT: 8,
  // You need at least 3 * RECT_COUNT arrows to satisfy indegree >= 3 for all.
  ARROW_COUNT: 24,  // safe default for 8 rects; auto-bumped if RECT_COUNT changes
  FLASH_RATE_MIN: 6,
  FLASH_RATE_MAX: 16,
  BG_ALPHA: 26,
  PADDING: 36
};

let cnv;
let shapes, flashing = true, lastFlash = 0, flashInterval = 10;
let resizeObserver;
let labelFirst = 0; // index for "first page"
let labelEnd = 1;   // index for "end page"

function setup() {
  cnv = createCanvas(CONFIG.W, CONFIG.H);
  cnv.parent('canvas-holder');
  pixelDensity(2);
  rectMode(CENTER);
  angleMode(DEGREES);
  textAlign(CENTER, CENTER);
  noCursor();
  initShapes();

  document.getElementById('lockBtn').addEventListener('click', lockIn);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('saveBtn').addEventListener('click', () => saveCanvas('narrative-structure', 'png'));

  resizeObserver = new ResizeObserver(() => centerCanvas());
  resizeObserver.observe(document.getElementById('canvas-holder'));
  centerCanvas();
}

function windowResized(){ centerCanvas(); }
function centerCanvas(){
  const holder = document.getElementById('canvas-holder');
  const scale = Math.min(holder.clientWidth / CONFIG.W, 1);
  cnv.elt.style.width  = (CONFIG.W * scale) + 'px';
  cnv.elt.style.height = (CONFIG.H * scale) + 'px';
}

function initShapes() {
  shapes = {
    rects: Array.from({length: CONFIG.RECT_COUNT}, () => makeRect()),
    arrows: buildArrowBindings(CONFIG.RECT_COUNT, CONFIG.ARROW_COUNT)
  };
  // choose two distinct labeled rectangles
  labelFirst = floor(random(shapes.rects.length));
  labelEnd = (labelFirst + 1 + floor(random(shapes.rects.length - 1))) % shapes.rects.length;

  flashing = true;
  flashInterval = int(random(CONFIG.FLASH_RATE_MIN, CONFIG.FLASH_RATE_MAX));
  lastFlash = 0;
}

// ---- Factories & graph builder ----
function makeRect() {
  return {
    x: random(CONFIG.PADDING, width - CONFIG.PADDING),
    y: random(CONFIG.PADDING, height - CONFIG.PADDING),
    w: random(100, 200),
    h: random(50, 120),
    r: random(0, 360),
    hue: random(190, 260),
    sat: random(30, 90),
    bri: random(50, 95),
    weight: random([2,2,2,3,4])
  };
}

function makeArrowStyle() {
  return {
    head: random(10, 18),
    hue: random(10, 50),
    sat: random(40, 90),
    bri: random(65, 95),
    weight: random([2,2,3,4])
  };
}

/**
 * Build a directed multigraph where each node (rectangle) has:
 *  - indegree >= 3
 *  - outdegree >= 2
 * No self-loops. Duplicate edges are allowed.
 */
function buildArrowBindings(nRect, desiredArrows) {
  const minArrows = nRect * 3; // to satisfy indegree >= 3
  const totalArrows = max(desiredArrows, minArrows);

  const indeg = Array(nRect).fill(0);
  const outdeg = Array(nRect).fill(0);
  const arrows = [];

  // Step 1: Ensure outdegree >= 2 for each node
  for (let i = 0; i < nRect; i++) {
    const targets = new Set();
    while (targets.size < 2) {
      let t = floor(random(nRect));
      if (t !== i) targets.add(t);
    }
    for (const t of targets) {
      arrows.push({ iA: i, iB: t, ...makeArrowStyle() });
      outdeg[i]++; indeg[t]++;
    }
  }

  // Step 2: Ensure indegree >= 3 for each node
  for (let j = 0; j < nRect; j++) {
    while (indeg[j] < 3) {
      let s = floor(random(nRect));
      while (s === j) s = floor(random(nRect));
      arrows.push({ iA: s, iB: j, ...makeArrowStyle() });
      outdeg[s]++; indeg[j]++;
    }
  }

  // Step 3: Add extra random arrows up to totalArrows
  while (arrows.length < totalArrows) {
    let a = floor(random(nRect));
    let b = a;
    while (b === a) b = floor(random(nRect));
    arrows.push({ iA: a, iB: b, ...makeArrowStyle() });
    outdeg[a]++; indeg[b]++;
  }

  return arrows;
}

// ---- Frame loop ----
function draw() {
  background(12, 14, 20, CONFIG.BG_ALPHA);
  drawingContext.save(); drawVignette(); drawingContext.restore();

  if (flashing && frameCount - lastFlash > flashInterval) {
    cycleShapes();
    lastFlash = frameCount;
    flashInterval = int(random(CONFIG.FLASH_RATE_MIN, CONFIG.FLASH_RATE_MAX));
  }

  push(); colorMode(HSB, 360, 100, 100, 100);

  // Draw arrow connections (under)
  shapes.arrows.forEach(drawArrowBetweenRects);

  // Draw rectangles (over), with labels
  shapes.rects.forEach((r, idx) => {
    const isFirst = (idx === labelFirst);
    const isEnd   = (idx === labelEnd);
    drawRect(r, isFirst, isEnd);
  });

  pop();
  drawPointer();
}

// ---- Animation randomization ----
function cycleShapes() {
  // Move/perturb rectangles
  shapes.rects.forEach(r => {
    r.x = constrain(r.x + random(-60, 60), CONFIG.PADDING, width - CONFIG.PADDING);
    r.y = constrain(r.y + random(-40, 40), CONFIG.PADDING, height - CONFIG.PADDING);
    r.w = constrain(r.w + random(-24, 24), 80, 240);
    r.h = constrain(r.h + random(-18, 18), 40, 160);
    r.r = (r.r + random(-30, 30)) % 360;
    r.hue = (r.hue + random(-12, 12) + 360) % 360;
    r.sat = constrain(r.sat + random(-10, 10), 20, 100);
    r.bri = constrain(r.bri + random(-10, 10), 35, 100);
  });

  // Arrow style flicker (bindings remain fixed during flashing)
  shapes.arrows.forEach(a => {
    a.hue = (a.hue + random(-10, 10) + 360) % 360;
    a.sat = constrain(a.sat + random(-8, 8), 25, 100);
    a.bri = constrain(a.bri + random(-8, 8), 35, 100);
    a.weight = constrain(a.weight + random([-1,0,0,1]), 1, 5);
  });
}

// ---- Buttons ----
function lockIn() {
  // Fresh random static config; rebuild arrows with degree constraints
  shapes.rects = shapes.rects.map(() => makeRect());
  shapes.arrows = buildArrowBindings(shapes.rects.length, CONFIG.ARROW_COUNT);

  // Move labels to two NEW distinct rectangles
  let newFirst = floor(random(shapes.rects.length));
  let newEnd   = newFirst;
  while (newEnd === newFirst) newEnd = floor(random(shapes.rects.length));
  labelFirst = newFirst;
  labelEnd   = newEnd;

  flashing = false;
}

function resetAll() { initShapes(); }

// ---- Drawing helpers ----
function drawRect(r, showFirst, showEnd) {
  push();
  translate(r.x, r.y); rotate(r.r);
  stroke(r.hue, r.sat, r.bri, 100);
  strokeWeight(r.weight);
  noFill();
  rect(0, 0, r.w, r.h, 8);

  const ts = max(12, min(28, 0.22 * min(r.w, r.h)));
  noStroke();
  if (showFirst) {
    fill(0, 0, 100, 100); // white
    textSize(ts);
    text('first page', 0, -ts * 0.1);
  }
  if (showEnd) {
    fill(45, 90, 100, 100); // warm highlight
    textSize(ts);
    text('end page', 0, ts * 0.9);
  }
  pop();
}

function drawArrowBetweenRects(a) {
  const RA = shapes.rects[a.iA];
  const RB = shapes.rects[a.iB];
  const pA = edgePointOnRectTowardTarget(RA, RB.x, RB.y);
  const pB = edgePointOnRectTowardTarget(RB, RA.x, RA.y);

  const dx = pB.x - pA.x;
  const dy = pB.y - pA.y;
  const ang = degrees(Math.atan2(dy, dx));
  const len = dist(pA.x, pA.y, pB.x, pB.y);

  push();
  translate(pA.x, pA.y);
  rotate(ang);
  stroke(a.hue, a.sat, a.bri, 100);
  strokeWeight(a.weight);
  noFill();
  line(0, 0, len, 0);
  const h = a.head, hw = h * 0.8;
  triangle(len, 0, len - h, -hw/1.6, len - h, hw/1.6);
  pop();
}

function drawVignette(){
  const g = drawingContext.createRadialGradient(
    width*0.5, height*0.45, width*0.1,
    width*0.5, height*0.45, max(width, height)*0.75
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0,0,width,height);
}

function drawPointer(){
  push(); noFill(); stroke(200, 80); strokeWeight(1.5); circle(mouseX, mouseY, 18); pop();
}

// ---- Geometry: edge point on a rotated rect toward target ----
function edgePointOnRectTowardTarget(r, tx, ty) {
  const cx = r.x, cy = r.y;
  const ang = -r.r;
  const cosA = Math.cos(radians(ang));
  const sinA = Math.sin(radians(ang));
  const dx = tx - cx, dy = ty - cy;
  const lx =  dx * cosA - dy * sinA;
  const ly =  dx * sinA + dy * cosA;

  const hw = r.w / 2, hh = r.h / 2;
  const mag = max(1e-6, Math.hypot(lx, ly));
  const ux = lx / mag, uy = ly / mag;

  const txEdge = (ux === 0) ? Infinity : hw / Math.abs(ux);
  const tyEdge = (uy === 0) ? Infinity : hh / Math.abs(uy);
  const t = Math.min(txEdge, tyEdge);

  const exLocal = ux * t;
  const eyLocal = uy * t;

  const cosB = Math.cos(radians(r.r));
  const sinB = Math.sin(radians(r.r));
  return {
    x: exLocal * cosB - eyLocal * sinB + cx,
    y: exLocal * sinB + eyLocal * cosB + cy
  };
}
