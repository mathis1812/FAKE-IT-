"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

interface MagnetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
}

export default function Magnet({
  children,
  padding = 80,
  disabled = false,
  magnetStrength = 3.2,
  activeTransition = "transform 0.25s ease-out",
  inactiveTransition = "transform 0.45s ease-in-out",
  wrapperClassName = "",
  innerClassName = "",
  ...props
}: MagnetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const rest = () => {
      inner.style.transform = "translate3d(0, 0, 0)";
    };

    if (disabled) {
      rest();
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      rest();
      return;
    }

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let active = false;

    // Le calcul est fait dans une frame d'animation et écrit directement dans
    // le style : pas de setState, donc aucun rendu React sur mousemove.
    const apply = () => {
      frame = 0;
      const rect = wrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const inRange =
        Math.abs(centerX - pointerX) < rect.width / 2 + padding &&
        Math.abs(centerY - pointerY) < rect.height / 2 + padding;

      if (inRange) {
        if (!active) {
          active = true;
          inner.style.transition = activeTransition;
        }
        const offsetX = (pointerX - centerX) / magnetStrength;
        const offsetY = (pointerY - centerY) / magnetStrength;
        inner.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
      } else if (active) {
        active = false;
        inner.style.transition = inactiveTransition;
        rest();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frame) cancelAnimationFrame(frame);
      rest();
    };
  }, [
    padding,
    disabled,
    magnetStrength,
    activeTransition,
    inactiveTransition,
  ]);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      style={{ position: "relative", display: "inline-block" }}
      {...props}
    >
      <div
        ref={innerRef}
        className={innerClassName}
        style={{ transition: inactiveTransition, willChange: "transform" }}
      >
        {children}
      </div>
    </div>
  );
}
