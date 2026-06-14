import * as React from "react";
import { Link } from "wouter";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import { FadeUp } from "@/components/ScrollReveal";
import { MagneticButton } from "@/components/effects/MagneticButton";
import { ArrowRight, Check, Clock, Sparkles, Leaf, Bookmark } from "lucide-react";

const HERO_LOADER_MIN_MS = 900;
let heroImageReady = false;

/* ─── Saturated feature card (Clay's primary visual element) ─── */
type Tone = "pink" | "teal" | "lavender" | "peach" | "ochre" | "cream";

const toneSurface: Record<Tone, string> = {
  pink: "bg-brand-pink text-on-primary",
  teal: "bg-brand-teal text-on-primary",
  lavender: "bg-brand-lavender text-ink",
  peach: "bg-brand-peach text-ink",
  ochre: "bg-brand-ochre text-ink",
  cream: "bg-surface-card text-ink",
};

function FeatureCard({
  tone,
  eyebrow,
  title,
  body,
  children,
}: {
  tone: Tone;
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const dark = tone === "pink" || tone === "teal";
  return (
    <div className={cn("feature-card flex h-full flex-col gap-6 min-h-[360px]", toneSurface[tone])}>
      <div>
        <span className={cn("caption-label", dark ? "text-white/75" : "text-ink/60")}>{eyebrow}</span>
        <h3 className="title-lg mt-4">{title}</h3>
        <p className={cn("mt-3 text-[15px] leading-relaxed", dark ? "text-white/85" : "text-ink/75")}>{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

/* Small product-UI fragment surfaces embedded in cards */
function FragmentPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl bg-canvas p-4 text-ink shadow-[0_10px_30px_-12px_rgba(10,10,10,0.35)]", className)}>
      {children}
    </div>
  );
}

export default function Home() {
  const heroRef = React.useRef<HTMLElement>(null);
  const [isHeroReady, setIsHeroReady] = React.useState(
    () => typeof window === "undefined" || heroImageReady
  );
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const floatX = useTransform(scrollYProgress, [0, 0.5, 1], [0, 18, 0]);
  const floatY = useTransform(scrollYProgress, [0, 0.5, 1], [0, -22, 0]);
  const spin = useTransform(scrollYProgress, [0, 1], [0, 24]);
  const pizzaX = useSpring(floatX, { stiffness: 160, damping: 30, mass: 0.4 });
  const pizzaY = useSpring(floatY, { stiffness: 160, damping: 30, mass: 0.4 });
  const pizzaRotate = useSpring(spin, { stiffness: 160, damping: 30, mass: 0.4 });
  const pizzaMotionStyle = shouldReduceMotion ? undefined : { x: pizzaX, y: pizzaY, rotate: pizzaRotate };

  React.useEffect(() => {
    if (heroImageReady) return;
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
    if (image.complete) handleImageDone();
    return () => {
      cancelled = true;
      window.clearTimeout(minLoaderTimeout);
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  const sampleRecipes = [
    {
      id: 1,
      title: "Fresh Caprese Salad",
      image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?q=80&w=2070&auto=format&fit=crop",
      time: "15 min",
      tag: "Quick",
    },
    {
      id: 2,
      title: "Garden Vegetable Stir Fry",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop",
      time: "25 min",
      tag: "Healthy",
    },
    {
      id: 3,
      title: "Classic Pasta Marinara",
      image: "https://images.unsplash.com/photo-1473093226795-af9932fe5856?q=80&w=2070&auto=format&fit=crop",
      time: "45 min",
      tag: "Comfort",
    },
  ];

  const steps = [
    { n: "01", title: "Add your ingredients", body: "Type, paste, or snap a photo of what's in your kitchen. We recognize them instantly." },
    { n: "02", title: "Discover recipes", body: "Get recipes ranked by how well they match the ingredients you already have on hand." },
    { n: "03", title: "Start cooking", body: "Follow clear, step-by-step instructions and turn what you have into a great meal." },
  ];

  if (!isHeroReady) {
    return <AppLoader className="min-h-screen" label="Loading home" />;
  }

  return (
    <div className="relative bg-canvas font-sans">
      {/* ─── Hero band — cream canvas, 7/5 split ─── */}
      <section ref={heroRef} className="relative">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 pt-16 pb-12 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left — copy */}
            <motion.div
              className="lg:col-span-7 order-2 lg:order-1"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-card px-3 py-1 text-[13px] font-medium text-ink">
                <Sparkles className="size-3.5 text-brand-pink" />
                Cook with what you already have
              </span>

              <h1 className="display-xl mt-6">
                Turn your fridge<br className="hidden sm:block" /> into a{" "}
                <span className="text-brand-pink">feast</span>.
              </h1>

              <p className="body-lead mt-6 max-w-xl">
                Ingredo finds the recipes that match the ingredients in your kitchen, so you
                waste less, cook more, and never stare at a full fridge wondering what's for dinner.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <MagneticButton strength={18} className="w-full sm:w-auto">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/search" data-testid="hero-start">
                      Find recipes
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </MagneticButton>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href="#how-it-works">How it works</a>
                </Button>
              </div>

              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {["bg-brand-peach", "bg-brand-lavender", "bg-brand-mint", "bg-brand-ochre"].map((c) => (
                    <span key={c} className={cn("size-8 rounded-full border-2 border-canvas", c)} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Loved by <span className="font-semibold text-ink">12,000+</span> home chefs
                </p>
              </div>
            </motion.div>

            {/* Right — illustration card */}
            <motion.div
              className="lg:col-span-5 order-1 lg:order-2"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="relative aspect-square flex items-center justify-center">
                {/* soft, edgeless glow for depth (no background box) */}
                <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
                  <div className="size-[70%] rounded-full bg-brand-ochre/25 blur-3xl" />
                </div>
                <motion.img
                  src="/pizza.png"
                  alt="A freshly made pizza"
                  className="w-full h-full sm:w-[114%] sm:h-[114%] max-w-none object-contain drop-shadow-[0_30px_60px_rgba(10,10,10,0.22)] transform-gpu"
                  style={pizzaMotionStyle}
                />
                {/* floating product fragments */}
                <div className="absolute left-0 sm:-left-2 bottom-6 rounded-xl bg-canvas border border-hairline px-3 py-2 text-sm font-medium text-ink shadow-[0_14px_36px_-12px_rgba(10,10,10,0.3)]">
                  <span className="inline-flex items-center gap-2">
                    <Check className="size-4 text-success" /> 92% ingredient match
                  </span>
                </div>
                <div className="absolute right-0 sm:-right-2 top-6 rounded-full bg-canvas border border-hairline px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_14px_36px_-12px_rgba(10,10,10,0.3)]">
                  🍅 Tomato · 🧀 Mozzarella · 🌿 Basil
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Feature cards — saturated color cycle ─── */}
      <section id="why-ingredo" className="py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <FadeUp allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]}>
            <div className="max-w-2xl mb-12">
              <span className="caption-label text-muted-foreground">Why Ingredo</span>
              <h2 className="display-lg mt-4">Less waste. More flavor.</h2>
              <p className="body-lead mt-4">
                Everything you need to cook resourcefully, built around the ingredients you
                already own.
              </p>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FadeUp className="h-full" allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]} delay={0}>
              <FeatureCard
                tone="pink"
                eyebrow="Pantry-first"
                title="Cook from what you have"
                body="Add your ingredients once and instantly see what you can make tonight, no extra shopping trip required."
              >
                <FragmentPanel>
                  <div className="flex flex-wrap gap-2">
                    {["Eggs", "Spinach", "Garlic", "Parmesan", "Olive oil"].map((i) => (
                      <span key={i} className="rounded-full bg-surface-card px-3 py-1 text-[13px] font-medium">
                        {i}
                      </span>
                    ))}
                  </div>
                </FragmentPanel>
              </FeatureCard>
            </FadeUp>

            <FadeUp className="h-full" allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]} delay={120}>
              <FeatureCard
                tone="teal"
                eyebrow="Smart matching"
                title="Recipes ranked for you"
                body="Our matching engine scores every recipe by how many ingredients you already have, so the best options rise to the top."
              >
                <FragmentPanel className="space-y-2">
                  {[
                    { n: "Caprese Salad", m: 100 },
                    { n: "Pasta Marinara", m: 92 },
                    { n: "Veggie Stir Fry", m: 78 },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.n}</span>
                      <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[12px] font-semibold text-brand-teal">
                        {r.m}%
                      </span>
                    </div>
                  ))}
                </FragmentPanel>
              </FeatureCard>
            </FadeUp>

            <FadeUp className="h-full" allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]} delay={240}>
              <FeatureCard
                tone="lavender"
                eyebrow="Your collection"
                title="Save the keepers"
                body="Build a personal folio of recipes you love and come back to the ones that worked."
              >
                <FragmentPanel className="space-y-2">
                  {["Weeknight ramen", "Sunday roast", "5-min guacamole"].map((r) => (
                    <div key={r} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r}</span>
                      <Bookmark className="size-4 fill-ink text-ink" />
                    </div>
                  ))}
                </FragmentPanel>
              </FeatureCard>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <FadeUp allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]}>
            <div className="max-w-2xl mb-12">
              <span className="caption-label text-muted-foreground">How it works</span>
              <h2 className="display-lg mt-4">Three steps to dinner.</h2>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <FadeUp key={s.n} className="h-full" allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]} delay={i * 120}>
                <div className="clay-card h-full p-8">
                  <div className="size-12 rounded-full bg-ink text-on-primary flex items-center justify-center text-base font-semibold">
                    {s.n}
                  </div>
                  <h3 className="title-md mt-6">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-body-text">{s.body}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured recipes ─── */}
      <section id="popular-recipes" className="py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <FadeUp allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]}>
            <div className="flex items-end justify-between gap-6 mb-10">
              <div>
                <span className="caption-label text-muted-foreground">Popular right now</span>
                <h2 className="display-md mt-4">Featured recipes</h2>
              </div>
              <Link
                href="/search"
                className="hidden md:inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-brand-pink transition-colors"
              >
                View all <ArrowRight className="size-4" />
              </Link>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {sampleRecipes.map((recipe, i) => (
              <FadeUp key={recipe.id} allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]} delay={i * 120}>
                <Link href="/search" className="group block clay-card overflow-hidden">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" /> {recipe.time}
                      </span>
                      <span className="size-1 rounded-full bg-hairline" />
                      <span>{recipe.tag}</span>
                    </div>
                    <h3 className="title-md mt-2 group-hover:text-brand-pink transition-colors">
                      {recipe.title}
                    </h3>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA band ─── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <FadeUp allowedSections={["why-ingredo", "how-it-works", "popular-recipes"]}>
            <div className="relative overflow-hidden rounded-[28px] bg-surface-soft border border-hairline px-8 py-16 sm:px-16 sm:py-20 text-center">
              <div className="absolute -top-16 -left-10 size-56 rounded-full bg-brand-pink/15 blur-3xl" />
              <div className="absolute -bottom-20 -right-10 size-64 rounded-full bg-brand-lavender/20 blur-3xl" />
              <div className="relative">
                <Leaf className="size-8 text-brand-teal mx-auto mb-6" />
                <h2 className="display-md max-w-2xl mx-auto">
                  Turn tonight's ingredients into something worth cooking.
                </h2>
                <p className="body-lead mt-5 max-w-xl mx-auto">
                  Start free. No credit card, no clutter. Just better dinners from what you have.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                  <MagneticButton strength={18} className="w-full sm:w-auto">
                    <Button asChild size="lg" className="w-full sm:w-auto">
                      <Link href="/auth/signup">Get started now <ArrowRight className="size-4" /></Link>
                    </Button>
                  </MagneticButton>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <Link href="/search">Browse recipes</Link>
                  </Button>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}
