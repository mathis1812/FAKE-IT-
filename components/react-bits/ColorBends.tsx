"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";

const frag = `
precision mediump float;
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform vec3 uColor;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform float uNoise;
uniform float uBandWidth;
uniform float uYOffset;
uniform float uFadeTop;
uniform vec2 uPointer;
uniform float uMouseInfluence;
uniform int uIterations;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 uv = vUv;
  uv.y += uYOffset;
  vec2 p = uv * 2.0 - 1.0;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  float aspect = uCanvas.x / uCanvas.y;
  vec2 q = vec2(rp.x * aspect, rp.y);
  float invScale = 1.0 / max(uScale, 0.0001);
  q *= invScale;
  q /= 0.5 + 0.2 * dot(q, q);
  q += (uPointer - rp) * uMouseInfluence * 0.2;
  q += 0.2 * cos(t) - 7.56;

  for (int i = 0; i < 5; i++) {
    if (i >= uIterations) break;
    vec2 r = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
    q = q + (r - q) * uWarpStrength;
  }

  float m = length(q + sin(5.0 * q.y * uFrequency - 3.0 * t) * 0.25);

  float w = 1.0 - exp(-6.0 / exp(6.0 * m));
  w = pow(clamp(w, 0.0, 1.0), uBandWidth);
  w *= smoothstep(uFadeTop, 0.0, vUv.y);
  w *= uIntensity;

  vec3 col = uColor * w;
  col += (fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uNoise;
  col = clamp(col, 0.0, 1.0) * w;

  gl_FragColor = vec4(col, w);
}
`;

const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

type ColorBendsProps = {
  className?: string;
  style?: CSSProperties;
  color?: string;
  rotation?: number;
  speed?: number;
  scale?: number;
  frequency?: number;
  warpStrength?: number;
  noise?: number;
  bandWidth?: number;
  yOffset?: number;
  /** Hauteur (0-1, en UV) au-delà de laquelle le fond est masqué vers le haut. */
  fadeTop?: number;
  mouseInfluence?: number;
  iterations?: number;
  intensity?: number;
};

function hexToVector3(hex: string): THREE.Vector3 {
  const h = hex.replace("#", "").trim();
  const v =
    h.length === 3
      ? [
          parseInt(h[0] + h[0], 16),
          parseInt(h[1] + h[1], 16),
          parseInt(h[2] + h[2], 16),
        ]
      : [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4, 6), 16),
        ];
  return new THREE.Vector3(v[0] / 255, v[1] / 255, v[2] / 255);
}

/**
 * ColorBends (React Bits) — bande de couleur unique animée en WebGL.
 *
 * Port fidèle du shader utilisé sur le hero de reactbits.dev (variante à
 * couleur unique + `fadeTop`, distincte de l'ancien composant multi-couleurs).
 *
 * Écarts assumés par rapport à la source d'origine :
 * - le pointeur est écouté sur `window` et non sur le conteneur : celui-ci sert
 *   de fond en `pointer-events: none`, il ne recevrait donc jamais d'événement
 *   et `mouseInfluence` resterait sans effet ;
 * - l'effet de mise en place ne dépend plus des props : un second effet met
 *   déjà à jour les uniformes à chaque changement, sans détruire le contexte
 *   WebGL ;
 * - la boucle s'arrête quand l'onglet est masqué et sous prefers-reduced-motion ;
 * - création du renderer protégée : sans WebGL on abandonne au lieu de lever ;
 * - `className` a une valeur par défaut, sinon la classe rendue contenait
 *   littéralement « undefined ».
 */
export default function ColorBends({
  className = "",
  style,
  color = "#A855F7",
  rotation = 0,
  speed = 0.2,
  scale = 1,
  frequency = 1,
  warpStrength = 11,
  noise = 0.05,
  bandWidth = 1.4,
  yOffset = 0,
  fadeTop = 0.3,
  mouseInfluence = 0.3,
  iterations = 1,
  intensity = 1,
}: ColorBendsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const initRef = useRef({
    speed,
    scale,
    frequency,
    warpStrength,
    noise,
    bandWidth,
    yOffset,
    fadeTop,
    mouseInfluence,
    iterations,
    intensity,
  });
  initRef.current = {
    speed,
    scale,
    frequency,
    warpStrength,
    noise,
    bandWidth,
    yOffset,
    fadeTop,
    mouseInfluence,
    iterations,
    intensity,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const init = initRef.current;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance",
        alpha: true,
      });
    } catch {
      // WebGL indisponible : le fond reste le dégradé CSS, rien ne casse.
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uCanvas: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uSpeed: { value: init.speed },
        uRot: { value: new THREE.Vector2(1, 0) },
        uColor: { value: hexToVector3(color) },
        uScale: { value: init.scale },
        uFrequency: { value: init.frequency },
        uWarpStrength: { value: init.warpStrength },
        uNoise: { value: init.noise },
        uBandWidth: { value: init.bandWidth },
        uYOffset: { value: init.yOffset },
        uFadeTop: { value: init.fadeTop },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uMouseInfluence: { value: init.mouseInfluence },
        uIterations: { value: init.iterations },
        uIntensity: { value: init.intensity },
      },
      premultipliedAlpha: true,
      transparent: true,
    });
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Deux couches animées cohabitent dans le fond : on plafonne le ratio de
    // pixels pour ne pas quadrupler le coût du fragment shader sur écran retina.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const pointerTarget = new THREE.Vector2(0, 0);
    const pointerCurrent = new THREE.Vector2(0, 0);
    const pointerSmooth = 4;
    const rect = { left: 0, top: 0, width: 1, height: 1 };

    const handleResize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      material.uniforms.uCanvas.value.set(w, h);
      const box = container.getBoundingClientRect();
      rect.left = box.left;
      rect.top = box.top;
      rect.width = box.width || 1;
      rect.height = box.height || 1;
    };

    const renderFrame = () => renderer.render(scene, camera);

    let frame = 0;

    const loop = () => {
      frame = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      material.uniforms.uTime.value = clock.elapsedTime;

      pointerCurrent.lerp(pointerTarget, Math.min(1, dt * pointerSmooth));
      material.uniforms.uPointer.value.copy(pointerCurrent);

      renderFrame();
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
      clock.getDelta();
      frame = requestAnimationFrame(loop);
    };

    const sync = () => {
      if (document.hidden || reducedMotion.matches) {
        stop();
        renderFrame();
      } else {
        start();
      }
    };

    // Écoute sur window : le conteneur est un fond en pointer-events: none.
    const handlePointerMove = (event: PointerEvent) => {
      pointerTarget.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    const rad = (rotation * Math.PI) / 180;
    material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));

    renderFrame();
    start();

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);

    return () => {
      stop();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      materialRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uSpeed.value = speed;
    material.uniforms.uScale.value = scale;
    material.uniforms.uFrequency.value = frequency;
    material.uniforms.uWarpStrength.value = warpStrength;
    material.uniforms.uNoise.value = noise;
    material.uniforms.uBandWidth.value = bandWidth;
    material.uniforms.uYOffset.value = yOffset;
    material.uniforms.uFadeTop.value = fadeTop;
    material.uniforms.uMouseInfluence.value = mouseInfluence;
    material.uniforms.uIterations.value = iterations;
    material.uniforms.uIntensity.value = intensity;
    material.uniforms.uColor.value.copy(hexToVector3(color));

    const rad = (rotation * Math.PI) / 180;
    material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));
  }, [
    color,
    rotation,
    speed,
    scale,
    frequency,
    warpStrength,
    noise,
    bandWidth,
    yOffset,
    fadeTop,
    mouseInfluence,
    iterations,
    intensity,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ mixBlendMode: "screen", ...style }}
    />
  );
}
