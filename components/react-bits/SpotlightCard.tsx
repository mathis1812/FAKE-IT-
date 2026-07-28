"use client";

import React, { useRef, useState } from "react";

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: `rgba(${number}, ${number}, ${number}, ${number})`;
}

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(212, 175, 119, 0.18)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => {
        setIsFocused(true);
        setOpacity(0.7);
      }}
      onBlur={() => {
        setIsFocused(false);
        setOpacity(0);
      }}
      onMouseEnter={() => setOpacity(0.7)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12100e]/90 backdrop-blur-xl ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          background: `radial-gradient(520px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
