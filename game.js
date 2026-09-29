/* cathedral-builder — bundled from readable ES modules; see LICENSE for attribution. */
(() => {
  // cathedral-builder/js/engine.js
  var engine = {
    canvas: null,
    ctx: null,
    dpr: 1,
    width: 0,
    height: 0,
    groups: {},
    scene: null,
    onResize: null,
    onPointerDown: null,
    hoverable: false,
    // Pointer state for the current update step
    input: { queue: [], clicked: false, x: -9999, y: -9999, hoverX: -9999, hoverY: -9999 },
    // Game clock (ms), paused while the page is hidden
    _pausedTotal: 0,
    _hiddenAt: 0,
    now() {
      const t = this._hiddenAt || performance.now();
      return t - this._pausedTotal;
    },
    init(canvas2) {
      this.canvas = canvas2;
      this.ctx = canvas2.getContext("2d");
      const resize = () => this.resize();
      window.addEventListener("resize", resize);
      window.addEventListener("orientationchange", () => setTimeout(resize, 150));
      if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
      canvas2.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (this.onPointerDown) this.onPointerDown();
        const p = this.toCanvas(e);
        this.input.queue.push(p);
        if (this.input.queue.length > 20) this.input.queue.shift();
        this.input.hoverX = p.x;
        this.input.hoverY = p.y;
      });
      canvas2.addEventListener("pointermove", (e) => {
        const p = this.toCanvas(e);
        this.input.hoverX = p.x;
        this.input.hoverY = p.y;
      });
      canvas2.addEventListener("pointerleave", () => {
        this.input.hoverX = -9999;
        this.input.hoverY = -9999;
      });
      canvas2.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this._hiddenAt = performance.now();
        } else if (this._hiddenAt) {
          this._pausedTotal += performance.now() - this._hiddenAt;
          this._hiddenAt = 0;
          this._last = performance.now();
        }
      });
      this.resize();
    },
    toCanvas(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },
    resize() {
      const w = Math.max(1, Math.round(this.canvas.clientWidth || window.innerWidth));
      const h = Math.max(1, Math.round(this.canvas.clientHeight || window.innerHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      if (w === this.width && h === this.height && dpr === this.dpr) return;
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      if (this.onResize) this.onResize(w, h, dpr);
    },
    setGroup(name, x, y, scale) {
      this.groups[name] = { x, y, scale };
    },
    // Apply the transform of a group to the context
    use(name) {
      const g = this.groups[name];
      const d = this.dpr;
      this.ctx.setTransform(d * g.scale, 0, 0, d * g.scale, d * g.x, d * g.y);
      return this.ctx;
    },
    // Screen rectangle of a box given in group coordinates
    toScreen(name, x, y, w, h) {
      const g = this.groups[name];
      return { x: g.x + x * g.scale, y: g.y + y * g.scale, w: w * g.scale, h: h * g.scale };
    },
    // Is a point (screen coords) inside a box centered on (cx, cy) in group coords?
    inside(name, px, py, cx, cy, w, h, pad = 0) {
      const g = this.groups[name];
      if (!g) return false;
      const lx = (px - g.x) / g.scale;
      const ly = (py - g.y) / g.scale;
      const p = pad / g.scale;
      return lx >= cx - w / 2 - p && lx <= cx + w / 2 + p && ly >= cy - h / 2 - p && ly <= cy + h / 2 + p;
    },
    // Clicked during this update step?
    clicked(name, cx, cy, w, h, pad = 0) {
      return this.input.clicked && this.inside(name, this.input.x, this.input.y, cx, cy, w, h, pad);
    },
    // Mouse over (for the cursor only)
    hover(name, cx, cy, w, h, pad = 0) {
      if (this.inside(name, this.input.hoverX, this.input.hoverY, cx, cy, w, h, pad)) this.hoverable = true;
    },
    start(scene) {
      this.scene = scene;
      if (scene.start) scene.start();
      this._last = performance.now();
      this._acc = 0;
      const step = 1e3 / 60;
      const frame = (t) => {
        requestAnimationFrame(frame);
        if (document.hidden) return;
        this._acc += Math.min(250, Math.max(0, t - this._last));
        this._last = t;
        let steps = 0;
        while (this._acc >= step && steps < 5) {
          this._acc -= step;
          steps++;
          const click = this.input.queue.shift();
          this.input.clicked = !!click;
          if (click) {
            this.input.x = click.x;
            this.input.y = click.y;
          }
          this.scene.update();
        }
        if (steps === 5) this._acc = 0;
        this.hoverable = false;
        this.scene.draw(this.ctx);
        this.canvas.style.cursor = this.hoverable ? "pointer" : "default";
      };
      requestAnimationFrame(frame);
    },
    changeScene(scene) {
      this.scene = scene;
      this.input.queue.length = 0;
      if (scene.start) scene.start();
    }
  };

  // cathedral-builder/js/blueprint.js
  function arch(xStart, xEnd, height) {
    const r = [];
    let y = height;
    r.push([xStart, xEnd, 0, 0]);
    r.push([xStart, xStart, 1, height]);
    for (let x = xStart + 1; x < xEnd; x += 1) {
      if (x <= xEnd - (xEnd - xStart) / 2) {
        y += 1;
      } else {
        y -= 1;
      }
      r.push([x, x, y, y]);
    }
    r.push([xEnd, xEnd, 1, height]);
    return r;
  }
  var full = (x) => [[x, x, 0, 0], [x, x, 18, 23], [x, x, 39, 46], [x, x, 59, 60]];
  var empty = (x) => [[x, x, 0, 0], [x, x, 18, 18], [x, x, 23, 23], [x, x, 39, 39], [x, x, 46, 46], [x, x, 59, 60]];
  var fullM = (x) => [[x, x, 0, 0], [x, x, 18, 23], [x, x, 39, 46]];
  var emptyM = (x) => [[x, x, 0, 0], [x, x, 18, 18], [x, x, 23, 23], [x, x, 39, 39], [x, x, 46, 46]];
  function buildBlueprint() {
    const endOfChor = [[20, 40, 0, 0], [20, 22, 1, 13], [21, 22, 14, 14], [22, 22, 15, 19], [23, 23, 20, 20], [24, 24, 21, 21], [25, 25, 22, 22], [26, 26, 23, 23], [27, 27, 24, 24], [28, 28, 25, 25], [29, 31, 25, 33], [32, 32, 25, 25], [33, 33, 24, 24], [34, 34, 23, 23], [35, 35, 22, 22], [36, 36, 21, 21], [37, 37, 20, 20], [38, 38, 1, 19], [39, 39, 1, 15], [40, 40, 1, 14]];
    const navePilar = [[11, 49, 0, 0], [11, 12, 1, 13], [12, 12, 14, 14], [13, 14, 1, 19], [11, 15, 20, 20], [12, 15, 21, 21], [13, 15, 22, 22], [14, 16, 23, 23], [15, 16, 24, 33], [16, 16, 24, 34], [17, 17, 25, 26], [17, 17, 34, 35], [18, 18, 26, 27], [18, 18, 35, 36], [19, 19, 25, 28], [19, 19, 36, 37], [20, 20, 23, 29], [20, 20, 37, 38], [21, 21, 20, 30], [21, 21, 38, 39], [22, 22, 1, 42], [21, 21, 43, 43], [22, 22, 43, 44], [23, 23, 1, 45], [24, 24, 38, 46], [25, 25, 42, 47], [26, 26, 45, 48], [27, 27, 47, 49], [28, 28, 49, 50], [29, 29, 50, 51], [30, 30, 51, 52], [31, 31, 50, 51], [32, 32, 49, 50], [33, 33, 47, 49], [34, 34, 45, 48], [35, 35, 42, 47], [36, 36, 38, 46], [37, 37, 1, 45], [38, 38, 1, 44], [39, 39, 20, 30], [39, 39, 38, 39], [39, 39, 43, 43], [40, 40, 23, 29], [40, 40, 37, 38], [41, 41, 25, 28], [41, 41, 36, 37], [42, 42, 26, 27], [42, 42, 35, 36], [43, 43, 25, 26], [43, 43, 34, 35], [44, 44, 23, 34], [45, 45, 20, 33], [46, 46, 1, 23], [47, 47, 1, 22], [48, 48, 1, 14], [48, 48, 20, 21], [49, 49, 1, 13], [49, 49, 20, 20]];
    const nave = [[13, 47, 0, 0], [11, 11, 20, 20], [12, 12, 20, 21], [13, 13, 1, 22], [14, 14, 22, 23], [15, 15, 23, 24], [16, 16, 24, 25], [17, 17, 25, 26], [18, 18, 26, 27], [19, 19, 27, 28], [20, 20, 28, 29], [21, 21, 29, 30], [21, 21, 43, 43], [22, 22, 30, 44], [23, 23, 44, 45], [24, 24, 45, 46], [25, 25, 46, 47], [26, 26, 47, 48], [27, 27, 48, 49], [28, 28, 49, 50], [29, 29, 50, 51], [30, 30, 51, 52], [31, 31, 50, 51], [32, 32, 49, 50], [33, 33, 48, 49], [34, 34, 47, 48], [35, 35, 46, 47], [36, 36, 45, 46], [37, 37, 44, 45], [38, 38, 30, 44], [39, 39, 43, 43], [39, 39, 29, 30], [40, 40, 28, 29], [41, 41, 27, 28], [42, 42, 26, 27], [43, 43, 25, 26], [44, 44, 24, 25], [45, 45, 23, 24], [46, 46, 22, 23], [47, 47, 1, 22], [48, 48, 20, 21], [49, 49, 20, 20]];
    const endNave = [[11, 11, 20, 20], [12, 12, 20, 21], [13, 47, 0, 0], [13, 13, 1, 22], [14, 14, 1, 23], [15, 15, 20, 24], [16, 16, 21, 25], [17, 17, 22, 26], [18, 18, 23, 27], [19, 19, 24, 28], [20, 20, 25, 29], [21, 21, 26, 30], [21, 21, 43, 43], [22, 22, 27, 44], [23, 23, 28, 45], [24, 24, 29, 46], [25, 25, 30, 47], [26, 26, 31, 48], [27, 27, 32, 49], [28, 28, 33, 50], [29, 29, 34, 51], [30, 30, 35, 52], [31, 31, 34, 51], [32, 32, 33, 50], [33, 33, 32, 49], [34, 34, 31, 48], [35, 35, 30, 47], [36, 36, 29, 46], [37, 37, 28, 45], [38, 38, 27, 44], [39, 39, 26, 30], [39, 39, 43, 43], [40, 40, 25, 29], [41, 41, 24, 28], [42, 42, 23, 27], [43, 43, 22, 26], [44, 44, 21, 25], [45, 45, 20, 24], [46, 46, 1, 23], [47, 47, 1, 22], [48, 48, 20, 21], [49, 49, 20, 20]];
    const tower = [[11, 49, 0, 0], [11, 12, 1, 60], [22, 23, 1, 60], [37, 38, 1, 60], [48, 49, 1, 60]];
    const layers = [
      [[26, 34, 0, 6], [26, 27, 7, 19], [27, 27, 20, 20], [28, 28, 17, 21], [29, 29, 18, 22], [30, 30, 19, 23], [31, 31, 18, 22], [32, 32, 17, 21], [33, 34, 7, 19], [33, 33, 20, 20]],
      // 119
      arch(25, 35, 19),
      // 118
      arch(24, 36, 19),
      // 117
      arch(23, 37, 19),
      // 116
      arch(22, 38, 19),
      // 115
      arch(22, 38, 19),
      // 114
      arch(22, 38, 19),
      // 113
      arch(22, 38, 19),
      // 112
      endOfChor,
      // 111
      endOfChor,
      // 110
      arch(21, 39, 19).concat([[29, 31, 34, 35]]),
      // 109
      arch(20, 40, 19).concat([[29, 31, 35, 36]]),
      // 108
      arch(19, 41, 19).concat([[29, 31, 36, 37]]),
      // 107
      arch(18, 42, 19).concat([[29, 31, 37, 38]]),
      // 106
      arch(17, 43, 19).concat([[29, 31, 38, 39]]),
      // 105
      arch(16, 44, 19).concat([[29, 31, 39, 40]]),
      // 104
      arch(15, 45, 19).concat([[29, 31, 40, 41]]),
      // 103
      endNave,
      navePilar,
      // 104
      navePilar,
      // 103
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      //97
      navePilar,
      navePilar,
      //95
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      //89
      navePilar,
      navePilar,
      //87
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      //81
      navePilar,
      navePilar,
      // 79
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 73
      navePilar,
      navePilar,
      // 71
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 55
      navePilar,
      navePilar,
      // 53
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 47
      navePilar,
      navePilar,
      // 45
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 39
      navePilar,
      navePilar,
      // 37
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 31
      navePilar,
      navePilar,
      // 29
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 23
      navePilar,
      navePilar,
      // 21
      nave,
      nave,
      nave,
      nave,
      nave,
      nave,
      // 15
      navePilar,
      navePilar,
      // 13
      nave,
      nave,
      nave,
      nave,
      // 9
      endNave,
      //8
      [[11, 49, 0, 0], [11, 12, 1, 60], [13, 21, 23, 60], [22, 23, 1, 60], [24, 36, 23, 46], [37, 38, 1, 60], [39, 47, 23, 60], [48, 49, 1, 60]],
      //7
      tower,
      tower,
      tower,
      tower,
      //3
      [[11, 49, 0, 0], [11, 13, 1, 60], [13, 15, 1, 46], [13, 13, 47, 60], [14, 14, 55, 60], [15, 15, 56, 60], [16, 18, 7, 23], [16, 18, 31, 46], [16, 16, 55, 60], [17, 17, 47, 60], [18, 18, 55, 60], [19, 23, 1, 46], [19, 19, 56, 60], [20, 20, 55, 60], [21, 23, 1, 60], [24, 26, 1, 46], [27, 33, 7, 27], [27, 27, 28, 29], [27, 27, 33, 46], [28, 28, 28, 28], [28, 28, 34, 46], [29, 31, 35, 46], [32, 32, 28, 28], [32, 32, 34, 46], [33, 33, 28, 29], [33, 33, 33, 46], [34, 36, 1, 46], [37, 39, 1, 60], [40, 41, 1, 46], [40, 40, 55, 60], [41, 41, 56, 60], [42, 44, 7, 23], [42, 44, 31, 46], [42, 42, 55, 60], [43, 43, 47, 60], [44, 44, 55, 60], [45, 47, 1, 46], [45, 45, 56, 60], [46, 46, 55, 60], [47, 47, 47, 60], [48, 49, 1, 60]],
      //2
      [[11, 49, 0, 0], [11, 13, 1, 60], [14, 14, 5, 23], [14, 14, 28, 46], [14, 14, 55, 60], [15, 15, 8, 23], [15, 15, 31, 46], [15, 15, 56, 60], [16, 16, 10, 23], [16, 16, 33, 46], [16, 16, 55, 60], [17, 17, 11, 23], [17, 17, 34, 60], [18, 18, 10, 23], [18, 18, 33, 46], [18, 18, 55, 60], [19, 19, 8, 23], [19, 19, 31, 46], [19, 19, 56, 60], [20, 20, 5, 23], [20, 20, 28, 46], [20, 20, 55, 60], [21, 23, 1, 60], [24, 24, 1, 46], [25, 25, 5, 46], [26, 26, 8, 29], [26, 26, 33, 46], [27, 27, 11, 28], [27, 27, 34, 46], [28, 28, 13, 27], [28, 28, 35, 46], [29, 29, 14, 26], [29, 29, 36, 46], [30, 30, 15, 26], [30, 30, 36, 46], [31, 31, 14, 26], [31, 31, 36, 46], [32, 32, 13, 27], [32, 32, 35, 46], [33, 33, 11, 28], [33, 33, 34, 46], [34, 34, 8, 29], [34, 34, 33, 46], [35, 35, 5, 46], [36, 36, 1, 46], [37, 39, 1, 60], [40, 40, 5, 23], [40, 40, 28, 46], [40, 40, 55, 60], [41, 41, 8, 23], [41, 41, 31, 46], [41, 41, 56, 60], [42, 42, 10, 23], [42, 42, 33, 46], [42, 42, 55, 60], [43, 43, 11, 23], [43, 43, 34, 60], [44, 44, 10, 23], [44, 44, 33, 46], [44, 44, 55, 60], [45, 45, 8, 23], [45, 45, 31, 46], [45, 45, 56, 60], [46, 46, 5, 23], [46, 46, 28, 46], [46, 46, 55, 60], [47, 49, 1, 60]],
      //1
      [[11, 12, 0, 60]].concat(empty(13), full(14), empty(15), full(16), empty(17), full(18), empty(19), full(20), empty(21), [[22, 23, 0, 60]], emptyM(24), fullM(25), emptyM(26), fullM(27), emptyM(28), fullM(29), emptyM(30), fullM(31), emptyM(32), fullM(33), emptyM(34), fullM(35), emptyM(36), [[37, 38, 0, 60]], empty(39), full(40), empty(41), full(42), empty(43), full(44), empty(45), full(46), empty(47), [[48, 49, 0, 60]])
    ];
    const stones = [];
    let z = 120;
    for (const layer of layers) {
      for (const wall of layer) {
        for (let y = wall[2]; y <= wall[3]; y += 1) {
          for (let x = wall[0]; x <= wall[1]; x += 1) {
            stones.push({ x, y, z });
          }
        }
      }
      z -= 1;
    }
    return stones;
  }

  // cathedral-builder/js/cathedral.js
  var CATHEDRAL_WIDTH = 830;
  var CATHEDRAL_HEIGHT = 630;
  var VANISHING_POINT = { x: 965, y: 0 };
  var STONE = { x: 10, y: 10, z: 0.25 };
  var COLORS = { light: "#FFDDCA", mid: "#876552", dark: "#411F0C" };
  var LAYERS = [
    { zOffset: 110, from: 0 },
    { zOffset: 90, from: 800 },
    { zOffset: 50, from: 5500 },
    { zOffset: 0, from: 16e3 }
  ];
  var BACKGROUND_STONES_PER_FRAME = 400;
  function project(x, y, z) {
    const depth = Math.log10(1 + z / 10);
    return [x - depth * (x - VANISHING_POINT.x), y - depth * (y - VANISHING_POINT.y)];
  }
  function face(ctx, points, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.fill();
    ctx.stroke();
  }
  function drawStone(ctx, stone, zOffset) {
    const x = stone.x * STONE.x;
    const y = CATHEDRAL_HEIGHT - stone.y * STONE.y;
    const z = (stone.z - zOffset) * STONE.z;
    const w = STONE.x, h = STONE.y, d = STONE.z;
    const fTL = project(x, y - h, z), fDL = project(x, y, z);
    const fDR = project(x + w, y, z), fTR = project(x + w, y - h, z);
    const bTL = project(x, y - h, z + d), bDL = project(x, y, z + d);
    const bDR = project(x + w, y, z + d), bTR = project(x + w, y - h, z + d);
    face(ctx, [fTL, fDL, fDR, fTR], COLORS.light, COLORS.mid);
    if (y - h / 2 > VANISHING_POINT.y) face(ctx, [fTL, fTR, bTR, bTL], COLORS.light, COLORS.mid);
    else face(ctx, [fDL, bDL, bDR, fDR], COLORS.mid, COLORS.dark);
    if (x + w / 2 > VANISHING_POINT.x) face(ctx, [fDL, bDL, bTL, fTL], COLORS.light, COLORS.mid);
    else face(ctx, [fTR, fDR, bDR, bTR], COLORS.mid, COLORS.dark);
  }
  var cathedral = {
    stones: buildBlueprint(),
    built: 0,
    // number of stones laid
    resolution: 1,
    // pixels per unit of the off-screen canvases
    layers: LAYERS.map((l) => ({ ...l, canvas: null, ctx: null, rendered: 0 })),
    get total() {
      return this.stones.length;
    },
    init() {
      for (const layer of this.layers) {
        layer.canvas = document.createElement("canvas");
        layer.ctx = layer.canvas.getContext("2d");
      }
      this.setResolution(1, true);
    },
    // Change the off-screen resolution (re-renders lazily)
    setResolution(r, force) {
      if (!force && r === this.resolution) return;
      this.resolution = r;
      for (const layer of this.layers) {
        layer.canvas.width = Math.ceil(CATHEDRAL_WIDTH * r);
        layer.canvas.height = Math.ceil(CATHEDRAL_HEIGHT * r);
        layer.rendered = 0;
        this.prepareContext(layer);
      }
    },
    prepareContext(layer) {
      const ctx = layer.ctx;
      ctx.setTransform(this.resolution, 0, 0, this.resolution, 0, 0);
      ctx.lineWidth = 1;
      ctx.lineJoin = "miter";
    },
    clear() {
      this.built = 0;
      for (const layer of this.layers) {
        layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.rendered = 0;
        this.prepareContext(layer);
      }
    },
    // Lay new stones (returns how many were really laid)
    build(nb) {
      const real = Math.max(0, Math.min(nb, this.total - this.built));
      this.built += real;
      return real;
    },
    catchUp(layer, max) {
      const end = Math.min(this.built, layer.rendered + max);
      for (let i = layer.rendered; i < end; i++) drawStone(layer.ctx, this.stones[i], layer.zOffset);
      layer.rendered = end;
    },
    layerFor(stonesBuilt) {
      let current = this.layers[0];
      for (const layer of this.layers) if (stonesBuilt >= layer.from) current = layer;
      return current;
    },
    // Draw the cathedral with its top-left corner at (x, y) in the current transform
    draw(ctx, x, y, layer) {
      this.catchUp(layer, Infinity);
      for (const other of this.layers) if (other !== layer) this.catchUp(other, BACKGROUND_STONES_PER_FRAME);
      ctx.drawImage(layer.canvas, x, y, CATHEDRAL_WIDTH, CATHEDRAL_HEIGHT);
    }
  };

  // cathedral-builder/js/audio.js
  var MUTE_KEY = "cathedral-builder:muted";
  var BPM = 110;
  var NOTE_BASE = { C: 32.7, Db: 34.6, D: 36.7, Eb: 38.9, E: 41.2, F: 43.6, Gb: 46.2, G: 49, Ab: 51.9, A: 55, Bb: 58.3, B: 61.7 };
  function noteToFrequency(note) {
    const octave = parseInt(note.slice(-1), 10);
    return Math.round(NOTE_BASE[note.slice(0, -1)] * Math.pow(2, octave));
  }
  function createSong() {
    const restBar = ["r", 4];
    const a1Am = ["A2", 0.5, "C3", 0.5, "E3", 0.5, "E3", 1.5, "C3", 1];
    const a1Bdim = ["B2", 0.5, "D3", 0.5, "F3", 0.5, "F3", 1.5, "B2", 1];
    const a1Dm = ["D3", 0.5, "F3", 0.5, "A3", 0.5, "F3", 1.5, "F2", 1];
    const a1E7 = ["E2", 0.5, "Ab2", 0.5, "B2", 0.5, "B2", 1.5, "E3", 1];
    const a1F = ["F2", 0.5, "A2", 0.5, "C3", 0.5, "C3", 1.5, "F3", 1];
    const a1 = [
      a1Am,
      a1Bdim,
      a1Am,
      a1Bdim,
      a1Am,
      a1Bdim,
      a1Am,
      a1Bdim,
      a1E7,
      a1F,
      a1E7,
      a1Am,
      a1Am,
      a1Dm,
      a1Am,
      a1Dm,
      a1Am,
      a1E7,
      ["A2", 0.5, "C3", 0.5, "E3", 0.5, "A3", 0.5, "C4", 1, "A3", 1]
    ];
    const a2Am = ["r", 1.5, "A3", 1.5], a2Bdim = ["r", 1.5, "B3", 1.5], a2Dm = ["r", 1.5, "A3", 1.5];
    const a2E7 = ["r", 1.5, "E3", 1.5], a2F = ["r", 1.5, "F3", 1.5];
    const a2 = [
      a2Am,
      a2Bdim,
      a2Am,
      a2Bdim,
      a2Am,
      a2Bdim,
      a2Am,
      a2Bdim,
      a2E7,
      a2F,
      a2E7,
      a2Am,
      a2Am,
      a2Dm,
      a2Am,
      a2Dm,
      a2Am,
      a2E7,
      restBar
    ];
    const a3Am = ["r", 1.5, "C4", 1.5], a3Bdim = ["r", 1.5, "D4", 1.5], a3Dm = ["r", 1.5, "D4", 1.5];
    const a3E7 = ["r", 1.5, "Ab3", 1.5], a3F = ["r", 1.5, "A3", 1.5];
    const a3 = [
      a3Am,
      a3Bdim,
      a3Am,
      a3Bdim,
      a3Am,
      a3Bdim,
      a3Am,
      a3Bdim,
      a3E7,
      a3F,
      a3E7,
      a3Am,
      a3Am,
      a3Dm,
      a3Am,
      a3Dm,
      a3Am,
      a3E7,
      restBar
    ];
    const bAm = ["A1", 1.5, "A1", 1.5, "A1", 1], bDm = ["F2", 1.5, "F2", 1.5, "F2", 1], bE7 = ["E2", 1.5, "E2", 1.5, "E2", 1];
    const bass = [
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      restBar,
      bAm,
      bDm,
      bAm,
      bDm,
      bAm,
      bE7,
      ["A1", 4]
    ];
    const lead = [
      restBar,
      restBar,
      restBar,
      ["r", 2.5, "E4", 0.5, "A4", 0.5, "Ab4", 0.5],
      ["B4", 1.5, "C5", 1, "E4", 0.5, "C5", 0.5, "B4", 0.5],
      ["Ab4", 1.5, "A4", 1, "C5", 0.5, "B4", 0.5, "Ab4", 0.5],
      ["E4", 4],
      ["r", 2.5, "E4", 0.5, "A4", 0.5, "Ab4", 0.5],
      ["C5", 1.5, "B4", 1.5, "Gb4", 1],
      ["A4", 3, "B4", 0.5, "A4", 0.5],
      ["Ab4", 4],
      ["r", 2.5, "E4", 0.5, "A4", 0.5, "B4", 0.5],
      ["B4", 1.5, "C5", 1.5, "A4", 1],
      ["D5", 3, "B4", 0.75, "A4", 0.25],
      ["C5", 3, "D5", 0.5, "C5", 0.5],
      ["B4", 2.5, "E4", 0.5, "A4", 0.5, "B4", 0.5],
      ["B4", 1.5, "C5", 1.5, "B4", 0.5, "A4", 0.5],
      ["Ab4", 1.5, "A4", 0.25, "Ab4", 0.25, "Gb4", 1, "Ab4", 1],
      ["A4", 4]
    ];
    return [
      { bars: a1, volume: 0.85 },
      { bars: a2, volume: 0.85 },
      { bars: a3, volume: 0.85 },
      { bars: bass, volume: 0.9 },
      { bars: lead, volume: 0.8 }
    ];
  }
  function volumeToGain(v2) {
    if (v2 <= 0) return 0;
    if (v2 >= 1) return 1;
    return Math.pow(10, (v2 - 1) * 3);
  }
  function applyADSR(env, param, start, duration) {
    const a = env.a || 1e-4, d = env.d || 1e-4, s = env.s || 1e-4, r = env.r || 1e-4;
    const min = env.min || 1e-4, max = env.max || 1;
    param.setValueAtTime(min, start);
    if (duration <= a) {
      param.exponentialRampToValueAtTime(Math.max(1e-4, max * duration / a), start + duration);
    } else if (duration <= a + d) {
      param.exponentialRampToValueAtTime(max, start + a);
      param.exponentialRampToValueAtTime(Math.max(1e-4, max * s * d / duration), start + duration);
    } else {
      param.exponentialRampToValueAtTime(max, start + a);
      param.exponentialRampToValueAtTime(max * s, start + a + d);
      param.setValueAtTime(max * s, start + duration);
    }
    param.exponentialRampToValueAtTime(min, start + duration + r);
  }
  var music = {
    ctx: null,
    master: null,
    muted: false,
    playing: false,
    tracks: createSong(),
    nextBar: 0,
    nextBarStart: 0,
    nextBarTrigger: 0,
    init() {
      try {
        this.muted = localStorage.getItem(MUTE_KEY) === "1";
      } catch (e) {
      }
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    },
    // Must be called from a user gesture
    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    setMuted(m) {
      this.muted = m;
      try {
        localStorage.setItem(MUTE_KEY, m ? "1" : "0");
      } catch (e) {
      }
      if (this.master) this.master.gain.setValueAtTime(m ? 0 : 1, this.ctx.currentTime);
    },
    start() {
      if (!this.ctx) return;
      this.playing = true;
      this.nextBar = 0;
      this.nextBarStart = this.ctx.currentTime + 0.05;
      this.nextBarTrigger = 0;
    },
    // Play one note with the original triangle synth
    note(freq, start, duration, volume) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      const env = ctx.createGain();
      applyADSR({ a: 0.02, d: 0.5, s: 0.2, r: 0.15, min: 0, max: volume }, env.gain, start, duration);
      const vol = ctx.createGain();
      vol.gain.value = volumeToGain(volume) * 0.04;
      osc.connect(env);
      env.connect(vol);
      vol.connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.2);
    },
    // Called every frame: schedules the next bar shortly before it starts
    update() {
      if (!this.playing || !this.ctx || this.ctx.state !== "running") return;
      if (this.ctx.currentTime < this.nextBarTrigger) return;
      const beat = 60 / BPM;
      if (this.nextBarStart < this.ctx.currentTime) this.nextBarStart = this.ctx.currentTime + 0.05;
      for (const track of this.tracks) {
        const bar = track.bars[this.nextBar % track.bars.length];
        let t = this.nextBarStart;
        for (let i = 0; i < bar.length; i += 2) {
          const duration = bar[i + 1] * beat;
          if (bar[i] !== "r") this.note(noteToFrequency(bar[i]), t, duration, track.volume);
          t += duration;
        }
      }
      this.nextBar += 1;
      this.nextBarTrigger = this.nextBarStart + 3 * beat;
      this.nextBarStart += 4 * beat;
    }
  };

  // cathedral-builder/js/game.js
  var FONT = '"Times New Roman", Times, serif';
  var LIGHT = "#FFDDCA";
  var DARK = "#411F0C";
  var GREY = "#411F0C77";
  var START_YEAR = 1200;
  var END_YEAR = 1300;
  var MONTH_MS = 200;
  var PANEL_W = 560;
  var PANEL_H = 420;
  var HUD_WIDE = { w: 880, h: 62 };
  var HUD_TALL = { w: 520, h: 112 };
  var TITLE_W = 640;
  var TITLE_H = 720;
  var v = {};
  function resetVariables() {
    Object.assign(v, {
      rockStock: 0,
      stoneStock: 0,
      goldStock: 0,
      stoneBuilt: 0,
      rockSpeed: 1e3,
      stoneSpeed: 1e3,
      goldSpeed: 1e3,
      rockProduction: 1,
      stoneProduction: 10,
      goldProduction: 1,
      rockAutoClickUntil: 0,
      stoneAutoClickUntil: 0,
      goldAutoClickUntil: 0,
      buildAutoClickUntil: 0,
      buildSpeed: 1,
      year: START_YEAR,
      month: 1,
      level: 1,
      levelGoal: 50,
      levelGoldReward: 1
    });
  }
  resetVariables();
  v.unlockPhase = 0;
  v.unlockTime = 0;
  var layout = { portrait: false };
  var lastMonthChange = 0;
  var lastBuild = 0;
  var finishedYear = 0;
  var bonuses = [];
  var particles = [];
  var fmt = (n) => Math.floor(n).toLocaleString("en-US");
  var rnd = (min, max) => Math.random() * (max - min) + min;
  var rndInt = (min, max) => Math.floor(Math.random() * (max - min) + min);
  var pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  var ROW_Y = { build: 45, rock: 155, stone: 265, gold: 375 };
  var stocks = [
    { id: "rock", label: "ROCK", x: 50, y: ROW_Y.rock, phase: 1 },
    { id: "stone", label: "STONE", x: 50, y: ROW_Y.stone, phase: 2 },
    { id: "gold", label: "GOLD", x: 50, y: ROW_Y.gold, phase: 6 }
  ];
  stocks.forEach((s) => {
    s.w = 100;
    s.h = 90;
  });
  var workers = [
    { id: "rock", label: "DIG", x: 200, y: ROW_Y.rock, phase: 1 },
    { id: "stone", label: "CUT", x: 200, y: ROW_Y.stone, phase: 2 },
    { id: "gold", label: "BEG", x: 200, y: ROW_Y.gold, phase: 6 }
  ];
  workers.forEach((w) => {
    w.w = 170;
    w.h = 90;
    w.started = false;
    w.startTime = 0;
    w.progress = 0;
  });
  var boosters = [
    { id: "upgradeRock", label: "UPGRADE", x: 362.5, y: ROW_Y.rock, w: 125, phase: 6 },
    { id: "upgradeStone", label: "UPGRADE", x: 362.5, y: ROW_Y.stone, w: 125, phase: 6 },
    { id: "upgradeGold", label: "UPGRADE", x: 362.5, y: ROW_Y.gold, w: 125, phase: 6 },
    { id: "boosterRock", label: "AUTO CLICK", x: 497.5, y: ROW_Y.rock, w: 125, phase: 7 },
    { id: "boosterStone", label: "AUTO CLICK", x: 497.5, y: ROW_Y.stone, w: 125, phase: 7 },
    { id: "boosterGold", label: "AUTO CLICK", x: 497.5, y: ROW_Y.gold, w: 125, phase: 7 },
    { id: "boosterBuild", label: "AUTO CLICK", x: 430, y: ROW_Y.build, w: 260, phase: 8 }
  ];
  boosters.forEach((b) => {
    b.h = 90;
    b.goldNeeded = 1;
    b.disabled = true;
  });
  var buildButton = { x: 142.5, y: ROW_Y.build, w: 285, h: 90, phase: 3 };
  var playButton = { x: TITLE_W / 2, y: 330, w: 240, h: 76 };
  var gameOverBox = { x: PANEL_W / 2, y: PANEL_H / 2, w: 520, h: 400 };
  function computeLayout(w, h) {
    const m = Math.max(8, Math.min(w, h) * 0.025);
    const muteSpace = 56;
    const portrait = w / h < 1.15;
    layout = { portrait, w, h, m };
    if (!portrait) {
      const sh = Math.min((w - 2 * m - muteSpace) / HUD_WIDE.w, 1.2, h * 0.1 / HUD_WIDE.h);
      engine.setGroup("hud", m, m, sh);
      const top = m + HUD_WIDE.h * sh + m * 0.5;
      const H = h - top - m, W = w - 2 * m, gap = m;
      const sp = Math.min(H / PANEL_H, (W - gap) * 0.44 / PANEL_W, 1.35);
      const sc = Math.min(H / CATHEDRAL_HEIGHT, (W - gap - PANEL_W * sp) / CATHEDRAL_WIDTH, 1.6);
      const total = PANEL_W * sp + gap + CATHEDRAL_WIDTH * sc;
      const x0 = (w - total) / 2;
      engine.setGroup("panel", x0, top + (H - PANEL_H * sp) / 2, sp);
      engine.setGroup("cathedral", x0 + PANEL_W * sp + gap, top + (H - CATHEDRAL_HEIGHT * sc) / 2, sc);
    } else {
      const sh = Math.min((w - 2 * m - muteSpace) / HUD_TALL.w, 1.3, h * 0.12 / HUD_TALL.h);
      engine.setGroup("hud", m, m, sh);
      const top = m + HUD_TALL.h * sh;
      const H = h - top - m, W = w - 2 * m;
      const sc = Math.min(W / CATHEDRAL_WIDTH, H * 0.5 / CATHEDRAL_HEIGHT);
      const sp = Math.min(W / PANEL_W, (H - CATHEDRAL_HEIGHT * sc - m) / PANEL_H, 1.35);
      const catH = CATHEDRAL_HEIGHT * sc, panH = PANEL_H * sp;
      const spare = Math.max(0, H - catH - panH) / 3;
      engine.setGroup("cathedral", (w - CATHEDRAL_WIDTH * sc) / 2, top + spare, sc);
      engine.setGroup("panel", (w - PANEL_W * sp) / 2, top + spare * 2 + catH, sp);
    }
    const so = Math.min(1.3, (w - 2 * m) / 640, (h - 2 * m) / 400);
    engine.setGroup("overlay", (w - 640 * so) / 2, (h - 400 * so) / 2, so);
    const c = engine.groups.cathedral;
    const cx = c.x + CATHEDRAL_WIDTH * c.scale / 2;
    const cy = c.y + CATHEDRAL_HEIGHT * c.scale / 2;
    const cardScale = Math.min(
      so,
      1.1,
      CATHEDRAL_WIDTH * c.scale * 1.05 / 640,
      2 * (w - m - cx) / 640,
      2 * (cx - m) / 640
    );
    engine.setGroup("card", cx - 320 * cardScale, cy - 110 * cardScale, cardScale);
    const st = Math.min((w - 2 * m) / TITLE_W, (h - 2 * m) / TITLE_H);
    engine.setGroup("title", (w - TITLE_W * st) / 2, (h - TITLE_H * st) / 2, st);
    const need = Math.max(c.scale, st * 0.5) * engine.dpr;
    cathedral.setResolution(Math.min(2, Math.max(1, Math.ceil(need * 2) / 2)));
  }
  function text(ctx, str, x, y, size, align = "center", color = DARK, maxWidth) {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    if (maxWidth) ctx.fillText(str, x, y, maxWidth);
    else ctx.fillText(str, x, y);
  }
  function box(ctx, b, lineWidth = 4) {
    ctx.strokeStyle = DARK;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  function veil(ctx, b) {
    ctx.fillStyle = GREY;
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  function spawnParticles(group, x, y, nb, vxMin, vxMax) {
    for (let i = 0; i < nb; i++) {
      const size = rndInt(10, 20);
      particles.push({
        group,
        x,
        y,
        size,
        r: rndInt(55, 75),
        g: rndInt(20, 40),
        b: rndInt(0, 20),
        a: 1,
        vx: rnd(vxMin, vxMax),
        vy: rnd(-10, 0)
      });
    }
  }
  function createBonus(type, nb) {
    const b = {
      type,
      nb,
      w: 100,
      h: 50,
      x: rndInt(250, 650),
      y: 120,
      vx: rnd(-3, 3) || 1,
      vy: rnd(-3, 3) || 1
    };
    b.text = type === "autoclick" ? "AUTO CLICK" : `+${fmt(nb)} ${type.toUpperCase()}`;
    bonuses.push(b);
  }
  function bonusScale() {
    const s = engine.groups.cathedral.scale;
    return Math.max(1, 46 / (50 * s));
  }
  var logoPaths = {
    umbrellaDown: "m 205.10691,165.3075 c 0,0 -0.35863,85.0167 0.70259,110.34558",
    umbrellaUp: "m 205.10691,165.3075 c 0,0 -21.76814,-17.35005 -34.70011,-17.35005 -12.93197,0 -34.70011,17.35005 -34.70011,17.35005 0,0 -21.76815,-17.35005 -34.70012,-17.35005 -12.931969,0 -34.700107,17.35005 -34.700107,17.35005 0,0 11.114434,-48.94448 34.700107,-69.400229 23.58568,-20.455752 67.04061,-36.054153 104.10034,-34.700121 37.05974,1.354039 81.27067,23.221529 104.10033,43.37514 22.82966,20.15363 34.70013,60.72521 34.70013,60.72521 0,0 -21.76815,-17.35005 -34.70012,-17.35005 -12.93197,0 -34.70011,17.35005 -34.70011,17.35005 0,0 -21.76814,-17.35005 -34.70011,-17.35005 -12.93197,0 -34.70012,17.35005 -34.70012,17.35005 z",
    D: "m 62.317745,265.53698 v -72.77286 c 0,0 20.255119,0.0492 28.619153,6.32809 8.364034,6.27866 14.776452,20.46694 14.718422,30.37475 -0.0584,9.90781 -6.406585,23.55881 -14.718422,29.74195 -8.31183,6.18313 -28.619153,6.32807 -28.619153,6.32807 z",
    iDown: "m 120.0927,270.84804 c 0,0 -2.81801,19.23816 0,28.47634 0.70013,2.29525 1.78631,4.78289 4.08844,6.32807 3.25571,2.18522 12.26535,3.16404 12.26535,3.16404",
    l1: "m 153.19642,212.86772 c 0,0 -2.818,41.38641 0,50.62459 0.70013,2.29525 1.78632,4.7829 4.08845,6.32808 3.2557,2.18522 12.26535,3.16404 12.26535,3.16404",
    l2: "m 243.82091,247.70377 c 0,0 -2.818,41.38641 0,50.62459 0.70014,2.29525 1.78632,4.78289 4.08844,6.32807 3.25571,2.18523 12.26536,3.16404 12.26536,3.16404",
    p: "m 186.16226,353.41499 v -63.28076 h 16.35381 c 0,0 9.21799,0.80571 12.26534,3.16404 3.04735,2.35833 4.08845,9.49211 4.08845,9.49211 v 15.82019 c 0,0 -1.78632,4.78289 -4.08845,6.32807 -3.25571,2.18522 -12.26534,3.16404 -12.26534,3.16404 h -16.35381",
    e: "m 295.14667,248.6777 c 0,0 -11.18223,1.33408 -16.35371,0 -6.4644,-1.66759 -12.48876,-4.77544 -15.53611,-9.49212 -3.65682,-5.65999 -3.12917,-13.13784 0,-18.98422 2.21265,-4.13401 6.31848,-7.13437 11.44765,-8.8593 3.74971,-1.26102 8.48807,-1.21082 12.26529,0 5.34178,1.71236 10.05264,4.72529 12.26529,8.8593 2.08609,3.89759 0,12.02334 0,12.02334 h -36.79592",
    u: "m 312.85192,250.64495 v 27.84353 c 0,0 1.04109,7.13378 4.08841,9.49211 3.04735,2.35833 7.95572,3.16405 12.26532,3.16404 4.30962,0 9.21798,-0.80571 12.26532,-3.16404 3.04736,-2.35833 3.39814,-6.19998 4.08846,-9.49211 1.7464,-8.32848 0,-27.84353 0,-27.84353",
    iUp: "m 120.0927,260.58547 c -1.92732,0 -4.08846,-1.6725 -4.08846,-3.16404 0,-1.49154 2.16114,-3.16405 4.08846,-3.16405 1.92731,0 4.08844,1.67251 4.08844,3.16405 0,1.49154 -2.16113,3.16404 -4.08844,3.16404 z"
  };
  var logo = null;
  function drawLogo(ctx) {
    if (!logo) logo = Object.fromEntries(Object.entries(logoPaths).map(([k, d]) => [k, new Path2D(d)]));
    ctx.fillStyle = LIGHT;
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.strokeStyle = DARK;
    ctx.fillStyle = "#a500e1";
    ctx.lineWidth = 6;
    ctx.stroke(logo.umbrellaDown);
    ctx.lineWidth = 9;
    ctx.fill(logo.umbrellaUp);
    for (const k of ["umbrellaUp", "D", "l1", "p", "u", "iDown"]) ctx.stroke(logo[k]);
    ctx.strokeStyle = "#a500e1";
    for (const k of ["iUp", "l2", "e"]) ctx.stroke(logo[k]);
    ctx.lineCap = "butt";
  }
  var titleScene = {
    start() {
      cathedral.clear();
      cathedral.build(2382);
    },
    update() {
      if (engine.clicked("title", playButton.x, playButton.y, playButton.w, playButton.h, 6)) startGame();
    },
    draw(ctx) {
      clearScreen(ctx);
      engine.use("title");
      text(ctx, "CATHEDRAL", TITLE_W / 2, 115, 100, "center", DARK, TITLE_W - 20);
      text(ctx, "BUILDER", TITLE_W / 2, 215, 100, "center", DARK, TITLE_W - 20);
      text(ctx, "Can you build a cathedral in less than 100 years?", TITLE_W / 2, 262, 26, "center", DARK, TITLE_W - 20);
      cathedral.draw(ctx, -347, 315, cathedral.layers[3]);
      const b = playButton;
      ctx.fillStyle = DARK;
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      text(ctx, "PLAY", b.x, b.y + 11, 34, "center", LIGHT);
      engine.hover("title", b.x, b.y, b.w, b.h, 6);
      ctx.save();
      ctx.translate(TITLE_W / 2 - 30, 650 - 30);
      ctx.scale(0.15, 0.15);
      drawLogo(ctx);
      ctx.restore();
    }
  };
  function startGame() {
    cathedral.clear();
    music.start();
    engine.changeScene(mainScene);
  }
  function clearScreen(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(0, 0, engine.canvas.width, engine.canvas.height);
  }
  function isOver() {
    return v.year >= END_YEAR || v.stoneBuilt >= cathedral.total;
  }
  function updateUnlockPhase(now) {
    const clicked = engine.input.clicked;
    if (v.unlockPhase === 0) {
      if (clicked) v.unlockPhase = 0.1;
    } else if (v.unlockPhase === 0.1) {
      if (clicked) v.unlockPhase = 1;
    } else if (v.unlockPhase === 1) {
      if (v.rockStock >= 1) v.unlockPhase = 2;
    } else if (v.unlockPhase === 2) {
      if (v.stoneStock >= 1) v.unlockPhase = 3;
    } else if (v.unlockPhase === 3) {
      if (v.stoneBuilt >= 1) v.unlockPhase = 4;
    } else if (v.unlockPhase === 4) {
      if (v.stoneBuilt >= 20) {
        v.unlockPhase = 5;
        v.year = START_YEAR;
        v.month = 1;
        v.unlockTime = now;
      }
    } else if (v.unlockPhase === 5) {
      if (now - v.unlockTime > 5e3) v.unlockPhase = 5.1;
    } else if (v.unlockPhase === 5.1) {
      if (v.stoneBuilt >= 100) v.unlockPhase = 6;
    } else if (v.unlockPhase === 6) {
      if (v.stoneBuilt >= 300) v.unlockPhase = 7;
    } else if (v.unlockPhase === 7) {
      if (v.stoneBuilt >= 500) v.unlockPhase = 8;
    }
  }
  function autoClickActive(id, now) {
    if (id === "rock") return now < v.rockAutoClickUntil;
    if (id === "stone") return now < v.stoneAutoClickUntil;
    if (id === "gold") return now < v.goldAutoClickUntil;
    return false;
  }
  function updateWorker(w, now) {
    if (v.unlockPhase < w.phase) return;
    const clicked = engine.clicked("panel", w.x, w.y, w.w, w.h);
    const auto = autoClickActive(w.id, now);
    if (!w.started) {
      w.progress = 0;
      if (clicked || auto) {
        if (w.id === "stone") {
          if (v.rockStock >= 1) {
            v.rockStock -= 1;
            w.started = true;
            w.startTime = now;
          }
        } else {
          w.started = true;
          w.startTime = now;
        }
      }
    }
    const speed = v[w.id + "Speed"];
    if (w.started) w.progress = Math.min(1, (now - w.startTime) / speed);
    if (w.progress >= 1) {
      w.progress = 0;
      w.started = false;
      v[w.id + "Stock"] += v[w.id + "Production"];
    }
  }
  function updateBooster(b, now) {
    if (v.unlockPhase < b.phase) return;
    if (b.goldNeeded > v.goldStock) b.disabled = true;
    else if (b.id === "boosterRock") b.disabled = now < v.rockAutoClickUntil;
    else if (b.id === "boosterStone") b.disabled = now < v.stoneAutoClickUntil;
    else if (b.id === "boosterGold") b.disabled = now < v.goldAutoClickUntil;
    else if (b.id === "boosterBuild") b.disabled = now < v.buildAutoClickUntil;
    else b.disabled = false;
    if (b.disabled || !engine.clicked("panel", b.x, b.y, b.w, b.h)) return;
    if (b.id === "upgradeRock") {
      v.rockSpeed *= 0.9;
      v.rockProduction = Math.ceil(v.rockProduction * 1.05);
    } else if (b.id === "upgradeStone") {
      v.stoneSpeed *= 0.9;
      v.stoneProduction = Math.ceil(v.stoneProduction * 1.25);
    } else if (b.id === "upgradeGold") {
      v.goldSpeed *= 0.9;
      v.goldProduction = Math.ceil(v.goldProduction * 1.05);
    } else if (b.id === "boosterRock") v.rockAutoClickUntil = now + 1e4;
    else if (b.id === "boosterStone") v.stoneAutoClickUntil = now + 1e4;
    else if (b.id === "boosterGold") v.goldAutoClickUntil = now + 1e4;
    else if (b.id === "boosterBuild") v.buildAutoClickUntil = now + 1e4;
    v.goldStock -= b.goldNeeded;
    if (b.id.startsWith("booster")) b.goldNeeded = Math.ceil(b.goldNeeded * 1.4);
    else b.goldNeeded *= 2;
  }
  function updateBuild(now) {
    if (v.unlockPhase < buildButton.phase) return;
    if (engine.clicked("panel", buildButton.x, buildButton.y, buildButton.w, buildButton.h)) {
      v.buildAutoClickUntil = Math.max(v.buildAutoClickUntil, now + 1e3);
    }
    const speed = v.buildSpeed;
    if (v.stoneStock >= speed && now < v.buildAutoClickUntil && now > lastBuild + 50) {
      const laid = cathedral.build(speed);
      v.stoneStock -= laid;
      v.stoneBuilt += laid;
      lastBuild = now;
      spawnParticles("panel", 285, 70, 1, 8, 12);
    }
  }
  function updateDate(now) {
    if (now - lastMonthChange > MONTH_MS) {
      lastMonthChange = now;
      if (v.month === 12) {
        v.month = 1;
        v.year += 1;
      } else v.month += 1;
    }
  }
  function updateLevel() {
    if (v.stoneBuilt < v.levelGoal || v.level >= 15) return;
    v.goldStock += v.levelGoldReward;
    if (v.level === 1) createBonus("stone", 50);
    else if (v.level === 3) createBonus("gold", 10);
    else if (v.level >= 5) {
      const type = pick(["rock", "stone", "gold", "autoclick"]);
      if (type === "autoclick") createBonus("autoclick", 1e4);
      else createBonus(type, v[type + "Production"] * 5);
    }
    v.buildSpeed = Math.ceil(v.buildSpeed * 1.05);
    v.level += 1;
    if (v.level === 15) v.levelGoal = cathedral.total;
    else {
      v.levelGoal = Math.ceil(v.levelGoal * 1.5 / 100) * 100;
      v.levelGoldReward = Math.ceil(v.levelGoldReward * 1.1);
    }
    spawnParticles("cathedral", 455, 20, 50, -3, 3);
  }
  function updateBonuses(now) {
    const bs = bonusScale();
    const hw = 50 * bs, hh = 25 * bs;
    for (const b of bonuses) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x > CATHEDRAL_WIDTH - hw || b.x < hw) b.vx = -b.vx;
      if (b.y > CATHEDRAL_HEIGHT - hh || b.y < hh) b.vy = -b.vy;
      b.x = Math.max(hw, Math.min(CATHEDRAL_WIDTH - hw, b.x));
      b.y = Math.max(hh, Math.min(CATHEDRAL_HEIGHT - hh, b.y));
      if (engine.clicked("cathedral", b.x, b.y, b.w * bs, b.h * bs, 10)) {
        b.dead = true;
        if (b.type === "rock") v.rockStock += b.nb;
        if (b.type === "stone") v.stoneStock += b.nb;
        if (b.type === "gold") v.goldStock += b.nb;
        if (b.type === "autoclick") {
          const until = now + b.nb;
          v.rockAutoClickUntil = v.stoneAutoClickUntil = v.goldAutoClickUntil = v.buildAutoClickUntil = until;
        }
      }
    }
    bonuses = bonuses.filter((b) => !b.dead);
  }
  function updateParticles() {
    for (const p of particles) {
      p.vy += 0.5;
      p.x += p.vx;
      p.y += p.vy;
      p.a -= 0.02;
    }
    particles = particles.filter((p) => p.a > 0);
  }
  function restart() {
    resetVariables();
    cathedral.clear();
    boosters.forEach((b) => {
      b.goldNeeded = 1;
    });
    workers.forEach((w) => {
      w.started = false;
      w.progress = 0;
    });
    bonuses = [];
    finishedYear = 0;
    lastMonthChange = engine.now();
  }
  var mainScene = {
    start() {
      lastMonthChange = engine.now();
    },
    update() {
      const now = engine.now();
      if (isOver()) {
        if (!finishedYear) finishedYear = v.year;
        const g = gameOverBox;
        if (engine.clicked("panel", g.x, g.y, g.w, g.h)) restart();
      } else {
        updateUnlockPhase(now);
        workers.forEach((w) => updateWorker(w, now));
        boosters.forEach((b) => updateBooster(b, now));
        updateBonuses(now);
        updateBuild(now);
        updateDate(now);
        updateLevel();
      }
      updateParticles();
    },
    draw(ctx) {
      clearScreen(ctx);
      const over = isOver();
      if (v.unlockPhase >= 3) drawCathedral();
      drawParticles();
      if (!over) drawPanel();
      drawBonuses();
      if (v.unlockPhase >= 5) drawHud();
      drawTutorial();
      if (over) drawGameOver();
      music.update();
    }
  };
  function drawCathedral() {
    const ctx = engine.use("cathedral");
    cathedral.draw(ctx, 0, 0, cathedral.layerFor(v.stoneBuilt));
  }
  function drawPanel() {
    const ctx = engine.use("panel");
    const now = engine.now();
    ctx.lineJoin = "miter";
    for (const s of stocks) {
      if (v.unlockPhase < s.phase) continue;
      ctx.fillStyle = DARK;
      ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
      box(ctx, s);
      text(ctx, s.label, s.x, s.y - 5, 25, "center", LIGHT, s.w - 8);
      text(ctx, fmt(v[s.id + "Stock"]), s.x, s.y + 27, 22, "center", LIGHT, s.w - 8);
    }
    for (const w of workers) {
      if (v.unlockPhase < w.phase) continue;
      text(ctx, w.label, w.x, w.y + 3, 32);
      const auto = autoClickActive(w.id, now);
      if (auto) text(ctx, "auto", w.x + w.w / 2 - 8, w.y - w.h / 2 + 22, 16, "right");
      box(ctx, w);
      if (w.started) {
        ctx.fillStyle = DARK;
        ctx.fillRect(w.x - w.w / 2, w.y + w.h / 4, w.w * w.progress, w.h / 4);
      }
      if (w.id === "stone" && v.rockStock < 1 && !w.started) veil(ctx, w);
      else engine.hover("panel", w.x, w.y, w.w, w.h);
    }
    if (v.unlockPhase >= buildButton.phase) {
      const b = buildButton;
      box(ctx, b);
      if (v.stoneStock >= 1) {
        text(ctx, "BUILD", b.x, b.y - 7, 30);
        text(ctx, "CATHEDRAL", b.x, b.y + 27, 30);
        if (now < v.buildAutoClickUntil) veil(ctx, b);
        engine.hover("panel", b.x, b.y, b.w, b.h);
      } else {
        text(ctx, "Cut more stones", b.x, b.y - 8, 26, "center", DARK, b.w - 16);
        text(ctx, "to keep building", b.x, b.y + 24, 26, "center", DARK, b.w - 16);
        veil(ctx, b);
      }
    }
    for (const b of boosters) {
      if (v.unlockPhase < b.phase) continue;
      box(ctx, b, 3);
      text(ctx, b.label, b.x, b.y - 4, 22, "center", DARK, b.w - 10);
      text(ctx, `${fmt(b.goldNeeded)} gold`, b.x, b.y + 24, 18, "center", DARK, b.w - 10);
      if (b.disabled) veil(ctx, b);
      else engine.hover("panel", b.x, b.y, b.w, b.h);
    }
  }
  function drawBonuses() {
    if (!bonuses.length) return;
    const ctx = engine.use("cathedral");
    const bs = bonusScale();
    for (const b of bonuses) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(bs, bs);
      ctx.translate(-50, -25);
      ctx.fillStyle = "#B0A29B";
      ctx.fill(plate.upLeft);
      ctx.fillStyle = "#9D8B82";
      ctx.fill(plate.center);
      ctx.fillStyle = "#856F63";
      ctx.fill(plate.left);
      ctx.fill(plate.down);
      ctx.fill(plate.up);
      ctx.fillStyle = "#674B3C";
      ctx.fill(plate.downLeft);
      ctx.fill(plate.upRight);
      ctx.fill(plate.downRight);
      ctx.fillStyle = DARK;
      ctx.fill(plate.right);
      ctx.font = `bold 13px ${FONT}`;
      text(ctx, b.text, 50, 30, 13, "center", DARK, 76);
      ctx.restore();
      engine.hover("cathedral", b.x, b.y, b.w * bs, b.h * bs, 10);
    }
  }
  var plate = {};
  for (const [k, d] of Object.entries({
    up: "M10 0 L90 0 L85 10 L15 10 L10 0",
    upRight: "M85 10 L90 0 L100 10 L90 15 L85 10",
    right: "M100 10 L100 40 L90 35 L90 15 L100 10",
    downRight: "M85 40 L90 35 L100 40 L90 50 L85 40",
    down: "M90 50 L10 50 L15 40 L85 40 L90 50",
    downLeft: "M0 40 L10 35 L15 40 L10 50 L0 40",
    left: "M0 10 L10 15 L10 35 L0 40 L0 10",
    upLeft: "M0 10 L10 0 L15 10 L10 15 L0 10",
    center: "M15 10 L85 10 L90 15 L90 35 L85 40 L15 40 L10 35 L10 15 L15 10"
  })) plate[k] = new Path2D(d);
  function drawParticles() {
    for (const p of particles) {
      const ctx = engine.use(p.group);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${Math.max(0, p.a)})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  function drawHud() {
    const ctx = engine.use("hud");
    const date = `Year ${v.year} \xB7 Month ${v.month}`;
    const progress = Math.min(1, v.stoneBuilt / v.levelGoal);
    const drawLevel = (x, baseline) => {
      text(ctx, `Level ${v.level}`, x, baseline, 30, "left");
      const barX = x + 125, barW = 300;
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, baseline - 20, barW, 16);
      ctx.fillStyle = DARK;
      ctx.fillRect(barX, baseline - 20, barW * progress, 16);
      text(ctx, fmt(v.levelGoal), barX + barW + 10, baseline - 5, 20, "left");
      text(ctx, `${fmt(v.stoneBuilt)} stones`, barX, baseline + 20, 18, "left");
    };
    if (!layout.portrait) {
      text(ctx, date, 0, 34, 30, "left");
      drawLevel(350, 34);
    } else {
      text(ctx, date, 0, 32, 30, "left");
      drawLevel(0, 80);
    }
  }
  function drawHint(ctx, y, line1, line2) {
    const pulse = 0.65 + 0.35 * Math.sin(engine.now() / 250);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(300, y);
    ctx.lineTo(322, y - 14);
    ctx.lineTo(322, y + 14);
    ctx.closePath();
    ctx.fill();
    text(ctx, line1, 332, y - 6, 25, "left", DARK, 226);
    text(ctx, line2, 332, y + 24, 25, "left", DARK, 226);
    ctx.globalAlpha = 1;
  }
  function drawTutorial() {
    const p = v.unlockPhase;
    if (p === 0 || p === 0.1) {
      const ctx = engine.use("overlay");
      const lines = p === 0 ? ["13TH CENTURY", "THE GOLDEN AGE OF CATHEDRALS"] : ["CAN YOU BUILD A CATHEDRAL", "IN LESS THAN 100 YEARS?"];
      text(ctx, lines[0], 320, 175, 34, "center", DARK, 620);
      text(ctx, lines[1], 320, 225, 34, "center", DARK, 620);
      const pulse = 0.55 + 0.45 * Math.sin(engine.now() / 300);
      ctx.globalAlpha = pulse;
      text(ctx, "Tap or click to continue", 320, 290, 22, "center", DARK, 620);
      ctx.globalAlpha = 1;
      engine.hoverable = true;
    } else if (p === 1 || p === 2 || p === 3) {
      const ctx = engine.use("panel");
      if (p === 1) drawHint(ctx, ROW_Y.rock, "FIRST, DIG", "UP SOME ROCK");
      if (p === 2) drawHint(ctx, ROW_Y.stone, "THEN CUT IT", "INTO STONES");
      if (p === 3) drawHint(ctx, ROW_Y.build, "GREAT! NOW", "START BUILDING");
    } else if (p === 5) {
      const ctx = engine.use("card");
      ctx.fillStyle = "rgba(255, 221, 202, 0.92)";
      ctx.fillRect(10, 10, 620, 200);
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, 620, 200);
      text(ctx, "PERFECT! NOW THE REAL GAME BEGINS.", 320, 72, 28, "center", DARK, 590);
      text(ctx, "REMEMBER: YOU HAVE 100 YEARS", 320, 122, 28, "center", DARK, 590);
      text(ctx, "TO BUILD YOUR CATHEDRAL", 320, 166, 28, "center", DARK, 590);
    }
  }
  function drawGameOver() {
    const ctx = engine.use("panel");
    const g = gameOverBox;
    const x0 = g.x - g.w / 2, y0 = g.y - g.h / 2;
    ctx.fillStyle = DARK;
    ctx.fillRect(x0, y0, g.w, g.h);
    const won = v.stoneBuilt >= cathedral.total;
    if (won) {
      text(ctx, "CONGRATULATIONS!", g.x, y0 + 80, 44, "center", LIGHT, g.w - 30);
      text(ctx, "You built the cathedral", g.x, y0 + 145, 28, "center", LIGHT, g.w - 30);
      text(ctx, `in ${finishedYear - START_YEAR} years (year ${finishedYear})!`, g.x, y0 + 183, 28, "center", LIGHT, g.w - 30);
    } else {
      text(ctx, "GAME OVER", g.x, y0 + 80, 44, "center", LIGHT, g.w - 30);
      text(ctx, "You could not build the cathedral", g.x, y0 + 145, 28, "center", LIGHT, g.w - 30);
      text(ctx, "in less than 100 years.", g.x, y0 + 183, 28, "center", LIGHT, g.w - 30);
    }
    text(ctx, `Stones laid: ${fmt(v.stoneBuilt)} / ${fmt(cathedral.total)}`, g.x, y0 + 235, 22, "center", LIGHT, g.w - 30);
    text(ctx, `Level reached: ${v.level}`, g.x, y0 + 266, 22, "center", LIGHT, g.w - 30);
    ctx.strokeStyle = LIGHT;
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x - 120, y0 + 300, 240, 64);
    text(ctx, "TRY AGAIN", g.x, y0 + 342, 30, "center", LIGHT);
    engine.hover("panel", g.x, g.y, g.w, g.h);
  }
  var debug = { v, cathedral, bonuses: () => bonuses, createBonus, startGame, groups: () => engine.groups };

  // cathedral-builder/js/main.js
  var canvas = document.getElementById("game");
  var muteButton = document.getElementById("mute");
  music.init();
  cathedral.init();
  engine.onResize = (w, h) => computeLayout(w, h);
  engine.onPointerDown = () => music.unlock();
  engine.init(canvas);
  function refreshMute() {
    muteButton.classList.toggle("muted", music.muted);
    muteButton.setAttribute("aria-label", music.muted ? "Unmute music" : "Mute music");
    muteButton.title = music.muted ? "Unmute music" : "Mute music";
  }
  muteButton.addEventListener("pointerdown", (e) => e.stopPropagation());
  muteButton.addEventListener("click", () => {
    music.unlock();
    music.setMuted(!music.muted);
    refreshMute();
  });
  refreshMute();
  engine.start(titleScene);
  window.cathedralBuilder = debug;
})();
