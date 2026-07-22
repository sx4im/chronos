import {
  useEffect,
  useRef,
  type ReactNode,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from "react";
import gsap from "gsap";
import type { ParsedCapsule } from "./capsule.js";
import { ChronosLogo } from "./ChronosLogo.js";
import {
  ClockIcon,
  NetworkIcon,
  RepeatIcon,
  CodeIcon,
  GithubIcon,
  ArrowRightIcon,
  ChevronDownIcon,
} from "./Icons.js";

type LoadResult = { ok: true; capsule: ParsedCapsule; filename: string } | { ok: false; error: string };

export function LandingPage({
  result,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  loadDemo,
  children,
}: {
  result: LoadResult;
  dragOver: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  loadDemo: () => void;
  children?: ReactNode;
}): JSX.Element {
  // Animation Refs for GSAP
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroActionsRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  // GSAP Entrance Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(heroTitleRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
      });
      gsap.from(heroSubRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.2,
        ease: "power3.out",
      });
      gsap.from(heroActionsRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.35,
        ease: "power3.out",
      });
      gsap.from(mockupRef.current, {
        y: 40,
        opacity: 0,
        duration: 1,
        delay: 0.5,
        ease: "power3.out",
      });
    });
    return () => ctx.revert();
  }, []);

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const elem = document.getElementById(targetId);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className={`landing-page ${dragOver ? "dragover" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 1. Hero Section (Navy Hero #02093a) */}
      <section className="hero-section">
        <div className="hero-glow" />

        {/* Top Navigation */}
        <nav className="top-nav">
          <div className="nav-brand" onClick={loadDemo}>
            <ChronosLogo size={28} />
            <span className="nav-title">Chronos</span>
            <span className="nav-version">v0.0.0</span>
          </div>

          <div className="nav-links">
            <a href="#overview" onClick={(e) => handleNavClick(e, "overview")} className="nav-link">Overview</a>
            <a href="#features" onClick={(e) => handleNavClick(e, "features")} className="nav-link">Features</a>
            <a href="#cli" onClick={(e) => handleNavClick(e, "cli")} className="nav-link">CLI Reference</a>
            <a href="https://github.com/sx4im/chronos" target="_blank" rel="noreferrer" className="nav-link" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <GithubIcon /> GitHub
            </a>
          </div>

          <div className="nav-actions">
            <button className="btn-primary" onClick={loadDemo}>
              Try Demo Capsule
            </button>
            <label>
              <input type="file" accept=".json,application/json" onChange={onFileChange} hidden />
              <span className="btn-secondary">Load Capsule JSON...</span>
            </label>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="hero-content" id="overview">
          <h1 className="hero-title" ref={heroTitleRef}>
            Find the race condition.<br />Replay it forever.
          </h1>
          <p className="hero-subtitle" ref={heroSubRef}>
            Chronos virtualizes discrete time, seeded randomness (<code>xoshiro256**</code>), and simulated transport. Sweep thousands of seeds in Vitest and replay bugs bit-identically from a single integer seed.
          </p>
          <div className="hero-actions" ref={heroActionsRef}>
            <button className="btn-primary" onClick={loadDemo}>
              Explore Interactive Workspace <ChevronDownIcon />
            </button>
            <label>
              <input type="file" accept=".json,application/json" onChange={onFileChange} hidden />
              <span className="btn-secondary">Drop or Open Capsule</span>
            </label>
          </div>
        </div>

        {/* 2. Floating Product Workspace Card */}
        <div className="workspace-mockup" ref={mockupRef}>
          <div className="mockup-header">
            <div className="mockup-controls">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="mockup-title">
              <span>Time-Travel Inspector — {result.ok ? result.filename : "No Capsule Loaded"}</span>
              {result.ok && result.capsule.trace.result === "violation" && (
                <span className="mockup-badge">INVARIANT VIOLATION</span>
              )}
            </div>
            <label>
              <input type="file" accept=".json,application/json" onChange={onFileChange} hidden />
              <span style={{ fontSize: "12px", cursor: "pointer", color: "var(--color-accent-blue)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                Change Capsule <ArrowRightIcon style={{ width: "12px", height: "12px" }} />
              </span>
            </label>
          </div>

          <div className="inspector-body">
            {children}
          </div>
        </div>
      </section>

      {/* 3. Pastel Features Section */}
      <section className="features-section" id="features">
        <div className="section-header">
          <h2 className="section-title">Why Systems Engineers Choose Chronos</h2>
          <p className="section-subtitle">
            Built on the FoundationDB and TigerBeetle simulation testing lineage—finally native for Node.js & TypeScript.
          </p>
        </div>

        <div className="card-grid">
          {/* Peach Tile */}
          <div className="feature-card peach">
            <div>
              <div className="card-icon" style={{ color: "#d97706" }}>
                <ClockIcon />
              </div>
              <h3 className="card-title">Deterministic Virtual Time</h3>
              <p className="card-body">
                <code>env.now()</code>, <code>env.sleep()</code>, and <code>env.setTimeout()</code> run on a virtual clock. Thousands of simulated seconds advance in zero wall-clock time.
              </p>
            </div>
          </div>

          {/* Rose Tile */}
          <div className="feature-card rose">
            <div>
              <div className="card-icon" style={{ color: "#e11d48" }}>
                <NetworkIcon />
              </div>
              <h3 className="card-title">Seeded Chaos & Partition Manager</h3>
              <p className="card-body">
                Inject packet loss, latency jitter, simulated network partitions, and process crashes. Every event flows through the same <code>(time, seq)</code> min-heap queue.
              </p>
            </div>
          </div>

          {/* Lilac Tile */}
          <div className="feature-card lilac">
            <div>
              <div className="card-icon" style={{ color: "#7c3aed" }}>
                <RepeatIcon />
              </div>
              <h3 className="card-title">Bit-Identical Capsule Replay</h3>
              <p className="card-body">
                Failing runs automatically export to <code>.chronos/failures/&lt;seed&gt;.json</code>. Hand the capsule to a teammate or replay it forever on any machine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CLI & Code Section */}
      <section className="code-section" id="cli">
        <div className="section-header">
          <h2 className="section-title">Vitest-Native & CLI Ready</h2>
          <p className="section-subtitle">
            Drop <code>simTest</code> directly into existing suites or use the Chronos CLI to sweep and reproduce bugs.
          </p>
        </div>

        <div className="code-container">
          <div className="code-header" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CodeIcon style={{ width: "16px", height: "16px" }} /> /// example.test.ts
          </div>
          <pre className="code-block">
            <span className="kw">import</span> {"{"} simTest, expectInvariant {"}"} <span className="kw">from</span> <span className="str">"@sx4im/chronos-vitest"</span>;{"\n\n"}
            <span className="fn">simTest</span>(<span className="str">"Raft leader safety"</span>, {"{"} seeds: 1000, nodes: 5 {"}"}, <span className="kw">async</span> (sim) =&gt; {"{"}{"\n"}
            {"  "}for (<span className="kw">const</span> node <span className="kw">of</span> sim.nodes) {"{"}{"\n"}
            {"    "}<span className="fn">createRaftNode</span>(node.env);{"\n"}
            {"  "}{"}"}{"\n\n"}
            {"  "}<span className="fn">expectInvariant</span>(<span className="str">"at-most-one-leader"</span>, (world) =&gt; getLeaders().length &lt;= 1);{"\n"}
            {"  "}<span className="kw">await</span> sim.<span className="fn">settle</span>();{"\n"}
            {"}"});
          </pre>
        </div>
      </section>

      {/* 5. Dribbble-Inspired High-End Multi-Column Footer */}
      <footer className="landing-footer">
        <div className="footer-glow" />

        {/* Terminal Quick-Install Strip */}
        <div className="footer-install-strip">
          <div className="install-cmd">
            $ <span>pnpm add</span> @sx4im/chronos-core @sx4im/chronos-vitest
          </div>
          <span className="footer-badge">MIT LICENSE · OPEN SOURCE</span>
        </div>

        {/* Multi-Column Directory */}
        <div className="footer-columns-grid">
          <div className="footer-brand-col">
            <div className="footer-brand-title">
              <ChronosLogo size={28} /> Chronos
            </div>
            <p className="footer-brand-desc">
              The deterministic simulation testing framework for distributed TypeScript applications. Built for zero-flakiness and bit-identical bug reproduction.
            </p>
          </div>

          <div>
            <div className="footer-col-title">// Core Engine</div>
            <div className="footer-col-links">
              <a href="#overview">Virtual Clock</a>
              <a href="#overview">xoshiro256** PRNG</a>
              <a href="#overview">Min-Heap Scheduler</a>
              <a href="#overview">Microtask Draining</a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">// Developer CLI</div>
            <div className="footer-col-links">
              <a href="#cli">chronos replay</a>
              <a href="#cli">chronos trace</a>
              <a href="#cli">chronos sweep</a>
              <a href="#cli">chronos doctor</a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">// Ecosystem</div>
            <div className="footer-col-links">
              <a href="#features">Vitest Integration</a>
              <a href="#overview">Inspector UI</a>
              <a href="#overview">Time-Travel Debugger</a>
              <a href="#features">Capsule Exporter</a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">// Open Source</div>
            <div className="footer-col-links">
              <a href="https://github.com/sx4im/chronos" target="_blank" rel="noreferrer">GitHub Repository</a>
              <a href="https://github.com/sx4im/chronos" target="_blank" rel="noreferrer">Documentation</a>
              <a href="https://github.com/sx4im/chronos" target="_blank" rel="noreferrer">MIT License</a>
              <a href="https://github.com/sx4im/chronos" target="_blank" rel="noreferrer">Contributing Guide</a>
            </div>
          </div>
        </div>

        {/* Bottom Utility Bar */}
        <div className="footer-bottom-bar">
          <div>© 2026 Chronos Systems Inc. All rights reserved.</div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <a href="https://github.com/sx4im/chronos" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <GithubIcon style={{ width: "16px", height: "16px" }} /> sx4im/chronos
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
