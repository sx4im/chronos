import { useEffect, useRef, useState } from 'react';

export interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  delay?: number;
  duration?: number;
  distance?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale' | 'rotate';
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  allowedSections?: string[]; // Array of section IDs or class names where animations are allowed
}

export function useScrollReveal(options: UseScrollRevealOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -30px 0px',
    triggerOnce = true,
    delay = 0,
    duration = 1200,
    distance = '30px',
    direction = 'up',
    easing = 'ease-out',
    allowedSections = []
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Helper function to check if element is within allowed sections
  const isElementInAllowedSection = (element: HTMLElement): boolean => {
    if (allowedSections.length === 0) return true; // If no restrictions, allow all
    
    // Check if element or any of its parents has the allowed section class/id
    let currentElement: HTMLElement | null = element;
    while (currentElement) {
      // Check for ID match
      if (currentElement.id && allowedSections.includes(currentElement.id)) {
        return true;
      }
      // Check for class match
      if (currentElement.className && 
          allowedSections.some(section => currentElement?.classList.contains(section))) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }
    return false;
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (triggerOnce && hasTriggered) return;
          
          // Check if element is in allowed section before triggering animation
          if (!isElementInAllowedSection(element)) return;
          
          setTimeout(() => {
            setIsVisible(true);
            setHasTriggered(true);
          }, delay);
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, delay, hasTriggered, allowedSections]);

  const getTransform = () => {
    if (!isVisible) {
      switch (direction) {
        case 'up':
          return `translateY(${distance})`;
        case 'down':
          return `translateY(-${distance})`;
        case 'left':
          return `translateX(${distance})`;
        case 'right':
          return `translateX(-${distance})`;
        case 'scale':
          return 'scale(0.8)';
        case 'rotate':
          return 'rotate(-5deg)';
        default:
          return 'translateY(0px)';
      }
    }
    return 'translateY(0px) translateX(0px) scale(1) rotate(0deg)';
  };

  const getOpacity = () => {
    return isVisible ? 1 : 0;
  };

  const style = {
    opacity: getOpacity(),
    transform: getTransform(),
    transition: `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`,
  };

  return {
    ref: elementRef,
    isVisible,
    style
  };
}

// Predefined animation presets
export const scrollRevealPresets = {
  fadeUp: {
    direction: 'up' as const,
    distance: '30px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  fadeDown: {
    direction: 'down' as const,
    distance: '30px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  fadeLeft: {
    direction: 'left' as const,
    distance: '30px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  fadeRight: {
    direction: 'right' as const,
    distance: '30px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  scale: {
    direction: 'scale' as const,
    distance: '0px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  rotate: {
    direction: 'rotate' as const,
    distance: '0px',
    duration: 600,
    easing: 'ease-out' as const,
    delay: 0
  },
  slowFadeUp: {
    direction: 'up' as const,
    distance: '35px',
    duration: 950,
    easing: 'ease-out' as const,
    delay: 150
  },
  slowFadeDown: {
    direction: 'down' as const,
    distance: '25px',
    duration: 1000,
    easing: 'ease-out' as const,
    delay: 100
  },
  staggered: {
    direction: 'up' as const,
    distance: '25px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 50
  },
  // New modern presets
  modernFadeUp: {
    direction: 'up' as const,
    distance: '30px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  modernFadeDown: {
    direction: 'down' as const,
    distance: '30px',
    duration: 700,
    easing: 'ease-out' as const,
    delay: 0
  },
  modernFadeLeft: {
    direction: 'left' as const,
    distance: '15px',
    duration: 500,
    easing: 'ease-out' as const,
    delay: 0
  },
  modernFadeRight: {
    direction: 'right' as const,
    distance: '15px',
    duration: 500,
    easing: 'ease-out' as const,
    delay: 0
  },
  quickFadeUp: {
    direction: 'up' as const,
    distance: '10px',
    duration: 400,
    easing: 'ease-out' as const,
    delay: 0
  },
  quickFadeDown: {
    direction: 'down' as const,
    distance: '10px',
    duration: 400,
    easing: 'ease-out' as const,
    delay: 0
  }
};
