import * as React from "react";
import { motion } from "framer-motion";

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

const SplitText = ({
  text,
  className = "",
  style = {},
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
  const units = React.useMemo(() => {
    if (!text) return [];
    if (splitType.includes("words")) {
      return text.split(/(\s+)/);
    }
    return Array.from(text);
  }, [text, splitType]);

  const Tag = tag as keyof JSX.IntrinsicElements;

  return (
    <Tag className={`split-parent ${className}`} style={{ textAlign, ...style }}>
      <motion.span
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: threshold }}
        transition={{ staggerChildren: delay / 1000 }}
        onAnimationComplete={onLetterAnimationComplete}
        className="inline"
      >
        {units.map((unit, index) => {
          const isSpace = /^\s+$/.test(unit);
          if (isSpace) {
            return <span key={`space-${index}`}>{unit}</span>;
          }
          return (
            <motion.span
              key={`${unit}-${index}`}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration, ease: "easeOut" }}
              className="inline-block will-change-transform"
            >
              {unit}
            </motion.span>
          );
        })}
      </motion.span>
    </Tag>
  );
};

export default SplitText;
