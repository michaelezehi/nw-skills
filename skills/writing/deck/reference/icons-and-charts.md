# Icons, Charts, 3D, Animation — CDN-Only Rich Media

The deck is a single self-contained HTML file. To add icons, charts, 3D, or animation, **load libraries from CDN via `<script>` or `<link>`** — no npm, no build step, no asset files. All recommendations below are battle-tested CDN endpoints.

## Decision tree — which library for what

| Need | Use | Why |
|---|---|---|
| Inline icons (any icon set) | **Iconify** | 200,000+ icons across 100+ sets. One web component. |
| Beautiful animated charts | **ApexCharts** | Modern, themeable, animated, prints well |
| Static editorial charts (bar, line, area) | **Inline SVG** | Lightest, prints sharpest, matches the editorial feel |
| Complex / interactive data viz | **ECharts** or **D3** | Power tools. Use sparingly — they pull weight. |
| 3D model / scene embed | **Spline** (`<iframe>` or web component) | Fastest path to a 3D moment. No code. |
| 3D with custom interaction | **Three.js** | Full control, larger weight |
| Vector animation (Lottie .json) | **lottie-web** | Designer-friendly, scales perfectly, prints first frame |
| Lightweight micro-interaction | **Pure CSS** | No deps. Always start here. |

## Icons — Iconify (recommended)

200k+ icons across Phosphor, Lucide, Heroicons, Material, Tabler, Carbon, FontAwesome, and dozens more. Use the web component for the simplest integration.

**Add once to `<head>`:**

```html
<script src="https://code.iconify.design/iconify-icon/3.0.2/iconify-icon.min.js"></script>
```

**Use anywhere:**

```html
<iconify-icon icon="ph:trend-up-bold" width="24" height="24" style="color: var(--accent);"></iconify-icon>
<iconify-icon icon="lucide:zap" width="20" height="20"></iconify-icon>
<iconify-icon icon="tabler:chart-bar" width="32" height="32" style="color: var(--ink);"></iconify-icon>
```

**Browse the catalog:** https://icon-sets.iconify.design/

**Curated picks for editorial decks:**

- `ph:` (Phosphor) — clean line icons, perfect for editorial
- `lucide:` — refined geometric icons
- `tabler:` — comprehensive set, very even line weights
- `carbon:` — IBM design system, very crisp
- `mingcute:line` — minimal line variants
- `streamline:` — illustrative

**Usage patterns inside the editorial aesthetic:**

```html
<!-- Eyebrow with icon -->
<div class="eyebrow" style="display: inline-flex; align-items: center; gap: 8px;">
  <iconify-icon icon="ph:target" width="14" height="14"></iconify-icon>
  GOAL · 03
</div>

<!-- Stat card with icon -->
<div class="stat-card">
  <iconify-icon icon="ph:trend-up-bold" width="28" height="28" style="color: var(--accent); margin-bottom: 14px;"></iconify-icon>
  <div class="lab">Growth</div>
  <div class="num">147%</div>
  <div class="sub">YoY · canonical</div>
</div>

<!-- Inline accent in body copy -->
<p class="body-l">
  See the
  <iconify-icon icon="ph:link" width="14" height="14" style="vertical-align: -2px; color: var(--accent);"></iconify-icon>
  full report for details.
</p>
```

**Icon sizing rules — be stylistic, not decorative:**

The mistake is icons that match the surrounding text size and become visual noise. Icons should either be **clearly bigger** than the type they accompany (so they read as a graphic moment) or **absent entirely**. There is no middle ground.

- **Eyebrows / labels** (10–11px text): icon at **18–22px**, slightly leading the type
- **Stat-card lead** (label + number): icon at **40–56px**, drawn above the label as a visual anchor — drop the inline mini-icon next to the label
- **Section divider hero** (when a slide is just a section break): **96–128px** icon, centered or top-left, becomes the primary graphic
- **Body copy** (rare — only when the icon adds meaning, not decoration): 18–20px with `vertical-align: -3px`
- **Slide-mark chrome** (top-left, very small chrome): keep at 14px — chrome should not compete

**Stylistic pattern — icon-as-anchor (replaces mini-icon-next-to-label):**

```html
<!-- Old / weak -->
<div class="eyebrow"><iconify-icon icon="ph:target" width="14"></iconify-icon> GOAL · 03</div>

<!-- New / stylistic -->
<div class="stat-card">
  <iconify-icon icon="ph:target" width="48" height="48" style="color: var(--accent); margin-bottom: 18px; display: block;"></iconify-icon>
  <div class="num">05</div>
  <div class="lab">GOALS</div>
</div>
```

The icon is now a **visual element**, not a typographic accessory. Same with section dividers — drop a 96px outline icon top-left and let it carry the slide's identity.

**One icon per emphasis zone, not three.** Editorial decks earn icon impact through scarcity. A slide with one bold 56px icon reads stronger than a slide with five 14px icons sprinkled through the text.

**Weight conventions:**

- Use Phosphor's `regular` (default) for line / outline aesthetic — pairs with `editorial` and `clean`
- Use Phosphor's `bold` for stronger impact — pairs with stat-card numbers and section anchors
- Use Phosphor's `duotone` only for hero / illustration moments — overuses become "AI slop"
- Avoid `fill` weight unless using an icon as a counter or dot

```html
<iconify-icon icon="ph:target" width="56" height="56"></iconify-icon>             <!-- regular -->
<iconify-icon icon="ph:target-bold" width="56" height="56"></iconify-icon>         <!-- bold -->
<iconify-icon icon="ph:target-duotone" width="96" height="96"></iconify-icon>      <!-- duotone hero -->
```

**Icon color:** always inherit from `color:` on a parent or set explicitly. Default is `currentColor`. Use `var(--accent)` for emphasis, `var(--ink)` for primary, `var(--stone)` for muted.

## Icons — Phosphor (alternative, matches Perspiva's stack)

Already used in Perspiva codebase. If consistency with the running app matters more than icon variety:

```html
<script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>
```

```html
<i class="ph ph-trend-up" style="font-size: 24px; color: var(--accent);"></i>
<i class="ph-bold ph-zap" style="font-size: 28px;"></i>
<i class="ph-fill ph-target"></i>
```

Three weights: regular, bold, fill. Same geometry, different ink. Browse: https://phosphoricons.com/

**Pick one or the other** — don't mix Iconify and Phosphor in the same deck (different rendering, different baseline).

## Charts — ApexCharts (recommended for animated charts)

Beautiful out of the box, themeable, prints well, animated entry. ~110KB minified — acceptable for a deck.

**Add to `<head>`:**

```html
<script src="https://cdn.jsdelivr.net/npm/apexcharts@5.16.0/dist/apexcharts.min.js"></script>
```

**Mount anywhere:**

```html
<div id="chart-cost-structure" style="margin-top: 22px;"></div>
<script>
  const opts = {
    chart: {
      type: 'bar',
      height: 320,
      toolbar: { show: false },
      fontFamily: 'Geist, system-ui, sans-serif',
      foreColor: getComputedStyle(document.documentElement).getPropertyValue('--stone-dark'),
    },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 0, barHeight: '60%', distributed: false },
    },
    colors: [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()],
    series: [{ name: 'Allocation', data: [750, 375, 375] }],
    xaxis: { categories: ['Marketing', 'Tech', 'G&A'] },
    grid: { borderColor: 'rgba(0,0,0,0.08)', strokeDashArray: 2 },
    dataLabels: { enabled: true, formatter: (v) => `£${v}K` },
    tooltip: { enabled: false },
    // v4+ removed animations.easing — only enabled/speed/animateGradually/dynamicAnimation exist
    animations: { enabled: true, speed: 400 },
  };
  new ApexCharts(document.querySelector('#chart-cost-structure'), opts).render();
</script>
```

**Themeing rule:** always pull colors from CSS variables so charts inherit the project's brand. Never hardcode colors in the chart config.

**Chart types worth using in decks:**

- `bar` (horizontal, distributed: false) — for budget allocations, comparisons
- `line` — for time series
- `area` — for runway / cumulative metrics
- `donut` — for share-of-pie (use SPARINGLY, max once per deck)
- `radialBar` — for progress / completion rates

**Avoid:** pie (donut is better), 3D charts (gimmicky), heatmaps in decks (too dense for slides).

## Charts — Frappe Charts (recommended for line-art / editorial decks)

Beautiful out of the box, line-led aesthetic, very lightweight (~30KB). Sister option to ApexCharts — pick this when the deck wants a hand-drawn / editorial feel rather than the polished SaaS look ApexCharts delivers.

**Add to `<head>`:**

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/frappe-charts@1.6.2/dist/frappe-charts.min.css">
<script src="https://cdn.jsdelivr.net/npm/frappe-charts@1.6.2/dist/frappe-charts.min.iife.js"></script>
```

**Mount:**

```html
<div id="chart-runway"></div>
<script>
  new frappe.Chart('#chart-runway', {
    title: 'Runway · 18 months',
    data: {
      labels: ['M1','M3','M6','M9','M12','M15','M18'],
      datasets: [{ name: 'Cash', values: [1500, 1320, 1080, 820, 540, 260, 0] }]
    },
    type: 'line',
    height: 280,
    colors: [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()],
    lineOptions: { hideDots: 0, regionFill: 1 },
    axisOptions: { xAxisMode: 'tick' }
  });
</script>
```

Frappe charts default to a light, sketchy line-art style that pairs beautifully with the editorial aesthetic.

## Charts — about Nivo

Nivo (https://nivo.rocks) is the React-only library you may have seen — already in Perspiva's `package.json` (`@nivo/bar`, `@nivo/line`, etc.). **It does not have a vanilla / CDN bundle.** Decks are static HTML, so Nivo can't be used directly inside a single self-contained file.

**Closest CDN-friendly equivalents** to the Nivo aesthetic:

| Want | Use | Why |
|---|---|---|
| Nivo's beautiful line/bar polish | **ApexCharts** | Same modern feel, single CDN, polished |
| Nivo's hand-drawn / editorial feel | **Frappe Charts** | Light, line-led, subtle |
| Nivo's data-art / custom viz | **Inline SVG + D3** | Full control, weighty |
| Nivo's Sankey / Chord / Treemap | **ECharts** | Comprehensive, vanilla |

If a future deck explicitly needs Nivo (e.g. a React-based interactive deck), the skill can be extended with a React aesthetic that bundles Nivo, but the default architecture is single-file HTML.

## Charts — Chart.js (lightweight modern fallback)

Smaller than ApexCharts (~70KB), wider browser support, simpler API.

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js"></script>

<canvas id="chart-allocation" style="max-height: 320px;"></canvas>
<script>
  new Chart(document.getElementById('chart-allocation'), {
    type: 'bar',
    data: {
      labels: ['Marketing', 'Tech', 'G&A'],
      datasets: [{
        data: [50, 25, 25],
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        borderRadius: 0,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { grid: { display: false } } }
    }
  });
</script>
```

## Charts — Inline SVG (recommended for editorial / static charts)

For the editorial aesthetic, hand-rolled inline SVG often looks more refined than ApexCharts. No deps, prints crisp, embeds the data semantics in the markup.

```html
<svg viewBox="0 0 1100 220" style="width: 100%; height: auto; display: block; margin-top: 22px;">
  <line x1="0" y1="2" x2="1100" y2="2" stroke="rgba(0,0,0,0.16)" stroke-dasharray="2 4"/>

  <!-- Marketing — 50% -->
  <text x="0" y="36" font-family="JetBrains Mono" font-size="10" letter-spacing="0.18em"
        fill="var(--stone)">MARKETING</text>
  <rect x="0" y="46" width="550" height="32" fill="var(--accent)"/>
  <text x="560" y="68" font-family="JetBrains Mono" font-size="13" fill="var(--ink)">£750K · 50%</text>

  <!-- Tech — 25% -->
  <text x="0" y="106" font-family="JetBrains Mono" font-size="10" letter-spacing="0.18em"
        fill="var(--stone)">TECH</text>
  <rect x="0" y="116" width="275" height="32" fill="var(--accent-deep)"/>
  <text x="285" y="138" font-family="JetBrains Mono" font-size="13" fill="var(--ink)">£375K · 25%</text>
</svg>
```

Editorial SVG charts should be **minimal**: no axes, no grid (one dotted topline at most), labels left of bars in mono caps, values right of bars in mono numerics. Match the slide's typography hierarchy.

## 3D — Spline (recommended for embed)

Designer tool that exports a `viewer-url`. Drop it in via web component. No JS knowledge needed.

**Add to `<head>`:**

```html
<script type="module" src="https://unpkg.com/@splinetool/viewer@1.12.21/build/spline-viewer.js"></script>
```

**Embed:**

```html
<spline-viewer
  url="https://prod.spline.design/YOUR-SCENE-ID/scene.splinecode"
  style="width: 100%; height: 480px; display: block; margin-top: 22px;"
></spline-viewer>
```

Or `<iframe>` from spline.design:

```html
<iframe src="https://my.spline.design/YOUR-SCENE-ID/" frameborder="0" width="100%" height="480"></iframe>
```

**When to use 3D in a deck:**

- A single hero slide with a brand mark or product render
- A "concept" slide that benefits from spatial form (e.g., a network graph, an architecture)
- Never on data slides — distracting

3D scenes are interactive on screen and render the first frame to PDF (acceptable trade).

## 3D line art — Three.js wireframe (recommended for line-style graphics)

For a 3D line-art aesthetic that pairs with the editorial deck (think technical drawings, wireframe geometry, low-poly line art), use Three.js with `WireframeGeometry` or `EdgesGeometry` and **no fill, no shading** — just lines.

```html
<canvas id="hero-wireframe" style="width: 100%; height: 420px; display: block;"></canvas>

<script type="importmap">
  { "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/"
  } }
</script>

<script type="module">
  import * as THREE from 'three';

  const canvas = document.getElementById('hero-wireframe');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(3, 2.5, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x000000, 0);

  // Wireframe icosahedron — clean line-art geometry
  const geometry = new THREE.IcosahedronGeometry(1.4, 1);
  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({ color: ink, linewidth: 1 });
  const wire = new THREE.LineSegments(edges, lineMat);
  scene.add(wire);

  // Accent edge highlight on a smaller inner shape
  const innerEdges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.6, 0));
  const accentMat = new THREE.LineBasicMaterial({ color: accent });
  const accentWire = new THREE.LineSegments(innerEdges, accentMat);
  scene.add(accentWire);

  function animate() {
    requestAnimationFrame(animate);
    wire.rotation.y += 0.002;
    wire.rotation.x += 0.001;
    accentWire.rotation.y -= 0.003;
    accentWire.rotation.x -= 0.0015;
    renderer.render(scene, camera);
  }
  animate();
</script>
```

Key ingredients:
- `EdgesGeometry` instead of full meshes — lines only, no fills
- `LineBasicMaterial` with the project's `--ink` and `--accent` tokens
- Transparent background (`alpha: true`, `setClearColor(0x000000, 0)`) so it floats on the slide's paper
- Slow rotation (0.001–0.003 rad/frame) — drift, not animation
- One inner accent shape and one outer ink shape — the layered line-art effect

**Geometry presets that read editorial:**

| Geometry | Visual |
|---|---|
| `IcosahedronGeometry(r, 1)` | Spherical wireframe — feels like a globe / network |
| `TorusKnotGeometry(0.7, 0.2, 100, 16)` | Knot — feels like complexity / synthesis |
| `OctahedronGeometry(1, 0)` | Diamond — feels like clarity / decision |
| `CylinderGeometry(1, 1, 2, 8, 1, true)` | Open cylinder — feels like infrastructure |
| `BoxGeometry(2, 2, 2)` | Cube — feels like structure / blocks |

Pick by metaphor — match the slide's content. A "synthesis" slide gets the torus knot. A "blocks of the platform" slide gets the cube. Don't randomize.

## 3D line art — Isometric SVG (recommended for static / printed decks)

For 3D aesthetic that prints crisply, hand-rolled isometric SVG is the most editorial route. No JS, no animation, just lines:

```html
<svg viewBox="0 0 320 280" style="width: 320px; height: 280px;">
  <!-- Isometric cube — three faces drawn as parallelograms -->
  <g stroke="var(--ink)" stroke-width="1.2" fill="none">
    <!-- top face -->
    <polygon points="160,40 280,90 160,140 40,90" />
    <!-- left face -->
    <polygon points="40,90 160,140 160,240 40,190" />
    <!-- right face -->
    <polygon points="280,90 160,140 160,240 280,190" />
    <!-- inner verticals (depth) -->
    <line x1="160" y1="40" x2="160" y2="140" stroke-width="0.6"/>
    <line x1="40" y1="90" x2="160" y2="140" stroke-width="0.6"/>
    <line x1="280" y1="90" x2="160" y2="140" stroke-width="0.6"/>
  </g>
  <!-- accent dot at vertex -->
  <circle cx="160" cy="140" r="3" fill="var(--accent)" />
</svg>
```

This pattern (drawn from the Renovyn manifesto's `CubeShape`) gives you 3D-looking line art that is:
- Pure SVG, no deps
- Prints sharp at any size
- Themable via CSS variables
- Respects the deck's stroke language

Use these as **section divider hero graphics** or as illustration accents on stat slides — never as data visualization.

## 3D — Three.js (full control)

For custom 3D logic / data-driven scenes.

```html
<script type="importmap">
  { "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/"
  } }
</script>

<canvas id="hero-3d" style="width: 100%; height: 480px;"></canvas>

<script type="module">
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  // scene setup ...
</script>
```

Use when Spline can't express the idea (procedural geometry, real-time data, complex shader work).

## Animation — Lottie

For after-effects style vector animations. Smooth, scalable, prints the first frame.

**Add to `<head>`:**

```html
<script src="https://cdn.jsdelivr.net/npm/lottie-web@5.13.0/build/player/lottie.min.js"></script>
```

**Mount:**

```html
<div id="lottie-mark" style="width: 320px; height: 320px;"></div>
<script>
  lottie.loadAnimation({
    container: document.querySelector('#lottie-mark'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'https://example.com/your-animation.json'
  });
</script>
```

**Source files:** lottiefiles.com — large free library. For brand-specific animation, export from After Effects via Bodymovin.

lottie-web plays `.json` exports only. For `.lottie` bundle files, use LottieFiles' web component instead: `<script type="module" src="https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-wc@latest/dist/dotlottie-wc.js"></script>` + `<dotlottie-wc src="..." autoplay loop></dotlottie-wc>`.

## Animation — CSS-only (start here)

Most "subtle motion" wants CSS, not Lottie:

```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.slide.active .display-m { animation: fade-up 0.6s ease both; }
```

Use for entry animations on the active slide only. **Disable in print:**

```css
@media print {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

## When to skip rich media entirely

The editorial aesthetic is largely text-driven. Don't add icons, charts, or 3D unless the content actually benefits. A perfect slide can be all type. A bad slide is a perfect slide plus an icon to prove it's "designed".

**Checklist before adding rich media:**

1. Does the data require visualization? (Yes → chart. No → table.)
2. Does the icon clarify the concept or just decorate? (Decoration → drop it.)
3. Would a reader scanning the PDF see the value of the 3D / animation? (No → use a still image instead.)
4. Does this slide need to print? (Yes → first frame must read.)

## CDN integrity / failover

The deck loads CDN libraries at view time. If a CDN is down, the deck still renders text — only the rich media falls back. Add `defer` and `onerror` for graceful degradation:

```html
<script src="https://cdn.jsdelivr.net/npm/apexcharts@5.16.0/dist/apexcharts.min.js"
        defer
        onerror="document.querySelectorAll('[id^=chart-]').forEach(el => el.innerHTML = '<p class=\'body-s\' style=\'color: var(--stone)\'>Chart unavailable</p>');"></script>
```

## Combined `<head>` example — full rich-media bundle

```html
<head>
  <meta charset="UTF-8" />
  <title>...</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:..." rel="stylesheet" />

  <!-- Icons (always include — tiny) -->
  <script src="https://code.iconify.design/iconify-icon/3.0.2/iconify-icon.min.js" defer></script>

  <!-- Charts (only when deck has charts) -->
  <script src="https://cdn.jsdelivr.net/npm/apexcharts@5.16.0/dist/apexcharts.min.js" defer></script>

  <!-- 3D (only when deck has 3D) -->
  <script type="module" src="https://unpkg.com/@splinetool/viewer@1.12.21/build/spline-viewer.js"></script>

  <!-- Lottie (only when deck has Lottie) -->
  <script src="https://cdn.jsdelivr.net/npm/lottie-web@5.13.0/build/player/lottie.min.js" defer></script>

  <style>...</style>
</head>
```

**Conditional inclusion is important.** Don't load ApexCharts on a deck with no charts — it's 110KB. Only include what the deck actually uses.

## Reporting media usage

After rendering, report which libraries the deck pulls in:

```
Deck written: ...
  Slides:    14
  Aesthetic: editorial
  Media:     iconify (12 icons) · apexcharts (1 chart) · no 3d · no lottie
```
