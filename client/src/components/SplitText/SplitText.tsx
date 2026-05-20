import * as React from "react";
import { m, useReducedMotion } from "framer-motion";

interface SplitTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: "chars" | "words" | "lines" | "chars,words" | "chars,lines" | "words,lines" | "chars,words,lines";
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
  threshold?: number;
  rootMargin?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  tag?: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  onLetterAnimationComplete?: () => void;
}

interface SplitUnit {
  value: string;
  start: number;
}

const EMPTY_PROPS = {} as const;

const SplitText = ({
  text,
  className = "",
  style = EMPTY_PROPS,
  delay = 100,
  duration = 0.6,
  ease,
  splitType = "chars",
  from,
  to,
  threshold = 0.1,
  rootMargin,
  textAlign = "center",
  tag = "p",
  onLetterAnimationComplete,
}: SplitTextProps) => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();
  const units = React.useMemo<SplitUnit[]>(() => {
    if (!text) return [];
    if (splitType.includes("words")) {
      let offset = 0;
      return text.split(/(\s+)/).map((value) => {
        const start = offset;
        offset += value.length;
        return { value, start };
      });
    }
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(text), ({ segment, index }) => ({
        value: segment,
        start: index,
      }));
    }
    let offset = 0;
    return Array.from(text).map((value) => {
      const start = offset;
      offset += value.length;
      return { value, start };
    });
  }, [text, splitType]);

  const Tag = tag as keyof JSX.IntrinsicElements;

  if (shouldReduceMotion) {
    return (
      <Tag className={`split-parent ${className}`} style={{ textAlign, ...style }}>
        <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="inline">
          {text}
        </m.span>
      </Tag>
    );
  }

  return (
    <Tag className={`split-parent ${className}`} style={{ textAlign, ...style }}>
      <m.span
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: threshold }}
        transition={{ staggerChildren: delay / 1000 }}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={() => {
          setIsAnimating(false);
          onLetterAnimationComplete?.();
        }}
        onViewportLeave={() => setIsAnimating(false)}
        className="inline"
      >
        {units.map((unit) => {
          const isSpace = /^\s+$/.test(unit.value);
          if (isSpace) {
            return <span key={`space-${unit.start}-${unit.value.length}`}>{unit.value}</span>;
          }
          return (
            <m.span
              key={`unit-${unit.start}-${unit.value}`}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration, ease: "easeOut" }}
              style={{ willChange: isAnimating ? "transform" : "auto" }}
              className="inline-block"
            >
              {unit.value}
            </m.span>
          );
        })}
      </m.span>
    </Tag>
  );
};

export default SplitText;
