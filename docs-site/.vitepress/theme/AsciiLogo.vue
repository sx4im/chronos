<template>
  <div ref="container" class="ascii-logo-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

interface Particle {
  x0: number;
  y0: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
}

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

let animId: number | null = null;
let mouseX = -9999;
let mouseY = -9999;
let particles: Particle[] = [];
let fontSize = 13;
let canvasSize = 440;

// Raw ASCII template with hyphen (-) characters
const rawAscii = [
  "                                --------------------------------------                               ",
  "                               ----------------------------------------                              ",
  "                               ----------------------------------------                              ",
  "                               ----------------------------------------                              ",
  "                     ------------------------------------------------------------                    ",
  "                     ------------------------------------------------------------                    ",
  "                     ------------------------------------------------------------                    ",
  "                      ----------------------------------------------------------                     ",
  "             ---------------------------------          ---------------------------------            ",
  "             -------------------------------------  -------------------------------------            ",
  "             ----------------------------------------------------------------------------            ",
  "             ----------------------------------------------------------------------------            ",
  "         -----------------------------------      -------------------------------------------        ",
  "         ------------------------------------------------------------------------------------        ",
  "         ------------------------------------------------------------------------------------        ",
  "         ------------------------------------------------------------------------------------        ",
  "       -----------------------------          -------------------------------------------------      ",
  "       ---------------------------------  -----------------------------------------------------      ",
  "       ----------------------------------------------------------------------------------------      ",
  "       ----------------------------------------------------------------------------------------      ",
  "         -----------------------------------      -------------------------------------------        ",
  "         ------------------------------------------------------------------------------------        ",
  "         ------------------------------------------------------------------------------------        ",
  "         ------------------------------------------------------------------------------------        ",
  "             ---------------------------------          ---------------------------------            ",
  "             -------------------------------------  -------------------------------------            ",
  "             ----------------------------------------------------------------------------            ",
  "             ----------------------------------------------------------------------------            ",
  "                     ------------------------------------------------------------                    ",
  "                     ------------------------------------------------------------                    ",
  "                     ------------------------------------------------------------                    ",
  "                      ----------------------------------------------------------                     ",
  "                                --------------------------------------                               ",
  "                               ----------------------------------------                              ",
  "                               ----------------------------------------                              ",
  "                               ----------------------------------------                              ",
];

function initParticles() {
  if (!canvas.value) return;
  const cvs = canvas.value;
  const dpr = window.devicePixelRatio || 1;

  const screenWidth = window.innerWidth;
  if (screenWidth < 480) {
    canvasSize = Math.min(screenWidth - 32, 320);
  } else if (screenWidth < 768) {
    canvasSize = 380;
  } else {
    canvasSize = 440;
  }

  cvs.width = canvasSize * dpr;
  cvs.height = canvasSize * dpr;
  cvs.style.width = `${canvasSize}px`;
  cvs.style.height = `${canvasSize}px`;

  const ctx = cvs.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  particles = [];
  const rows = rawAscii.length;
  const cols = rawAscii[0].length;

  const cellW = canvasSize / cols;
  const cellH = canvasSize / rows;
  fontSize = Math.max(9, Math.floor(cellH * 1.4));

  const totalW = cols * cellW;
  const totalH = rows * cellH;
  const startX = (canvasSize - totalW) / 2;
  const startY = (canvasSize - totalH) / 2;

  // Sample characters evenly to prevent blob overlap and allow clean displacement
  const colStep = 2;
  const rowStep = 1;

  for (let r = 0; r < rows; r += rowStep) {
    const line = rawAscii[r];
    for (let c = 0; c < cols; c += colStep) {
      if (line[c] === "-") {
        const x0 = startX + (c + 0.5) * cellW;
        const y0 = startY + (r + 0.5) * cellH;
        particles.push({
          x0,
          y0,
          x: x0,
          y: y0,
          vx: 0,
          vy: 0,
          char: "-",
        });
      }
    }
  }
}

function handlePointer(clientX: number, clientY: number) {
  if (!canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  if (
    clientX < rect.left - 120 ||
    clientX > rect.right + 120 ||
    clientY < rect.top - 120 ||
    clientY > rect.bottom + 120
  ) {
    mouseX = -9999;
    mouseY = -9999;
    return;
  }
  const scaleX = canvasSize / rect.width;
  const scaleY = canvasSize / rect.height;
  mouseX = (clientX - rect.left) * scaleX;
  mouseY = (clientY - rect.top) * scaleY;
}

function onWindowMouseMove(e: MouseEvent) {
  handlePointer(e.clientX, e.clientY);
}

function onWindowTouchMove(e: TouchEvent) {
  if (e.touches.length > 0) {
    handlePointer(e.touches[0].clientX, e.touches[0].clientY);
  }
}

function animate() {
  if (!canvas.value) return;
  const cvs = canvas.value;
  const ctx = cvs.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = cvs.width / dpr;
  const height = cvs.height / dpr;

  ctx.clearRect(0, 0, width, height);
  ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const mouseRadius = canvasSize * 0.20;
  const spring = 0.10;
  const friction = 0.75;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    const dx = p.x - mouseX;
    const dy = p.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < mouseRadius && dist > 0) {
      const force = ((mouseRadius - dist) / mouseRadius) * 7.5;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }

    const ax = (p.x0 - p.x) * spring;
    const ay = (p.y0 - p.y) * spring;

    p.vx = (p.vx + ax) * friction;
    p.vy = (p.vy + ay) * friction;

    p.x += p.vx;
    p.y += p.vy;

    // Use exact site brand blue color (#076bca in light mode, #3d9bef in dark mode)
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const rgb = isDark ? "61, 155, 239" : "7, 107, 202";
    const distFromHome = Math.hypot(p.x - p.x0, p.y - p.y0);
    const alpha = Math.min(1, 0.85 + distFromHome * 0.05);
    ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(2)})`;

    ctx.fillText(p.char, p.x, p.y);
  }

  animId = requestAnimationFrame(animate);
}

onMounted(() => {
  initParticles();
  animate();
  window.addEventListener("mousemove", onWindowMouseMove, { passive: true });
  window.addEventListener("touchmove", onWindowTouchMove, { passive: true });
  window.addEventListener("resize", initParticles);
});

onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId);
  window.removeEventListener("mousemove", onWindowMouseMove);
  window.removeEventListener("touchmove", onWindowTouchMove);
  window.removeEventListener("resize", initParticles);
});
</script>

<style scoped>
.ascii-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 440px;
  height: 440px;
  margin: 0 auto;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  pointer-events: auto;
}

canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  pointer-events: auto;
}

@media (max-width: 768px) {
  .ascii-logo-container {
    height: 380px;
    max-width: 380px;
  }
}

@media (max-width: 480px) {
  .ascii-logo-container {
    height: 320px;
    max-width: 320px;
  }
}
</style>
