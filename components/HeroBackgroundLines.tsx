"use client";

import React, { useEffect, useRef, useState } from "react";

export default function HeroBackgroundLines() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 });
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const gridSpacing = 48;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);

    const handleWindowMouseMove = (e: MouseEvent) => {
      const section = document.getElementById("hero-section") || el;
      const rect = section.getBoundingClientRect();

      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("mousemove", handleWindowMouseMove);
    };
  }, []);

  const { width, height } = dimensions;

  // Snapped to nearest grid line for an authentic architectural/engineering line effect
  const snappedX = Math.round(mousePos.x / gridSpacing) * gridSpacing;
  const snappedY = Math.round(mousePos.y / gridSpacing) * gridSpacing;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes lineFlowH {
          0% {
            stroke-dashoffset: 1200;
          }
          100% {
            stroke-dashoffset: -1200;
          }
        }
        @keyframes lineFlowV {
          0% {
            stroke-dashoffset: 800;
          }
          100% {
            stroke-dashoffset: -800;
          }
        }
        @keyframes nodePulse {
          0%, 100% {
            transform: scale(0.9);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.35);
            opacity: 0.95;
          }
        }

        .anim-beam-h1 {
          stroke-dasharray: 140 600;
          animation: lineFlowH 7s linear infinite;
        }
        .anim-beam-h2 {
          stroke-dasharray: 180 750;
          animation: lineFlowH 10s linear infinite reverse;
        }
        .anim-beam-h3 {
          stroke-dasharray: 120 500;
          animation: lineFlowH 8.5s linear infinite;
          animation-delay: -3s;
        }
        .anim-beam-v1 {
          stroke-dasharray: 110 500;
          animation: lineFlowV 6.5s linear infinite;
        }
        .anim-beam-v2 {
          stroke-dasharray: 130 620;
          animation: lineFlowV 9s linear infinite reverse;
        }
        .anim-beam-v3 {
          stroke-dasharray: 100 480;
          animation: lineFlowV 8s linear infinite;
          animation-delay: -2s;
        }
        .anim-node {
          transform-box: fill-box;
          transform-origin: center;
          animation: nodePulse 3.5s ease-in-out infinite;
        }
      `}</style>

      <svg
        className="w-full h-full absolute inset-0"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          {/* Base ambient green grid pattern */}
          <pattern
            id="hero-ambient-grid"
            width={gridSpacing}
            height={gridSpacing}
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1={gridSpacing}
              x2={gridSpacing}
              y2={gridSpacing}
              stroke="#00875A"
              strokeWidth="0.8"
              strokeOpacity={isHovered ? 0.16 : 0.1}
              className="transition-all duration-300"
            />
            <line
              x1={gridSpacing}
              y1="0"
              x2={gridSpacing}
              y2={gridSpacing}
              stroke="#00875A"
              strokeWidth="0.8"
              strokeOpacity={isHovered ? 0.16 : 0.1}
              className="transition-all duration-300"
            />
            <circle
              cx={gridSpacing}
              cy={gridSpacing}
              r="1"
              fill="#00875A"
              fillOpacity={isHovered ? 0.35 : 0.22}
              className="transition-all duration-300"
            />
          </pattern>

          {/* Brighter illuminated grid for the hover spotlight */}
          <pattern
            id="hero-hover-grid"
            width={gridSpacing}
            height={gridSpacing}
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1={gridSpacing}
              x2={gridSpacing}
              y2={gridSpacing}
              stroke="#00875A"
              strokeWidth="1.25"
              strokeOpacity="0.45"
            />
            <line
              x1={gridSpacing}
              y1="0"
              x2={gridSpacing}
              y2={gridSpacing}
              stroke="#00875A"
              strokeWidth="1.25"
              strokeOpacity="0.45"
            />
            <circle
              cx={gridSpacing}
              cy={gridSpacing}
              r="1.8"
              fill="#00875A"
              fillOpacity="0.75"
            />
          </pattern>

          {/* Radial spotlight centered on cursor to illuminate grid lines on hover */}
          <radialGradient
            id="hero-cursor-spotlight"
            cx={mousePos.x}
            cy={mousePos.y}
            r="280"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-spotlight-mask">
            <rect width="100%" height="100%" fill="url(#hero-cursor-spotlight)" />
          </mask>

          {/* Edge vignette mask */}
          <radialGradient id="hero-vignette-mask" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
          </radialGradient>
          <mask id="hero-grid-mask">
            <rect width="100%" height="100%" fill="url(#hero-vignette-mask)" />
          </mask>

          {/* Green glow filter for hover and animated beams */}
          <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Base Ambient Green Grid */}
        <rect
          width="100%"
          height="100%"
          fill="url(#hero-ambient-grid)"
          mask="url(#hero-grid-mask)"
        />

        {/* 2. Interactive Hover Grid Layer (illuminates grid lines around cursor on hover) */}
        {isHovered && mousePos.x >= 0 && (
          <rect
            width="100%"
            height="100%"
            fill="url(#hero-hover-grid)"
            mask="url(#hero-spotlight-mask)"
            className="transition-opacity duration-300"
          />
        )}

        {/* 3. Primary Animated Continuous Horizontal Straight Lines */}
        <g className={`transition-opacity duration-500 ${isHovered ? "opacity-90" : "opacity-60"}`}>
          {/* Line 1 (18%) */}
          <line
            x1="0%"
            y1="18%"
            x2="100%"
            y2="18%"
            stroke="#00875A"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
          <line
            x1="0%"
            y1="18%"
            x2="100%"
            y2="18%"
            stroke="#00875A"
            strokeWidth="1.8"
            strokeOpacity="0.8"
            className="anim-beam-h1"
            filter="url(#emerald-glow)"
          />

          {/* Line 2 (38%) */}
          <line
            x1="0%"
            y1="38%"
            x2="100%"
            y2="38%"
            stroke="#00875A"
            strokeWidth="0.8"
            strokeOpacity="0.18"
          />
          <line
            x1="0%"
            y1="38%"
            x2="100%"
            y2="38%"
            stroke="#00875A"
            strokeWidth="1.5"
            strokeOpacity="0.75"
            className="anim-beam-h2"
            filter="url(#emerald-glow)"
          />

          {/* Line 3 (64%) */}
          <line
            x1="0%"
            y1="64%"
            x2="100%"
            y2="64%"
            stroke="#00875A"
            strokeWidth="0.8"
            strokeOpacity="0.18"
          />
          <line
            x1="0%"
            y1="64%"
            x2="100%"
            y2="64%"
            stroke="#00875A"
            strokeWidth="1.6"
            strokeOpacity="0.75"
            className="anim-beam-h3"
            filter="url(#emerald-glow)"
          />

          {/* Line 4 (85%) */}
          <line
            x1="0%"
            y1="85%"
            x2="100%"
            y2="85%"
            stroke="#00875A"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
          <line
            x1="0%"
            y1="85%"
            x2="100%"
            y2="85%"
            stroke="#00875A"
            strokeWidth="1.8"
            strokeOpacity="0.8"
            className="anim-beam-h1"
            style={{ animationDirection: "reverse", animationDuration: "11s" }}
            filter="url(#emerald-glow)"
          />
        </g>

        {/* 4. Primary Animated Continuous Vertical Straight Lines */}
        <g className={`transition-opacity duration-500 ${isHovered ? "opacity-90" : "opacity-60"}`}>
          {/* Vertical Line 1 (12%) */}
          <line
            x1="12%"
            y1="0%"
            x2="12%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
          <line
            x1="12%"
            y1="0%"
            x2="12%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="1.8"
            strokeOpacity="0.8"
            className="anim-beam-v1"
            filter="url(#emerald-glow)"
          />

          {/* Vertical Line 2 (28%) */}
          <line
            x1="28%"
            y1="0%"
            x2="28%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="0.8"
            strokeOpacity="0.16"
          />
          <line
            x1="28%"
            y1="0%"
            x2="28%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="1.5"
            strokeOpacity="0.7"
            className="anim-beam-v2"
            filter="url(#emerald-glow)"
          />

          {/* Vertical Line 3 (72%) */}
          <line
            x1="72%"
            y1="0%"
            x2="72%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="0.8"
            strokeOpacity="0.16"
          />
          <line
            x1="72%"
            y1="0%"
            x2="72%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="1.5"
            strokeOpacity="0.7"
            className="anim-beam-v3"
            filter="url(#emerald-glow)"
          />

          {/* Vertical Line 4 (88%) */}
          <line
            x1="88%"
            y1="0%"
            x2="88%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
          <line
            x1="88%"
            y1="0%"
            x2="88%"
            y2="100%"
            stroke="#00875A"
            strokeWidth="1.8"
            strokeOpacity="0.8"
            className="anim-beam-v1"
            style={{ animationDirection: "reverse", animationDuration: "9s" }}
            filter="url(#emerald-glow)"
          />
        </g>

        {/* 5. HOVER EFFECT: Active Green Horizontal and Vertical Lines Illuminating on Hover */}
        {/* NO mouse circle reticle, NO coordinates — just responsive glowing green lines */}
        {isHovered && mousePos.x >= 0 && (
          <g className="transition-opacity duration-200">
            {/* Active horizontal line spanning the full width through cursor */}
            <line
              x1="0"
              y1={snappedY}
              x2="100%"
              y2={snappedY}
              stroke="#00875A"
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />
            {/* Bright glowing laser core on the active horizontal line */}
            <line
              x1={Math.max(0, mousePos.x - 220)}
              y1={snappedY}
              x2={Math.min(width, mousePos.x + 220)}
              y2={snappedY}
              stroke="#00875A"
              strokeWidth="2.5"
              strokeOpacity="0.9"
              filter="url(#emerald-glow)"
            />

            {/* Active vertical line spanning the full height through cursor */}
            <line
              x1={snappedX}
              y1="0"
              x2={snappedX}
              y2="100%"
              stroke="#00875A"
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />
            {/* Bright glowing laser core on the active vertical line */}
            <line
              x1={snappedX}
              y1={Math.max(0, mousePos.y - 220)}
              x2={snappedX}
              y2={Math.min(height, mousePos.y + 220)}
              stroke="#00875A"
              strokeWidth="2.5"
              strokeOpacity="0.9"
              filter="url(#emerald-glow)"
            />
          </g>
        )}

        {/* 6. Pulsing Intersection Nodes */}
        {[
          { cx: "12%", cy: "18%", delay: "0s" },
          { cx: "12%", cy: "64%", delay: "1.2s" },
          { cx: "12%", cy: "85%", delay: "2.4s" },
          { cx: "28%", cy: "18%", delay: "0.8s" },
          { cx: "28%", cy: "85%", delay: "1.8s" },
          { cx: "72%", cy: "18%", delay: "0.5s" },
          { cx: "72%", cy: "85%", delay: "2.1s" },
          { cx: "88%", cy: "18%", delay: "1.5s" },
          { cx: "88%", cy: "64%", delay: "0.3s" },
          { cx: "88%", cy: "85%", delay: "2.7s" },
        ].map((node, i) => (
          <g key={`node-${i}`} className="transition-opacity duration-500 opacity-70 hover:opacity-100">
            <circle
              cx={node.cx}
              cy={node.cy}
              r="5"
              fill="#00875A"
              fillOpacity="0.18"
              className="anim-node"
              style={{ animationDelay: node.delay }}
            />
            <circle
              cx={node.cx}
              cy={node.cy}
              r="2"
              fill="#00875A"
              fillOpacity="0.8"
              filter="url(#emerald-glow)"
            />
          </g>
        ))}

        {/* 7. Corner Precision Plus (+) Marks */}
        {[
          { x: "6%", y: "48px" },
          { x: "94%", y: "48px" },
          { x: "6%", y: "calc(100% - 48px)" },
          { x: "94%", y: "calc(100% - 48px)" },
        ].map((mark, idx) => (
          <g
            key={`mark-${idx}`}
            className="transition-all duration-500 opacity-40 hover:opacity-85"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <line
              x1="-6"
              y1="0"
              x2="6"
              y2="0"
              stroke="#00875A"
              strokeWidth="1.2"
              style={{ transform: `translate(${mark.x}, ${mark.y})` }}
            />
            <line
              x1="0"
              y1="-6"
              x2="0"
              y2="6"
              stroke="#00875A"
              strokeWidth="1.2"
              style={{ transform: `translate(${mark.x}, ${mark.y})` }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
