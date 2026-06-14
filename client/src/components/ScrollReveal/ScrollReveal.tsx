import React from 'react';
import { useScrollReveal, scrollRevealPresets, type UseScrollRevealOptions } from '@/hooks/use-scroll-reveal';
import { m, useReducedMotion } from 'framer-motion';

interface ScrollRevealProps extends UseScrollRevealOptions {
  children: React.ReactNode;
  className?: string;
  preset?: keyof typeof scrollRevealPresets;
  as?: React.ElementType;
}

export function ScrollReveal({ 
  children, 
  className = '', 
  preset,
  as: Component = 'div',
  ...options 
}: ScrollRevealProps) {
  const scrollOptions = preset ? { ...scrollRevealPresets[preset], ...options } : options;
  const shouldReduceMotion = useReducedMotion();
  const [isAllowed, setIsAllowed] = React.useState(true);
  const ref = React.useRef<HTMLElement>(null);
  const {
    direction = 'up',
    distance = '30px',
    duration = 1200,
    delay = 0,
    threshold = 0.1,
    allowedSections = [],
  } = scrollOptions;

  React.useEffect(() => {
    const element = ref.current;
    if (!element || allowedSections.length === 0) {
      setIsAllowed(true);
      return;
    }

    let currentElement: HTMLElement | null = element;
    while (currentElement) {
      if (
        (currentElement.id && allowedSections.includes(currentElement.id)) ||
        allowedSections.some((section) => currentElement?.classList.contains(section))
      ) {
        setIsAllowed(true);
        return;
      }
      currentElement = currentElement.parentElement;
    }
    setIsAllowed(false);
  }, [allowedSections]);

  const reduce = shouldReduceMotion || !isAllowed;
  const offset = reduce ? '0px' : distance;
  const initial = {
    opacity: reduce ? 1 : 0,
    x: direction === 'left' ? offset : direction === 'right' ? `-${offset}` : 0,
    y: direction === 'up' ? offset : direction === 'down' ? `-${offset}` : 0,
    scale: direction === 'scale' && !reduce ? 0.94 : 1,
    rotate: direction === 'rotate' && !reduce ? -4 : 0,
  };
  const visible = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };

  // Render a real framer-motion element so the props actually animate.
  const motionTags = m as unknown as Record<string, React.ElementType>;
  const Motion: React.ElementType =
    typeof Component === 'string' ? (motionTags[Component] ?? m.div) : Component;

  return (
    <Motion
      ref={ref}
      initial={initial}
      whileInView={reduce ? initial : visible}
      viewport={{ once: true, amount: threshold, margin: '0px 0px -8% 0px' }}
      transition={{ duration: duration / 1000, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Motion>
  );
}

// Convenience components for common animations
export const FadeUp = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="fadeUp" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const FadeDown = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="fadeDown" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const FadeLeft = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="fadeLeft" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const FadeRight = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="fadeRight" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const Scale = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="scale" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const Rotate = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="rotate" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const SlowFadeUp = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="slowFadeUp" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const SlowFadeDown = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="slowFadeDown" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const Staggered = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="staggered" className={className} {...props}>
    {children}
  </ScrollReveal>
);

// Modern animation components
export const ModernFadeUp = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="modernFadeUp" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const ModernFadeDown = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="modernFadeDown" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const ModernFadeLeft = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="modernFadeLeft" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const ModernFadeRight = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="modernFadeRight" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const QuickFadeUp = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="quickFadeUp" className={className} {...props}>
    {children}
  </ScrollReveal>
);

export const QuickFadeDown = ({ children, className, ...props }: ScrollRevealProps) => (
  <ScrollReveal preset="quickFadeDown" className={className} {...props}>
    {children}
  </ScrollReveal>
);
