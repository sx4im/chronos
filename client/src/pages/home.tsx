import * as React from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLoader } from "@/components/ui/app-loader";
import SplitText from "@/components/SplitText";
import { type IngredientChip } from "@shared/schema";
import { Heart, Plus, Star, Bookmark, ArrowRight, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FadeUp, FadeDown, ModernFadeUp, ModernFadeDown } from "@/components/ScrollReveal";
import { MagneticButton } from "@/components/effects/MagneticButton";
import { TiltCard } from "@/components/effects/TiltCard";

const HERO_LOADER_MIN_MS = 900;
let heroImageReady = false;

export default function Home() {
  const heroRef = React.useRef<HTMLElement>(null);
  const [isHeroReady, setIsHeroReady] = React.useState(() => typeof window === "undefined" || heroImageReady);
  const [ingredients, setIngredients] = React.useState<IngredientChip[]>([
    { id: "1", name: "Tomato" },
    { id: "2", name: "Basil" },
    { id: "3", name: "Mozzarella" }
  ]);
  const [hoveredRecipe, setHoveredRecipe] = React.useState<number | null>(null);
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const pizzaPathX = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [0, 34, 0, -34, 0]);
  const pizzaPathY = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [0, -34, 0, 34, 0]);
  const pizzaSpin = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const pizzaX = useSpring(pizzaPathX, { stiffness: 160, damping: 30, mass: 0.4 });
  const pizzaY = useSpring(pizzaPathY, { stiffness: 160, damping: 30, mass: 0.4 });
  const pizzaRotate = useSpring(pizzaSpin, { stiffness: 160, damping: 30, mass: 0.4 });
  const pizzaMotionStyle = shouldReduceMotion ? undefined : { x: pizzaX, y: pizzaY, rotate: pizzaRotate };
  const heroItemVariants = {
    hidden: shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: -24, y: 12 },
    visible: { opacity: 1, x: 0, y: 0 },
  };

  React.useEffect(() => {
    if (heroImageReady) {
      return;
    }

    let cancelled = false;
    let imageLoaded = false;
    let minTimeElapsed = false;
    const image = new Image();
    const finish = () => {
      if (!cancelled && imageLoaded && minTimeElapsed) {
        heroImageReady = true;
        setIsHeroReady(true);
      }
    };
    const handleImageDone = () => {
      imageLoaded = true;
      finish();
    };
    const minLoaderTimeout = window.setTimeout(() => {
      minTimeElapsed = true;
      finish();
    }, HERO_LOADER_MIN_MS);

    image.onload = handleImageDone;
    image.onerror = handleImageDone;
    image.src = "/pizza.png";

    if (image.complete) {
      handleImageDone();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(minLoaderTimeout);
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  const handleIngredientsChange = (newIngredients: IngredientChip[]) => {
    setIngredients(newIngredients);
  };

  const handleRecipeHover = (recipeId: number) => {
    setHoveredRecipe(recipeId);
  };

  const handleRecipeLeave = () => {
    setHoveredRecipe(null);
  };


  const sampleRecipes = [
    {
      id: 1,
      title: "Fresh Caprese Salad",
      description: "A classic Italian salad with fresh tomatoes, mozzarella, and basil.",
      image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?q=80&w=2070&auto=format&fit=crop",
      time: "15 min",
      rating: 4.8,
      reviews: 124,
      tags: ["Quick", "Fresh"]
    },
    {
      id: 2,
      title: "Garden Vegetable Stir Fry",
      description: "Quick and nutritious stir fry with seasonal vegetables and aromatic spices.",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop",
      time: "25 min",
      rating: 4.6,
      reviews: 89,
      tags: ["Healthy", "Vegetarian"]
    },
    {
      id: 3,
      title: "Classic Pasta Marinara",
      description: "Authentic Italian pasta with homemade marinara sauce and fresh herbs.",
      image: "https://images.unsplash.com/photo-1473093226795-af9932fe5856?q=80&w=2070&auto=format&fit=crop",
      time: "45 min",
      rating: 4.9,
      reviews: 203,
      tags: ["Comfort", "Italian"]
    }
  ];

  if (!isHeroReady) {
    return <AppLoader className="min-h-screen" label="Loading home" />;
  }

  return (
    <div className="relative min-h-screen font-sans">
      {/* ─── Hero Section — Deep Olive Atmosphere ─── */}
      <section ref={heroRef} className="relative w-full min-h-[72vh] flex items-center z-10 pt-16 pb-12" style={{ background: 'var(--bg-deep-olive)' }}>
        {/* Ambient radial glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[500px] lg:h-[500px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--accent-gold) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        </div>
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">

            {/* Left Content — Typography Focus */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <motion.div
                initial="hidden"
                animate="visible"
                transition={{ staggerChildren: shouldReduceMotion ? 0 : 0.12, delayChildren: shouldReduceMotion ? 0 : 0.1 }}
              >
                <motion.div variants={heroItemVariants} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="inline-block px-3 py-1 mb-6 border border-[var(--accent-gold)]/40 rounded-full text-sm font-medium tracking-widest uppercase" style={{ color: 'var(--accent-gold)' }}>
                    Culinary Discovery
                  </div>
                </motion.div>
                <SplitText
                  text="Cook With Purpose"
                  tag="h1"
                  className="font-serif text-6xl md:text-8xl font-medium tracking-tighter leading-[0.9] mb-8"
                  textAlign="left"
                  delay={50}
                  duration={1.2}
                  ease="power4.out"
                  splitType="words"
                  from={{ opacity: 0, y: 40 }}
                  to={{ opacity: 1, y: 0 }}
                  threshold={0.1}
                  rootMargin="-50px"
                  style={{ color: 'var(--text-on-dark)' }}
                />

                <motion.div variants={heroItemVariants} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                  <p className="text-xl md:text-2xl font-serif leading-relaxed mb-10 max-w-md" style={{ color: 'var(--text-on-dark-muted)' }}>
                    Transform the ingredients you already have into extraordinary, elegant meals without leaving your home.
                  </p>
                </motion.div>

                <motion.div
                  variants={heroItemVariants}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col sm:flex-row gap-6"
                >
                  <MagneticButton strength={20}>
                    <Link
                      href="/search"
                      className="inline-flex items-center justify-center px-10 py-4 text-sm font-bold tracking-widest uppercase btn-fill-up btn-fill-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm" style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep-olive)' }}
                    >
                      Begin Journey
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </MagneticButton>
                  <MagneticButton strength={15}>
                    <button
                      onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })}
                      className="group inline-flex items-center justify-center px-8 py-4 text-sm font-bold tracking-widest uppercase border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm" style={{ color: 'var(--text-on-dark)', borderColor: 'var(--text-on-dark-muted)' }}
                    >
                      Discover More
                    </button>
                  </MagneticButton>
                </motion.div>
              </motion.div>
            </div>

            {/* Right Content — Constrained Hero Image */}
            <div className="lg:col-span-5 order-1 lg:order-2 relative aspect-[4/5] lg:aspect-[3/4]">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="w-full h-full relative"
              >
                <motion.img
                  src="/pizza.png"
                  alt="Pizza sticker"
                  className="w-full h-full object-contain relative z-10 transform-gpu"
                  style={pizzaMotionStyle}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section — Warm Brown Atmosphere ─── */}
      <section id="why-ingredo" className="py-52 relative z-10" style={{ background: 'var(--bg-warm-brown)' }}>
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']}>
                <h2 className="font-serif text-5xl lg:text-7xl font-medium tracking-tight mb-8" style={{ color: 'var(--text-on-dark)' }}>
                  The Art of Resourcefulness.
                </h2>
                <p className="font-serif text-2xl mb-12" style={{ color: 'var(--text-on-dark-muted)' }}>
                  A curated experience designed for the modern home chef who values flavor, zero waste, and elegance.
                </p>
              </FadeUp>
            </div>

            <div className="flex flex-col gap-12">
              <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={200}>
                <div className="flex items-start gap-6 relative before:absolute before:left-0 before:-bottom-6 before:w-full before:h-px" style={{ '--tw-before-bg': 'rgba(245,240,232,0.15)' } as React.CSSProperties}>
                  <div className="mt-1">
                    <span className="font-serif text-3xl italic" style={{ color: 'var(--accent-gold)' }}>01</span>
                  </div>
                  <div>
                    <h3 className="text-xl tracking-tight uppercase font-bold mb-3" style={{ color: 'var(--text-on-dark)' }}>Intelligent Pairing</h3>
                    <p className="leading-relaxed" style={{ color: 'var(--text-on-dark-muted)' }}>Our culinary algorithm discovers sophisticated flavor profiles using exactly what rests in your pantry.</p>
                  </div>
                </div>
              </FadeUp>

              <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={400}>
                <div className="flex items-start gap-6 relative before:absolute before:left-0 before:-bottom-6 before:w-full before:h-px">
                  <div className="mt-1">
                    <span className="font-serif text-3xl italic" style={{ color: 'var(--accent-gold)' }}>02</span>
                  </div>
                  <div>
                    <h3 className="text-xl tracking-tight uppercase font-bold mb-3" style={{ color: 'var(--text-on-dark)' }}>Mindful Consumption</h3>
                    <p className="leading-relaxed" style={{ color: 'var(--text-on-dark-muted)' }}>Embrace sustainable cooking habits by reviving forgotten ingredients before they perish.</p>
                  </div>
                </div>
              </FadeUp>

              <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={600}>
                <div className="flex items-start gap-6">
                  <div className="mt-1">
                    <span className="font-serif text-3xl italic" style={{ color: 'var(--accent-gold)' }}>03</span>
                  </div>
                  <div>
                    <h3 className="text-xl tracking-tight uppercase font-bold mb-3" style={{ color: 'var(--text-on-dark)' }}>Curated Collection</h3>
                    <p className="leading-relaxed" style={{ color: 'var(--text-on-dark-muted)' }}>Archive your masterpieces into a personal folio of enduring recipes.</p>
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Recipes Showcase — Cream Contrast ─── */}
      <section id="popular-recipes" className="py-24 relative z-10 bg-background">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
          <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']}>
            <div className="flex justify-between items-end mb-16 border-b border-border/60 pb-8">
              <div className="flex-1 text-left">
                <h2 className="font-serif text-5xl font-medium tracking-tight text-foreground mb-4">
                  Featured Fare
                </h2>
                <div className="w-12 h-0.5 mb-6" style={{ background: 'var(--accent-gold)' }} />
                <p className="text-xl font-serif italic max-w-2xl" style={{ color: 'var(--muted-foreground)' }}>
                  Discover our most celebrated and thoughtfully composed culinary creations.
                </p>
              </div>
              <Link href="/search" className="hidden md:flex items-center gap-2 text-sm uppercase tracking-widest font-bold hover:text-primary transition-colors">
                View All <ArrowRight className="size-4" />
              </Link>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-10">
            {sampleRecipes.map((recipe, index) => (
              <FadeUp
                key={recipe.id}
                allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']}
                delay={200 + (index * 200)}
              >
                <TiltCard intensity={15} className="h-full">
                  <div className="group cursor-pointer">
                    <div className="relative overflow-hidden aspect-[16/10] mb-6 rounded-lg">
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover transition-transform duration-700 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <span>{recipe.time}</span>
                        <span className="size-1 rounded-full bg-border"></span>
                        <span>{recipe.tags[0]}</span>
                      </div>
                      <h4 className="font-serif text-2xl font-medium text-foreground group-hover:text-primary transition-colors">
                        {recipe.title}
                      </h4>
                    </div>
                  </div>
                </TiltCard>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works — Deep Olive Surface ─── */}
      <section id="how-it-works" className="py-24 relative z-10 bg-[var(--bg-deep-olive)]">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 relative z-10">
          <div className="w-full mx-auto text-left">
            <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']}>
              <div className="text-left mb-8 sm:mb-12 lg:mb-16">
                <h2 className="font-serif text-5xl font-medium tracking-tight mb-4 text-[var(--text-on-dark)]">
                  How It Works
                </h2>
                <div className="w-12 h-0.5 mb-6 bg-[var(--accent-gold)]" />
                <p className="text-xl font-serif italic max-w-2xl text-[var(--text-on-dark-muted)]">
                  Get started with Ingredo in just three simple steps
                </p>
              </div>
            </FadeUp>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Step 1 */}
            <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={400}>
              <div className="group p-10 border transition-all duration-300 hover:shadow-xl hover:shadow-gold/5 flex flex-col items-center text-center" style={{ background: 'var(--bg-olive-surface)', borderColor: 'rgba(245,240,232,0.1)' }}>
                <div className="size-16 rounded-full flex items-center justify-center text-2xl font-serif font-bold mb-8 transition-transform group-hover:scale-110" style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep-olive)' }}>
                  1
                </div>
                <h3 className="font-serif text-2xl font-medium mb-4" style={{ color: 'var(--text-on-dark)' }}>
                  Add Your Ingredients
                </h3>
                <p className="text-base leading-relaxed max-w-[280px]" style={{ color: 'var(--text-on-dark-muted)' }}>
                  Simply type or select the ingredients you have in your kitchen. Our smart system will recognize them instantly.
                </p>
              </div>
            </FadeUp>

            {/* Step 2 */}
            <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={600}>
              <div className="group p-10 border transition-all duration-300 hover:shadow-xl hover:shadow-gold/5 flex flex-col items-center text-center" style={{ background: 'var(--bg-olive-surface)', borderColor: 'rgba(245,240,232,0.1)' }}>
                <div className="size-16 rounded-full flex items-center justify-center text-2xl font-serif font-bold mb-8 transition-transform group-hover:scale-110" style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep-olive)' }}>
                  2
                </div>
                <h3 className="font-serif text-2xl font-medium mb-4" style={{ color: 'var(--text-on-dark)' }}>
                  Discover Recipes
                </h3>
                <p className="text-base leading-relaxed max-w-[280px]" style={{ color: 'var(--text-on-dark-muted)' }}>
                  Browse through perfectly matched recipes or explore suggestions based on your available ingredients.
                </p>
              </div>
            </FadeUp>

            {/* Step 3 */}
            <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={800}>
              <div className="group p-10 border transition-all duration-300 hover:shadow-xl hover:shadow-gold/5 flex flex-col items-center text-center" style={{ background: 'var(--bg-olive-surface)', borderColor: 'rgba(245,240,232,0.1)' }}>
                <div className="size-16 rounded-full flex items-center justify-center text-2xl font-serif font-bold mb-8 transition-transform group-hover:scale-110" style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep-olive)' }}>
                  3
                </div>
                <h3 className="font-serif text-2xl font-medium mb-4" style={{ color: 'var(--text-on-dark)' }}>
                  Start Cooking
                </h3>
                <p className="text-base leading-relaxed max-w-[280px]" style={{ color: 'var(--text-on-dark-muted)' }}>
                  Follow step-by-step instructions and create delicious meals while reducing food waste in your kitchen.
                </p>
              </div>
            </FadeUp>
          </div>

            {/* CTA Button */}
            <FadeUp allowedSections={['why-ingredo', 'popular-recipes', 'how-it-works']} delay={1000}>
              <div className="text-center mt-10 lg:mt-14">
                <MagneticButton strength={15}>
                  <Link
                    href="/search"
                    className="inline-flex items-center justify-center px-10 py-4 text-sm font-bold tracking-widest uppercase btn-fill-up btn-fill-gold" style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep-olive)' }}
                  >
                    Get Started Now
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </MagneticButton>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

    </div>
  );
}
