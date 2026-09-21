/**
 * three.js is imported statically HERE and nowhere else in this application.
 *
 * This file is only ever reached through
 * `await import('./surround-carousel.engine')` in surround-carousel.ts, which
 * makes it an esbuild code-split point — three lands in its own on-demand chunk
 * instead of being hoisted into the shared chunk that every route pulling the
 * component would load. Do NOT add a static `import { ... } from './surround-
 * carousel.engine'` anywhere (a type-only `import type` is fine, it is erased):
 * esbuild would fold the dynamic chunk back into the parent and silently undo
 * the split. Same trap as gsap in caira-level-stack.ts.
 *
 * Named imports only, never `import * as THREE` — the namespace form defeats
 * tree-shaking and drags the whole library in.
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import type { CarouselCard } from './surround-carousel';

export interface SurroundEngineHooks {
  /** 0…1 around the ring. Throttled — see `PROGRESS_EPSILON`. */
  onProgress: (fraction: number) => void;
  onSelect: (index: number) => void;
  /** Called once per run when the image host refuses a CORS read. */
  onTextureBlocked: (host: string) => void;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

/**
 * Canvas 2D and GLSL cannot take a Tailwind class, so the engine reads the
 * design system's custom properties off the host at startup instead of
 * hard-coding hexes. Change the token in styles.css and this follows.
 */
const TOKENS = {
  /** Panel frame. `--secondary` is the near-black surface the cards already use. */
  frame: ['--secondary', 'rgb(38,38,38)'],
  /** Panel text. */
  text: ['--foreground', 'rgb(229,229,229)'],
  /** Panel sub-text. */
  muted: ['--muted-foreground', 'rgb(163,163,163)'],
  /** The card's status dot. */
  cardDot: ['--accent', 'rgb(42,133,255)'],
  /**
   * The cursor-lit dots in the backdrop.
   *
   * `--accent` rather than `--primary` on purpose: `--primary` is rgb(4,72,170),
   * which against `--background` rgb(14,14,14) sits at roughly 1.4:1 — a lit dot
   * would read as *darker* than the unlit white ones, which inverts the effect.
   * `--accent` is the same brand blue with the luminance to carry it. Swap this
   * one entry to '--primary' if the literal token is wanted.
   */
  highlight: ['--accent', 'rgb(42,133,255)'],
} as const;

// ---------------------------------------------------------------------------
// Ring geometry
// ---------------------------------------------------------------------------

/** Panel size in world units. 16:9, matching `horizontal_thumbnail`. */
const CARD_W = 3.05;
const CARD_H = CARD_W * (9 / 16);

/** Gap between neighbouring panels, in the same units. Sets the ring's density. */
const GUTTER = 0.18;

/**
 * Horizontal tessellation of each panel. The panel is bent onto the cylinder by
 * moving its vertices, so this is what decides whether the curve reads as a
 * curve or as a fan of flat strips. 40 is where the silhouette stops improving.
 */
const CURVE_SEGMENTS = 40;

/**
 * Panels the ring aims for, which is really a choice about the angle between
 * neighbours: 2π/20 is 18°, and 18° is what makes a neighbour read as *beside*
 * the centred card rather than folded away from it. At 10 panels (36°) the
 * sides foreshorten so hard that the ring looks like three loose cards.
 *
 * Short lists are repeated to reach it — cheap, because repeated panels share
 * their card's texture. At 20 slots a five-card list repeats every 90°, well
 * outside the ~±55° the camera ever sees.
 */
const TARGET_PANELS = 20;

/** Ceiling on meshes and draw calls for a decorative rail. */
const MAX_PANELS = 26;

const FOV = 38;

/** Fraction of the viewport width the frontmost card should span, per breakpoint. */
const FILL_DESKTOP = 0.34;
const FILL_TABLET = 0.52;
const TABLET_MAX_WIDTH = 1024;

// ---------------------------------------------------------------------------
// Motion
//
// The ring never turns on its own and never snaps to a card. Everything is a
// target angle that `rotation` eases toward, so a drag, a flick, an arrow and
// the page scroll all arrive through the same slow curve.
// ---------------------------------------------------------------------------

/** Radians of target rotation per pixel of drag. */
const DRAG_SENSITIVITY = 0.0042;

/** Radians per pixel of horizontal wheel/trackpad travel. */
const WHEEL_SENSITIVITY = 0.0016;

/**
 * Fraction of the remaining distance covered per 60fps frame. Low on purpose:
 * this is the "slowness" of the whole rail, and it is what makes the ring keep
 * easing after the finger stops rather than tracking it rigidly. ~0.04 puts the
 * time constant near 0.4s.
 */
const EASE = 0.04;

/** How far a release throws the target, as a multiple of the last frame's drag. */
const GLIDE = 14;

/** Below this the ring has arrived and the frame can be skipped. */
const SETTLED_EPSILON = 0.00012;

/**
 * Every rate above is written per 60fps frame and then scaled by how long the
 * real frame took, so the ring eases at the same speed on a 144Hz monitor, a
 * struggling laptop, and a software renderer. The clamp keeps a tab that was
 * backgrounded mid-ease from jumping a quarter turn on its first frame back.
 */
const REFERENCE_FRAME_MS = 1000 / 60;
const MAX_FRAME_SCALE = 3;

/** How far one arrow press moves the target, as a multiple of the panel step. */
const ARROW_STEPS = 1.5;

/**
 * Radians the ring turns across one full pass of the section through the
 * viewport. Small — this is meant to read as parallax, not as a second driver
 * competing with the drag.
 */
const SCROLL_TURN = 0.85;

/** A pointer that moved less than this, for less than this long, is a tap. */
const TAP_DISTANCE = 6;
const TAP_DURATION = 250;

/** Minimum change before the progress hook fires, to keep it off the frame loop. */
const PROGRESS_EPSILON = 0.004;

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

/** Distance in CSS px between dot centres. */
const DOT_SPACING = 26;

/** Unlit dot radius in CSS px — deliberately small, per the design. */
const DOT_RADIUS = 1.0;

/** How much bigger a fully lit dot gets. */
const DOT_LIT_SCALE = 1.7;

/** Radius in CSS px of the pointer's pool of light. */
const DOT_LIGHT_RADIUS = 240;

/** Unlit and lit dot opacity. The lit value is the "a little faded" primary. */
const DOT_ALPHA = 0.07;
const DOT_LIT_ALPHA = 0.5;

/** Approach of the smoothed pointer per 60fps frame, so the pool trails the cursor. */
const POINTER_DAMPING = 0.12;

/** Approach of the glow's strength, so it fades in and out instead of snapping. */
const GLOW_DAMPING = 0.09;

/**
 * Fraction of the stage's height over which the dot field fades out at the top
 * and again at the bottom, so the grid dissolves into the page instead of
 * ending on a hard edge. Mirrors the `mask-t-from-72% mask-b-from-72%` pair on
 * the static layer — keep the two in step or the handover to WebGL will flicker.
 */
const DOT_EDGE_FADE = 0.28;

// ---------------------------------------------------------------------------
// Card artwork
// ---------------------------------------------------------------------------

/**
 * Texture size per card — per *card*, not per panel, since repeated panels
 * share one texture. At the 8-card ceiling that is ~10MB of VRAM; 1024-wide
 * would be ~18MB for a decorative rail. Text is drawn at this size and sampled
 * down by the GPU, which is why the type is set large relative to the canvas.
 */
const TEX_W = 768;
const TEX_H = 432;

/** Matches `--font-sans` (Inter), with the platform stack behind it. */
const FONT_STACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * A cylindrical gallery. N panels sit on the wall of a cylinder of radius R;
 * the camera looks down the axis from just outside it, so the panel at angle 0
 * faces the lens square-on and its neighbours swing away. Each panel is bent
 * onto that same cylinder, which is what a DOM carousel cannot do and the
 * reason this is WebGL at all.
 *
 * Behind the ring, a second full-screen pass draws the dot field and lights the
 * dots nearest the cursor.
 */
export class SurroundEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly ring = new Group();
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();

  /** Backdrop pass: its own scene and an ortho camera, so the quad fills the frame. */
  private readonly backdropScene = new Scene();
  private readonly backdropCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly backdropMaterial: ShaderMaterial;
  private readonly backdropGeometry = new PlaneGeometry(2, 2);

  private meshes: Mesh[] = [];
  private geometry?: PlaneGeometry;
  /** One texture per *unique* card; repeated panels share it. */
  private textures: CanvasTexture[] = [];
  private cards: CarouselCard[] = [];

  private readonly palette: Record<keyof typeof TOKENS, string>;

  private radius = 5.2;
  private angleStep = 0;
  /** Where the ring is easing to. Drag, flick, arrows and scroll all write here. */
  private target = 0;
  /** Where it actually is. Chases `target + scrollRotation` every frame. */
  private rotation = 0;
  /** Last frame's drag delta, used only to throw the target on release. */
  private velocity = 0;
  /** Parallax contribution, recomputed from the stage's position each frame. */
  private scrollRotation = 0;
  private reportedProgress = -1;

  /** Raw pointer in CSS px, and the smoothed value the shader actually uses. */
  private readonly pointer = new Vector2(-9999, -9999);
  private readonly smoothPointer = new Vector2(-9999, -9999);
  /** Target glow strength (1 over the stage, 0 off it) and its eased follower. */
  private pointerStrength = 0;
  private smoothStrength = 0;

  private frame = 0;
  private lastFrameTime = 0;
  private running = false;
  private visible = false;
  private dragging = false;
  private pointerId: number | null = null;
  private lastX = 0;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private corsReported = false;
  private disposed = false;
  private generation = 0;

  private readonly io: IntersectionObserver;
  private readonly ro: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hooks: SurroundEngineHooks,
  ) {
    this.palette = readPalette(canvas);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    // Capping at 2 matters more here than sharpness: a 3x phone-class DPR on a
    // wide canvas quadruples fragment work for a difference nobody sees.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Two passes share the frame, so clearing is ours to schedule.
    this.renderer.autoClear = false;

    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
    this.scene.add(this.ring);

    this.backdropMaterial = createBackdropMaterial(this.palette.highlight);
    this.backdropScene.add(new Mesh(this.backdropGeometry, this.backdropMaterial));

    this.resize();

    // The loop runs only while the rail is on screen and the tab is focused.
    // A home page must not hold a spinning WebGL context three sections above.
    this.io = new IntersectionObserver(
      (entries) => {
        this.visible = entries[0]?.isIntersecting ?? false;
        if (this.visible) this.start();
        else this.stop();
      },
      { threshold: 0.01 },
    );
    this.io.observe(canvas);

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(canvas.parentElement ?? canvas);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    // Not passive: a horizontal trackpad swipe is ours to consume. `deltaY` is
    // deliberately ignored — Lenis owns vertical scroll site-wide, and a rail
    // that eats it is the classic way a carousel traps the page.
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  // -------------------------------------------------------------------------
  // Public surface
  // -------------------------------------------------------------------------

  /** (Re)build the ring. Safe to call repeatedly as the resource refetches. */
  setCards(cards: CarouselCard[]): void {
    if (this.disposed || !cards.length) return;
    if (sameCards(this.cards, cards)) return;

    this.cards = cards;
    this.teardownRing();

    const panelCount = panelCountFor(cards.length);
    this.angleStep = (2 * Math.PI) / panelCount;
    // Derived rather than fixed so the gap between panels is identical whether
    // the ring carries 8 or 26 of them.
    this.radius = (panelCount * (CARD_W + GUTTER)) / (2 * Math.PI);

    this.geometry = curvedPanel(CARD_W, CARD_H, this.radius);

    // One texture per card. Repeated panels reference the same one — the whole
    // point of repeating a short list rather than paginating for more rows.
    const run = ++this.generation;
    this.textures = cards.map((card) => this.createCardTexture(card));
    cards.forEach((card, index) => {
      void this.paintArtwork(card, this.textures[index], run);
    });

    for (let i = 0; i < panelCount; i++) {
      const cardIndex = i % cards.length;
      const material = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: this.textures[cardIndex] },
          uFade: { value: 0 },
          uAspect: { value: CARD_W / CARD_H },
          uRadius: { value: 0.07 },
        },
        vertexShader: PANEL_VERTEX_SHADER,
        fragmentShader: PANEL_FRAGMENT_SHADER,
      });

      const mesh = new Mesh(this.geometry, material);
      mesh.userData['cardIndex'] = cardIndex;
      mesh.userData['slot'] = i;
      this.ring.add(mesh);
      this.meshes.push(mesh);
    }

    this.rotation = 0;
    this.target = 0;
    this.velocity = 0;
    this.reportedProgress = -1;
    this.resize();
    this.layout();
    this.render();
    if (this.visible) this.start();
  }

  /**
   * Move the ring along. There is no card to step to, so this shifts the target
   * by a fixed arc and the same ease carries it there — a press reads as a slow
   * glide, not a jump.
   */
  nudge(direction: number): void {
    this.target -= direction * this.angleStep * ARROW_STEPS;
    this.start();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();

    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);

    this.teardownRing();
    this.backdropGeometry.dispose();
    this.backdropMaterial.dispose();
    this.renderer.dispose();
    // Without this the context survives GC until the browser decides
    // otherwise, and the ~16-context cap is reached by navigation alone.
    this.renderer.forceContextLoss();
  }

  // -------------------------------------------------------------------------
  // Frame loop
  // -------------------------------------------------------------------------

  private start(): void {
    if (this.running || this.disposed || !this.meshes.length) return;
    if (!this.visible || document.visibilityState !== 'visible') return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const scale = Math.min((now - this.lastFrameTime) / REFERENCE_FRAME_MS, MAX_FRAME_SCALE);
    this.lastFrameTime = now;

    this.scrollRotation = this.readScrollRotation();
    const desired = this.target + this.scrollRotation;
    const remaining = desired - this.rotation;

    // Exponential form of both eases, so each takes the same wall-clock time to
    // arrive regardless of frame rate. An exponential ease never actually
    // arrives, so close enough is snapped to exact — otherwise the ring creeps
    // by fractions of a degree forever and never stops asking to be redrawn.
    if (Math.abs(remaining) <= SETTLED_EPSILON) this.rotation = desired;
    else this.rotation += remaining * (1 - Math.pow(1 - EASE, scale));
    this.smoothPointer.lerp(this.pointer, 1 - Math.pow(1 - POINTER_DAMPING, scale));

    // Nothing turns on its own any more, so an idle section would otherwise
    // re-render an identical frame forever. Keep the rAF alive to watch scroll
    // and the cursor, but skip the draw once everything has arrived.
    this.smoothStrength +=
      (this.pointerStrength - this.smoothStrength) * (1 - Math.pow(1 - GLOW_DAMPING, scale));

    // Nothing turns on its own any more, so an idle section would otherwise
    // re-render an identical frame forever. Keep the rAF alive to watch scroll
    // and the cursor, but skip the draw once everything has arrived.
    const pointerMoving = this.smoothPointer.distanceToSquared(this.pointer) > 0.25;
    const glowMoving = Math.abs(this.pointerStrength - this.smoothStrength) > 0.002;
    if (Math.abs(remaining) > SETTLED_EPSILON || pointerMoving || glowMoving) {
      this.layout();
      this.render();
    }

    this.frame = requestAnimationFrame(this.tick);
  };

  /**
   * Parallax, read from the stage's own position rather than a scroll library.
   *
   * `lenis` is in package.json but nothing in this app instantiates it — scroll
   * is native, via `ScrollService`. Measuring the rect each frame is both
   * cheaper than a scroll listener and correct either way, because Lenis (if it
   * is ever added) drives real window scroll, which `getBoundingClientRect`
   * already reflects.
   */
  private readScrollRotation(): number {
    const rect = this.canvas.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    // 0 as the stage enters from the bottom, 1 as it leaves past the top.
    const pass = (viewport - rect.top) / (viewport + rect.height);
    const clamped = Math.min(Math.max(pass, 0), 1);
    return (clamped - 0.5) * SCROLL_TURN;
  }

  /** Place every panel on the ring and tell its shader how far off-centre it is. */
  private layout(): void {
    for (const mesh of this.meshes) {
      const angle = this.rotation + (mesh.userData['slot'] as number) * this.angleStep;
      mesh.position.set(this.radius * Math.sin(angle), 0, this.radius * Math.cos(angle));
      mesh.rotation.y = angle;

      // `uFade` is 0 for the card facing the lens and 1 for the one directly
      // behind the camera, so the shader can recede the sides without us
      // sorting or culling anything. Curved rather than linear: at an 18° step
      // the first neighbour is only a tenth of the way round, and a linear
      // ramp leaves it indistinguishable from the frontmost card.
      const off = Math.pow(Math.abs(shortestAngle(angle)) / Math.PI, 0.75);
      (mesh.material as ShaderMaterial).uniforms['uFade'].value = off;
    }

    // Position around the loop, not an index — there is no selected card. The
    // bar is a place-in-the-loop readout, and it wraps forever like the ring.
    const fraction = wrap01(-this.rotation / (2 * Math.PI));
    if (Math.abs(fraction - this.reportedProgress) >= PROGRESS_EPSILON) {
      this.reportedProgress = fraction;
      this.hooks.onProgress(fraction);
    }
  }

  private render(): void {
    const uniforms = this.backdropMaterial.uniforms;
    uniforms['uPointer'].value.copy(this.smoothPointer);
    uniforms['uStrength'].value = this.smoothStrength;

    this.renderer.clear();
    this.renderer.render(this.backdropScene, this.backdropCamera);
    this.renderer.render(this.scene, this.camera);
  }

  // -------------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------------

  private onResize = (): void => {
    this.resize();
    this.layout();
    this.render();
  };

  /**
   * Camera distance is solved from the card size rather than hard-coded, so the
   * frontmost card keeps its share of the viewport at any window width — the
   * one thing that otherwise breaks the composition on a half-width desktop
   * window.
   */
  private resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth || this.canvas.clientWidth;
    const height = parent?.clientHeight || this.canvas.clientHeight;

    // A zero-sized stage means layout has not settled yet. Sizing to it would
    // give the camera an aspect of 0 or Infinity and render an empty frame that
    // nothing later corrects; the ResizeObserver calls us back once it has a box.
    if (!width || !height) return;

    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const fill = width < TABLET_MAX_WIDTH ? FILL_TABLET : FILL_DESKTOP;
    const halfFov = (FOV * Math.PI) / 360;
    const distance = CARD_W / (2 * Math.tan(halfFov) * aspect * fill);

    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, this.radius + distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const uniforms = this.backdropMaterial.uniforms;
    (uniforms['uResolution'].value as Vector2).set(width, height);
    uniforms['uDpr'].value = this.renderer.getPixelRatio();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.visible) this.start();
    else this.stop();
  };

  private readonly onPointerLeave = (): void => {
    // The pool of light fades rather than vanishing; the smoothed pointer keeps
    // lerping toward the last position, so nothing snaps on the way out.
    this.pointerStrength = 0;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.lastX = this.startX = event.clientX;
    this.startY = event.clientY;
    this.startTime = performance.now();
    this.velocity = 0;
    // Catch the ring mid-ease: without this the old target keeps pulling and
    // the first pixels of the drag fight it.
    this.target = this.rotation - this.scrollRotation;
    this.canvas.setPointerCapture(event.pointerId);
    this.trackPointer(event);
    this.start();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.trackPointer(event);
    this.start();

    if (!this.dragging || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastX;
    this.lastX = event.clientX;
    // The drag moves the *target*; `rotation` eases after it. That lag is what
    // makes the ring feel weighted instead of glued to the cursor.
    this.target += dx * DRAG_SENSITIVITY;
    // Only the most recent movement carries into the throw, otherwise a long
    // slow drag ending in a pause still launches the ring.
    this.velocity = dx * DRAG_SENSITIVITY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    const travel = Math.hypot(event.clientX - this.startX, event.clientY - this.startY);
    const elapsed = performance.now() - this.startTime;

    // A tap opens whatever card was under it. With no selected card there is no
    // "centre it first" rule to apply — what you point at is what you get.
    if (travel < TAP_DISTANCE && elapsed < TAP_DURATION) {
      this.velocity = 0;
      this.handleTap(event);
      return;
    }

    // Throw the target past where the finger stopped and let the ease absorb it.
    this.target += this.velocity * GLIDE;
    this.velocity = 0;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    // Vertical intent belongs to the page. Only claim the event once we are
    // sure the gesture is horizontal.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    this.target -= event.deltaX * WHEEL_SENSITIVITY;
    this.start();
  };

  private trackPointer(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(event.clientX - rect.left, event.clientY - rect.top);
    if (this.pointerStrength === 0) {
      // First contact after entering: jump the smoothed value so the pool
      // appears under the cursor instead of flying in from the last exit.
      this.smoothPointer.copy(this.pointer);
    }
    this.pointerStrength = 1;
  }

  private handleTap(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    if (!hit) return;

    // Panels behind the camera's focus are drawn nearly transparent; treating a
    // hit on one as a click would navigate from something the visitor cannot
    // really see.
    const slot = hit.object.userData['slot'] as number;
    if (Math.abs(shortestAngle(this.rotation + slot * this.angleStep)) > Math.PI / 3) return;

    this.hooks.onSelect(hit.object.userData['cardIndex'] as number);
  }

  // -------------------------------------------------------------------------
  // Artwork
  // -------------------------------------------------------------------------

  /**
   * The panel is not a bare image — it is the reference's window-chrome card:
   * dark frame, title bar with the status dot, artwork below. Drawing all of it
   * into one 2D canvas and uploading that as a single texture is what makes the
   * chrome and the label bend with the panel instead of floating flat over it.
   */
  private createCardTexture(card: CarouselCard): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    drawCardChrome(canvas, card, null, this.palette);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  /**
   * Artwork arrives after the chrome, so a slow CDN never holds up the ring.
   *
   * WebGL will not upload a cross-origin image unless the response carries
   * `Access-Control-Allow-Origin` AND the request was made in CORS mode, so the
   * `crossOrigin` attribute is mandatory and a host without the header fails the
   * load outright. That is reported once and the card keeps its chrome-only
   * form — one origin without a CORS policy must not blank the whole rail.
   */
  private async paintArtwork(
    card: CarouselCard,
    texture: CanvasTexture,
    run: number,
  ): Promise<void> {
    if (!card.image) return;
    const image = await loadCorsImage(card.image);

    // A refetch may have rebuilt the ring while this was in flight; painting
    // into a disposed texture is a silent leak.
    if (this.disposed || run !== this.generation) return;

    if (!image) {
      if (!this.corsReported) {
        this.corsReported = true;
        this.hooks.onTextureBlocked(safeHost(card.image));
      }
      return;
    }

    drawCardChrome(texture.image as HTMLCanvasElement, card, image, this.palette);
    texture.needsUpdate = true;
    this.render();
  }

  // -------------------------------------------------------------------------

  private teardownRing(): void {
    for (const mesh of this.meshes) {
      this.ring.remove(mesh);
      (mesh.material as ShaderMaterial).dispose();
    }
    this.meshes = [];

    // One shared geometry, one texture per unique card — dispose each exactly
    // once, which is why they are tracked separately from the meshes.
    this.geometry?.dispose();
    this.geometry = undefined;
    for (const texture of this.textures) texture.dispose();
    this.textures = [];
  }
}

// ---------------------------------------------------------------------------
// Design-token plumbing
// ---------------------------------------------------------------------------

/**
 * Resolve every token against the live cascade. Painting the value into a 1×1
 * canvas is how the *browser's* colour parser gets used rather than a
 * hand-rolled one, so `rgb()`, `#rrggbb`, `oklch()` and anything else the
 * design system switches to all work unchanged.
 */
function readPalette(host: HTMLElement): Record<keyof typeof TOKENS, string> {
  const computed = getComputedStyle(host);
  const out = {} as Record<keyof typeof TOKENS, string>;
  for (const [key, [token, fallback]] of Object.entries(TOKENS)) {
    const value = computed.getPropertyValue(token).trim();
    out[key as keyof typeof TOKENS] = value || fallback;
  }
  return out;
}

/** CSS colour string → linear-ish 0…1 RGB triple for a uniform. */
function toRgbTriple(colour: string): Vector3 {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const ctx = probe.getContext('2d');
  if (!ctx) return new Vector3(1, 1, 1);
  // An unparseable string leaves fillStyle at its previous value, so seeding
  // with white means a bad token degrades to white rather than to black.
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new Vector3(r / 255, g / 255, b / 255);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * A flat plane bent onto a cylinder, once, at construction. Treating the plane's
 * local x as arc length and solving for the point on the circle keeps the
 * panel's width exact rather than chord-shortened, so neighbouring panels stay
 * evenly gapped however tight the ring gets.
 *
 * The bend CUPS the viewer: local +Z faces the camera, and the edges are pushed
 * toward it, so each card's corners come forward while its middle sits back.
 * Negate this term to bow the cards the other way — that one sign is the whole
 * difference between the two readings of the curve.
 */
function curvedPanel(width: number, height: number, radius: number): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height, CURVE_SEGMENTS, 1);
  const position = geometry.attributes['position'];

  for (let i = 0; i < position.count; i++) {
    const angle = position.getX(i) / radius;
    position.setX(i, radius * Math.sin(angle));
    position.setZ(i, radius - radius * Math.cos(angle));
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Signed distance to 0 radians, in (-π, π]. */
function shortestAngle(angle: number): number {
  const wrapped = ((angle % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI);
  return wrapped - Math.PI;
}

/** Fold any real number into [0, 1). */
function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

/**
 * Repeat a short list until the ring is dense enough. `popular` returns five
 * rows, and five panels on a cylinder is a 72° step — a fan, not a ring.
 * Repeating is cheaper and more honest than paginating for rows marketing did
 * not rank, and costs no extra texture memory.
 */
function panelCountFor(cardCount: number): number {
  const repeats = Math.max(1, Math.round(TARGET_PANELS / cardCount));
  return Math.min(cardCount * repeats, MAX_PANELS);
}

function sameCards(a: readonly CarouselCard[], b: readonly CarouselCard[]): boolean {
  return a.length === b.length && a.every((card, i) => card.id === b[i].id);
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'the image host';
  }
}

function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

// ---------------------------------------------------------------------------
// Card painting
// ---------------------------------------------------------------------------

function drawCardChrome(
  canvas: HTMLCanvasElement,
  card: CarouselCard,
  artwork: HTMLImageElement | null,
  palette: Record<keyof typeof TOKENS, string>,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const barHeight = 58;
  const inset = 12;
  const bodyTop = barHeight + inset;
  const bodyHeight = TEX_H - bodyTop - inset;
  const bodyWidth = TEX_W - inset * 2;

  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = palette.frame;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Title bar: status dot at the left, window dots at the right, title between.
  ctx.fillStyle = palette.cardDot;
  ctx.beginPath();
  ctx.arc(30, barHeight / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = palette.muted;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(TEX_W - 30 - i * 16, barHeight / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = palette.text;
  ctx.globalAlpha = 0.78;
  ctx.font = `500 21px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(ellipsize(ctx, card.title, TEX_W - 110), 50, barHeight / 2 + 1);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, barHeight, TEX_W, 1);

  // Body.
  ctx.save();
  roundedRectPath(ctx, inset, bodyTop, bodyWidth, bodyHeight, 12);
  ctx.clip();

  if (artwork) {
    drawCover(ctx, artwork, inset, bodyTop, bodyWidth, bodyHeight);
  } else {
    // No artwork (missing URL, or an image host without a CORS policy). A
    // typographic panel is a deliberate-looking fallback; an empty slot is not.
    ctx.fillStyle = palette.frame;
    ctx.fillRect(inset, bodyTop, bodyWidth, bodyHeight);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = palette.text;
    ctx.fillRect(inset, bodyTop, bodyWidth, bodyHeight);
    ctx.globalAlpha = 0.16;
    ctx.font = `700 46px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(card.caption, TEX_W / 2, bodyTop + bodyHeight / 2);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Scrim, so the caption stays legible over any artwork.
  const scrim = ctx.createLinearGradient(0, bodyTop + bodyHeight - 110, 0, bodyTop + bodyHeight);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(inset, bodyTop + bodyHeight - 110, bodyWidth, 110);
  ctx.restore();

  ctx.fillStyle = palette.text;
  ctx.globalAlpha = 0.88;
  ctx.font = `600 20px ${FONT_STACK}`;
  ctx.fillText(card.caption, inset + 20, TEX_H - inset - 22);
  ctx.globalAlpha = 1;
}

/** `object-fit: cover`, by hand, because canvas has no such thing. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

/**
 * The dot field, and the pool of light the cursor drags across it. Rendered as
 * one full-screen quad before the ring: a shader is the only way to light the
 * dots *individually* by distance, which a CSS gradient cannot do at all.
 */
function createBackdropMaterial(highlight: string): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uResolution: { value: new Vector2(1, 1) },
      uPointer: { value: new Vector2(-9999, -9999) },
      uDpr: { value: 1 },
      uStrength: { value: 0 },
      uHighlight: { value: toRgbTriple(highlight) },
      uSpacing: { value: DOT_SPACING },
      uRadius: { value: DOT_RADIUS },
      uLitScale: { value: DOT_LIT_SCALE },
      uLightRadius: { value: DOT_LIGHT_RADIUS },
      uAlpha: { value: DOT_ALPHA },
      uLitAlpha: { value: DOT_LIT_ALPHA },
      uEdgeFade: { value: DOT_EDGE_FADE },
    },
    vertexShader: BACKDROP_VERTEX_SHADER,
    fragmentShader: BACKDROP_FRAGMENT_SHADER,
  });
}

// ---------------------------------------------------------------------------
// Shaders (GLSL 1 — ShaderMaterial's default, works on WebGL 1 and 2 alike)
// ---------------------------------------------------------------------------

const PANEL_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PANEL_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform sampler2D uMap;
  uniform float uFade;    // 0 facing the lens .. 1 directly behind the camera
  uniform float uAspect;  // panel width / height, so corners stay circular
  uniform float uRadius;  // corner radius, in units of panel height

  varying vec2 vUv;

  // Signed distance to a rounded rectangle, evaluated in aspect-corrected UV
  // space. Rounding here rather than in the texture keeps the corners crisp at
  // every distance instead of inheriting the texture's own antialiasing.
  float roundedBoxAlpha(vec2 uv, float radius) {
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    vec2 b = vec2(0.5 * uAspect, 0.5) - radius;
    vec2 q = abs(p) - b;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    return 1.0 - smoothstep(-0.004, 0.004, d);
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float alpha = roundedBoxAlpha(vUv, uRadius) * tex.a;
    if (alpha <= 0.001) discard;

    // Off-centre panels darken and thin out, which is what gives the ring its
    // depth without a single light in the scene. Tuned to keep the immediate
    // neighbours readable — they are part of the composition, not scenery.
    vec3 colour = mix(tex.rgb, tex.rgb * 0.45, uFade);
    gl_FragColor = vec4(colour, alpha * mix(1.0, 0.55, uFade));
  }
`;

const BACKDROP_VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BACKDROP_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform vec2 uResolution;   // CSS px
  uniform vec2 uPointer;      // CSS px, origin top-left
  uniform float uDpr;
  uniform float uStrength;    // 1 while the cursor is over the stage, else 0
  uniform vec3 uHighlight;
  uniform float uSpacing;
  uniform float uRadius;
  uniform float uLitScale;
  uniform float uLightRadius;
  uniform float uAlpha;
  uniform float uLitAlpha;
  uniform float uEdgeFade;

  void main() {
    // gl_FragCoord counts up from the bottom in device pixels; the pointer
    // counts down from the top in CSS pixels. Convert once, here.
    vec2 px = vec2(gl_FragCoord.x / uDpr, uResolution.y - gl_FragCoord.y / uDpr);

    // Which dot's cell are we in, and where is that dot's centre?
    vec2 cellIndex = floor(px / uSpacing);
    vec2 centre = (cellIndex + 0.5) * uSpacing;

    // Light the whole dot from its centre, never per-fragment — otherwise a dot
    // straddling the falloff edge would be lit down one side.
    float glow = 1.0 - smoothstep(0.0, uLightRadius, distance(centre, uPointer));
    glow = pow(glow, 1.3) * uStrength;

    float radius = uRadius * mix(1.0, uLitScale, glow);
    // A fixed 0.75px feather: enough to antialias, tight enough that a 1px dot
    // does not dissolve into a smudge.
    float mask = 1.0 - smoothstep(radius - 0.75, radius + 0.75, distance(px, centre));
    if (mask <= 0.001) discard;

    // Fade the field out toward the top and bottom edges. Distance to the
    // nearer edge, normalised over the fade band, smoothed so the ramp has no
    // visible start.
    float edge = min(px.y, uResolution.y - px.y) / max(uResolution.y * uEdgeFade, 1.0);
    float fade = smoothstep(0.0, 1.0, clamp(edge, 0.0, 1.0));

    vec3 colour = mix(vec3(1.0), uHighlight, glow);
    float alpha = mix(uAlpha, uLitAlpha, glow);
    gl_FragColor = vec4(colour, alpha * mask * fade);
  }
`;
