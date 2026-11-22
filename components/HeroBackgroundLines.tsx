"use client";

import { useEffect, useRef } from "react";

/**
 * GPU-composited architectural blueprint background.
 * - Uses pure CSS gradients + transform-only keyframes (zero SVG feGaussianBlur / stroke-dashoffset CPU repaints)
 * - Updates desktop cursor spotlight via CSS custom properties without React re-renders
 * - Automatically pauses animations when scrolled out of view and skips pointer tracking on coarse touch screens
 */
export default function HeroBackgroundLines() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

    let isVisible = true;
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              isVisible = entry?.isIntersecting ?? true;
              el.dataset.paused = isVisible ? "false" : "true";
            },
            { threshold: 0.01 }
          )
        : null;

    observer?.observe(el);

    if (prefersReducedMotion || isCoarsePointer) {
      return () => {
        observer?.disconnect();
      };
    }

    const gridSpacing = 48;
    let rafId: number | null = null;
    let pendingEvent: MouseEvent | null = null;
    let cachedRect: DOMRect | null = null;

    const refreshRect = () => {
      const section = document.getElementById("hero-section") || el;
      cachedRect = section.getBoundingClientRect();
    };
    refreshRect();

    const handleMouseMove = (e: MouseEvent) => {
      if (!isVisible) return;
      pendingEvent = e;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const ev = pendingEvent;
        pendingEvent = null;
        if (!ev) return;

        const rect = cachedRect || (document.getElementById("hero-section") || el).getBoundingClientRect();
        const inside =
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom;

        if (inside) {
          const snapX = Math.round((ev.clientX - rect.left) / gridSpacing) * gridSpacing;
          const snapY = Math.round((ev.clientY - rect.top) / gridSpacing) * gridSpacing;
          el.style.setProperty("--hero-mx", `${snapX}px`);
          el.style.setProperty("--hero-my", `${snapY}px`);
          el.style.setProperty("--hero-hover", "1");
        } else {
          el.style.setProperty("--hero-hover", "0");
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("resize", refreshRect, { passive: true });
    window.addEventListener("scroll", refreshRect, { passive: true });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", refreshRect);
      window.removeEventListener("scroll", refreshRect);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-paused="false"
      className="hero-blueprint absolute inset-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes heroBeamX {
          from { transform: translate3d(-25%, 0, 0); }
          to { transform: translate3d(125%, 0, 0); }
        }
        @keyframes heroBeamY {
          from { transform: translate3d(0, -25%, 0); }
          to { transform: translate3d(0, 125%, 0); }
        }
        .hero-blueprint {
          --hero-mx: -500px;
          --hero-my: -500px;
          --hero-hover: 0;
        }
        .hero-blueprint[data-paused="true"] .hero-beam {
          animation-play-state: paused;
        }
        .hero-grid-base {
          background-image:
            linear-gradient(to right, rgba(0, 135, 90, 0.10) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 135, 90, 0.10) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.55) 65%, rgba(0, 0, 0, 0.1) 100%);
        }
        .hero-grid-spotlight {
          background-image:
            linear-gradient(to right, rgba(0, 135, 90, 0.34) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 135, 90, 0.34) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: var(--hero-hover);
          transition: opacity 250ms ease;
          mask-image: radial-gradient(240px circle at var(--hero-mx) var(--hero-my), #000 0%, rgba(0, 0, 0, 0.4) 55%, transparent 100%);
          -webkit-mask-image: radial-gradient(240px circle at var(--hero-mx) var(--hero-my), #000 0%, rgba(0, 0, 0, 0.4) 55%, transparent 100%);
        }
        .hero-beam-h {
          position: absolute;
          left: 0;
          width: 24%;
          height: 1.5px;
          background: linear-gradient(90deg, transparent, rgba(0, 135, 90, 0.65), transparent);
          will-change: transform;
          animation: heroBeamX 9s linear infinite;
        }
        .hero-beam-v {
          position: absolute;
          top: 0;
          width: 1.5px;
          height: 28%;
          background: linear-gradient(180deg, transparent, rgba(0, 135, 90, 0.6), transparent);
          will-change: transform;
          animation: heroBeamY 8s linear infinite;
        }
      `}</style>

      {/* Static blueprint grid */}
      <div className="hero-grid-base absolute inset-0" />

      {/* Desktop cursor-illuminated grid (pure CSS variable mask — zero React re-renders) */}
      <div className="hero-grid-spotlight absolute inset-0 hidden md:block" />

      {/* Subtle GPU-composited accent tracks (transform-only, paused off-screen) */}
      <div className="absolute inset-0 opacity-65">
        <div className="absolute inset-x-0 top-[20%] h-px bg-emerald-600/15" />
        <div className="hero-beam hero-beam-h top-[20%]" />

        <div className="absolute inset-x-0 top-[76%] h-px bg-emerald-600/15" />
        <div
          className="hero-beam hero-beam-h top-[76%]"
          style={{ animationDuration: "12s", animationDirection: "reverse" }}
        />

        <div className="absolute inset-y-0 left-[14%] w-px bg-emerald-600/15 hidden sm:block" />
        <div
          className="hero-beam hero-beam-v left-[14%] hidden sm:block"
          style={{ animationDelay: "-2s" }}
        />

        <div className="absolute inset-y-0 left-[86%] w-px bg-emerald-600/15 hidden sm:block" />
        <div
          className="hero-beam hero-beam-v left-[86%] hidden sm:block"
          style={{ animationDuration: "10s", animationDirection: "reverse" }}
        />
      </div>
    </div>
  );
}
