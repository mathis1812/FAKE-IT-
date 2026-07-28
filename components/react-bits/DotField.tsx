"use client";

import { memo, useEffect, useRef } from "react";

const TWO_PI = Math.PI * 2;

type Dot = {
  ax: number;
  ay: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type DotFieldProps = {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
  className?: string;
};

/**
 * DotField (React Bits) — grille de points réactive au curseur.
 *
 * Écarts assumés par rapport à la source d'origine :
 * - positions du curseur en coordonnées viewport (clientX/clientY) et non
 *   page (pageX/pageY) : le conteneur étant en position fixed, les offsets de
 *   scroll désalignaient l'interaction dès qu'on faisait défiler la page ;
 * - le calcul de vitesse du curseur se fait dans la frame d'animation au lieu
 *   d'un setInterval de 20 ms, ce qui supprime un timer permanent ;
 * - la boucle s'arrête quand l'onglet est masqué et sous prefers-reduced-motion ;
 * - le dégradé de remplissage est mis en cache au lieu d'être recréé à chaque
 *   frame ;
 * - ResizeObserver sur le conteneur au lieu d'un écouteur resize global.
 */
const DotField = memo(function DotField({
  dotRadius = 1.5,
  dotSpacing = 14,
  cursorRadius = 500,
  cursorForce = 0.1,
  bulgeOnly = true,
  bulgeStrength = 67,
  glowRadius = 160,
  sparkle = false,
  waveAmplitude = 0,
  gradientFrom = "rgba(168, 85, 247, 0.35)",
  gradientTo = "rgba(180, 151, 207, 0.25)",
  glowColor = "#120F17",
  className = "",
}: DotFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const glowIdRef = useRef(
    `dot-field-glow-${Math.random().toString(36).slice(2, 9)}`,
  );

  const propsRef = useRef({
    dotRadius,
    dotSpacing,
    cursorRadius,
    cursorForce,
    bulgeOnly,
    bulgeStrength,
    sparkle,
    waveAmplitude,
    gradientFrom,
    gradientTo,
  });
  propsRef.current = {
    dotRadius,
    dotSpacing,
    cursorRadius,
    cursorForce,
    bulgeOnly,
    bulgeStrength,
    sparkle,
    waveAmplitude,
    gradientFrom,
    gradientTo,
  };

  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const glowEl = glowRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = { w: 0, h: 0, left: 0, top: 0 };
    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };
    let dots: Dot[] = [];
    let gradient: CanvasGradient | null = null;
    let engagement = 0;
    let glowOpacity = 0;
    let frameCount = 0;
    let frame = 0;

    const buildDots = (w: number, h: number) => {
      const p = propsRef.current;
      const step = p.dotRadius + p.dotSpacing;
      const cols = Math.floor(w / step);
      const rows = Math.floor(h / step);
      if (cols <= 0 || rows <= 0) {
        dots = [];
        return;
      }
      const padX = (w % step) / 2;
      const padY = (h % step) / 2;
      const next: Dot[] = new Array(rows * cols);
      let idx = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          next[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
        }
      }
      dots = next;
    };

    const measure = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      size.w = rect.width;
      size.h = rect.height;
      // Conteneur en position fixed : le rect suffit, sans offset de scroll.
      size.left = rect.left;
      size.top = rect.top;

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      gradient = ctx.createLinearGradient(0, 0, size.w, size.h);
      gradient.addColorStop(0, propsRef.current.gradientFrom);
      gradient.addColorStop(1, propsRef.current.gradientTo);

      buildDots(size.w, size.h);
      return true;
    };

    const draw = () => {
      const p = propsRef.current;
      const len = dots.length;
      const wave = frameCount * 0.02;

      ctx.clearRect(0, 0, size.w, size.h);
      if (!gradient || len === 0) return;
      ctx.fillStyle = gradient;

      const cr = p.cursorRadius;
      const crSq = cr * cr;
      const rad = p.dotRadius / 2;
      const isBulge = p.bulgeOnly;
      const eng = engagement;

      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const d = dots[i];
        const dx = mouse.x - d.ax;
        const dy = mouse.y - d.ay;
        const distSq = dx * dx + dy * dy;

        if (distSq < crSq && eng > 0.01) {
          const dist = Math.sqrt(distSq);
          if (isBulge) {
            const falloff = 1 - dist / cr;
            const push = falloff * falloff * p.bulgeStrength * eng;
            const angle = Math.atan2(dy, dx);
            d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
            d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
          } else if (dist > 0) {
            const angle = Math.atan2(dy, dx);
            const move = (500 / dist) * (mouse.speed * p.cursorForce);
            d.vx += Math.cos(angle) * -move;
            d.vy += Math.sin(angle) * -move;
          }
        } else if (isBulge) {
          d.sx += (d.ax - d.sx) * 0.1;
          d.sy += (d.ay - d.sy) * 0.1;
        }

        if (!isBulge) {
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x = d.ax + d.vx;
          d.y = d.ay + d.vy;
          d.sx += (d.x - d.sx) * 0.1;
          d.sy += (d.y - d.sy) * 0.1;
        }

        let drawX = d.sx;
        let drawY = d.sy;
        if (p.waveAmplitude > 0) {
          drawY += Math.sin(d.ax * 0.03 + wave) * p.waveAmplitude;
          drawX += Math.cos(d.ay * 0.03 + wave * 0.7) * p.waveAmplitude * 0.5;
        }

        let r = rad;
        if (p.sparkle) {
          const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
          if (hash % 100 < 3) r = rad * 1.8;
        }

        ctx.moveTo(drawX + r, drawY);
        ctx.arc(drawX, drawY, r, 0, TWO_PI);
      }

      ctx.fill();
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      frameCount++;

      // Vitesse du curseur mesurée dans la frame : plus de timer parallèle.
      const dx = mouse.prevX - mouse.x;
      const dy = mouse.prevY - mouse.y;
      const moved = Math.sqrt(dx * dx + dy * dy);
      mouse.speed += (moved - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;

      const target = Math.min(mouse.speed / 5, 1);
      engagement += (target - engagement) * 0.06;
      if (engagement < 0.001) engagement = 0;

      glowOpacity += (engagement - glowOpacity) * 0.08;
      if (glowEl) {
        glowEl.setAttribute("cx", String(mouse.x));
        glowEl.setAttribute("cy", String(mouse.y));
        glowEl.style.opacity = String(glowOpacity);
      }

      draw();
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const start = () => {
      if (frame || document.hidden || reducedMotion.matches) return;
      frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      mouse.x = event.clientX - size.left;
      mouse.y = event.clientY - size.top;
    };

    // Sans ça, les points restent déformés quand le curseur quitte la fenêtre.
    const onPointerLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const sync = () => {
      if (document.hidden || reducedMotion.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (measure() && !frame) draw();
    });
    resizeObserver.observe(container);

    measure();
    draw();
    start();

    rebuildRef.current = () => {
      if (size.w > 0 && size.h > 0) {
        buildDots(size.w, size.h);
        if (!frame) draw();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);

    return () => {
      stop();
      rebuildRef.current = null;
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    rebuildRef.current?.();
  }, [dotRadius, dotSpacing]);

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <radialGradient id={glowIdRef.current}>
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle
          ref={glowRef}
          cx="-9999"
          cy="-9999"
          r={glowRadius}
          fill={`url(#${glowIdRef.current})`}
          style={{ opacity: 0, willChange: "opacity" }}
        />
      </svg>
    </div>
  );
});

export default DotField;
