"use client";

import React from "react";

type StarBorderProps<T extends React.ElementType> =
  React.ComponentPropsWithoutRef<T> & {
    as?: T;
    className?: string;
    children?: React.ReactNode;
    color?: string;
    speed?: React.CSSProperties["animationDuration"];
    thickness?: number;
    contentClassName?: string;
  };

export default function StarBorder<T extends React.ElementType = "button">({
  as,
  className = "",
  color = "#d4af77",
  speed = "5s",
  thickness = 1,
  children,
  contentClassName = "",
  ...rest
}: StarBorderProps<T>) {
  const Component = as || "button";

  return (
    <Component
      className={`relative inline-block overflow-hidden rounded-2xl ${className}`}
      {...(rest as object)}
      style={{
        padding: `${thickness}px`,
        ...((rest as { style?: React.CSSProperties }).style || {}),
      }}
    >
      <span
        className="animate-star-movement-bottom absolute bottom-[-11px] right-[-250%] z-0 h-[50%] w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 12%)`,
          animationDuration: speed,
        }}
      />
      <span
        className="animate-star-movement-top absolute left-[-250%] top-[-10px] z-0 h-[50%] w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 12%)`,
          animationDuration: speed,
        }}
      />
      <span
        className={`relative z-[1] block rounded-[calc(1rem-1px)] ${contentClassName}`}
      >
        {children}
      </span>
    </Component>
  );
}
