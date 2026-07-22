// chronos explain (§4.3, optional) — summarize a failing capsule in plain
// English via multi-provider AI (OpenRouter, Groq, OpenAI, Anthropic, Gemini,
// DeepSeek, xAI Grok, Mistral, Together AI, Fireworks AI, Cerebras, Perplexity,
// Qwen, Novita AI, Hyperbolic, NVIDIA NIM, Ollama, LM Studio, or Custom endpoints).
// Interactive arrow-key selection & automatic model discovery.
// Zero LLM dependencies in core — CLI-only convenience.

import { readCapsule, type FailureCapsule } from "@sx4im/chronos-vitest/engine";
import type { TraceEvent } from "@sx4im/chronos-core";
import { resolveCapsulePath, capsuleReadError } from "./util.js";
import { C, drawBox, selectPrompt, inputPrompt, renderTopBanner } from "./ui.js";

export interface ExplainResult {
  exitCode: number;
  message: string;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  envKey: string;
  baseUrl: string;
  defaultModel: string;
  popularModels: string[];
  type: "openai" | "anthropic" | "gemini";
  extraHeaders?: Record<string, string>;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openrouter",
    name: "OpenRouter (300+ Models Aggregator)",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.7-sonnet",
    popularModels: ["anthropic/claude-3.7-sonnet", "google/gemini-2.0-flash-001", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-r1"],
    type: "openai",
    extraHeaders: { "HTTP-Referer": "https://github.com/sx4im/chronos", "X-Title": "Chronos DST" },
  },
  {
    id: "groq",
    name: "Groq (Ultra-Fast LPU Engine)",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    popularModels: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "mixtral-8x7b-32768"],
    type: "openai",
  },
  {
    id: "openai",
    name: "OpenAI (GPT-4o & o3-mini)",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    popularModels: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    type: "openai",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude 3.7 Sonnet)",
    envKey: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-7-sonnet-20250219",
    popularModels: ["claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    type: "anthropic",
  },
  {
    id: "gemini",
    name: "Google Gemini (Gemini 2.0 Flash)",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    popularModels: ["gemini-2.0-flash", "gemini-1.5-pro"],
    type: "gemini",
  },
  {
    id: "deepseek",
    name: "DeepSeek (DeepSeek V3 / R1)",
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-reasoner",
    popularModels: ["deepseek-reasoner", "deepseek-chat"],
    type: "openai",
  },
  {
    id: "xai",
    name: "xAI Grok (Grok-2)",
    envKey: "XAI_API_KEY",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-2-1212",
    popularModels: ["grok-2-1212", "grok-beta"],
    type: "openai",
  },
  {
    id: "mistral",
    name: "Mistral AI (Mistral Large & Codestral)",
    envKey: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    popularModels: ["mistral-large-latest", "codestral-latest", "mistral-small-latest"],
    type: "openai",
  },
  {
    id: "together",
    name: "Together AI (Open Models Fast API)",
    envKey: "TOGETHER_API_KEY",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    popularModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-Coder-32B-Instruct"],
    type: "openai",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    envKey: "FIREWORKS_API_KEY",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    popularModels: ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
    type: "openai",
  },
  {
    id: "cerebras",
    name: "Cerebras AI (1800+ tokens/sec)",
    envKey: "CEREBRAS_API_KEY",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.3-70b",
    popularModels: ["llama3.3-70b", "llama3.1-8b"],
    type: "openai",
  },
  {
    id: "perplexity",
    name: "Perplexity AI (Sonar Pro)",
    envKey: "PERPLEXITY_API_KEY",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
    popularModels: ["sonar-pro", "sonar"],
    type: "openai",
  },
  {
    id: "qwen",
    name: "Qwen / Alibaba DashScope",
    envKey: "DASHSCOPE_API_KEY",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-max",
    popularModels: ["qwen-max", "qwen-plus", "qwen-turbo"],
    type: "openai",
  },
  {
    id: "novita",
    name: "Novita AI",
    envKey: "NOVITA_API_KEY",
    baseUrl: "https://api.novita.ai/v3/openai",
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    popularModels: ["meta-llama/llama-3.3-70b-instruct"],
    type: "openai",
  },
  {
    id: "hyperbolic",
    name: "Hyperbolic AI",
    envKey: "HYPERBOLIC_API_KEY",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    popularModels: ["meta-llama/Llama-3.3-70B-Instruct"],
    type: "openai",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    envKey: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.3-70b-instruct",
    popularModels: ["meta/llama-3.3-70b-instruct"],
    type: "openai",
  },
  {
    id: "ollama",
    name: "Ollama (Local Desktop)",
    envKey: "OLLAMA_BASE_URL",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.3",
    popularModels: ["llama3.3", "llama3", "deepseek-r1"],
    type: "openai",
  },
  {
    id: "lmstudio",
    name: "LM Studio (Local Desktop)",
    envKey: "LMSTUDIO_BASE_URL",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
    popularModels: ["local-model"],
    type: "openai",
  },
  {
    id: "custom",
    name: "Custom OpenAI-Compatible Endpoint",
    envKey: "LLM_BASE_URL",
    baseUrl: "http://localhost:8080/v1",
    defaultModel: "custom-model",
    popularModels: ["custom-model"],
    type: "openai",
  },
];

function sanitizeSummary(summary: string): string {
  return summary
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/(bearer\s+|token[=:]\s*|key[=:]\s*|secret[=:]\s*|password[=:]\s*)(?!\[REDACTED)[^\s,;"]+/gi, "$1[REDACTED]");
}

function formatEvent(e: TraceEvent): string {
  const where = `t=${e.t} seq=${e.seq}`;
  switch (e.kind) {
    case "timer":
      return `${where} timer${e.nodeId !== undefined ? " " + e.nodeId : ""}`;
    case "wake":
      return `${where} wake ${e.nodeId}`;
    case "send":
      return `${where} send ${e.from}→${e.to} ${sanitizeSummary(e.summary)}`;
    case "deliver":
      return `${where} deliver ${e.from}→${e.to} ${sanitizeSummary(e.summary)}`;
    case "crash":
      return `${where} crash ${e.nodeId}`;
    case "restart":
      return `${where} restart ${e.nodeId}`;
    case "partition":
      return `${where} partition [${e.groups.map((g) => g.join(",")).join("] | [")}] healAt=${e.healAt}`;
    case "invariant-violation":
      return `${where} VIOLATION ${e.name} — ${sanitizeSummary(e.detail)}`;
  }
}

function summarize(c: FailureCapsule): string {
  const events = c.trace.events;
  const tail = events.slice(-30);
  return [
    `seed=${c.seed}`,
    `nodes=[${c.nodes.join(", ")}]`,
    `invariant: ${c.invariant.name} — ${sanitizeSummary(c.invariant.detail)}`,
    `network: latency ${c.config.network.minLatency}-${c.config.network.maxLatency}ms, drop=${c.config.network.dropProb}, dup=${c.config.network.dupProb}`,
    `chaos: partition=${c.config.chaos.partitionProb} crash=${c.config.chaos.crashProb} restart=${c.config.chaos.restartProb}`,
    `events (last ${tail.length} of ${events.length}):`,
    ...tail.map(formatEvent),
  ].join("\n");
}

/** Detect if an environment key is already configured */
function detectEnvironmentProvider(): { provider: ProviderDefinition; key: string; model: string; baseUrl: string } | null {
  const env = process.env;

  if (env.CHRONOS_EXPLAIN_BASE_URL || env.LLM_BASE_URL || env.CUSTOM_BASE_URL) {
    const customProv = PROVIDERS.find((p) => p.id === "custom")!;
    return {
      provider: customProv,
      key: env.CHRONOS_EXPLAIN_KEY || env.LLM_API_KEY || env.CUSTOM_API_KEY || "dummy",
      model: env.CHRONOS_EXPLAIN_MODEL || env.LLM_MODEL || env.CUSTOM_MODEL || "default",
      baseUrl: env.CHRONOS_EXPLAIN_BASE_URL || env.LLM_BASE_URL || env.CUSTOM_BASE_URL || "",
    };
  }

  for (const prov of PROVIDERS) {
    if (prov.id === "custom") continue;
    const val = env[prov.envKey] || (prov.id === "gemini" ? env.GOOGLE_API_KEY : undefined);
    if (val) {
      return {
        provider: prov,
        key: val,
        model: env.CHRONOS_EXPLAIN_MODEL || prov.defaultModel,
        baseUrl: prov.baseUrl,
      };
    }
  }

  return null;
}

/** Fetch online models from OpenAI-compatible GET /models endpoint */
async function fetchOnlineModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const endpoint = baseUrl.endsWith("/models") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/models`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(endpoint, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(to));

    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string }[] };
    if (Array.isArray(data.data)) {
      return data.data.map((m) => m.id).slice(0, 15);
    }
  } catch {
    // Graceful fallback to static popular models
  }
  return [];
}

export async function explainCommand(capsulePath: string): Promise<ExplainResult> {
  const topHeader = renderTopBanner("0.1.5");

  let capsule: FailureCapsule;
  try {
    capsule = await readCapsule(resolveCapsulePath(capsulePath));
  } catch (e) {
    return {
      exitCode: 2,
      message: topHeader + capsuleReadError(capsulePath, e),
    };
  }

  let selectedProvider: ProviderDefinition;
  let apiKey = "";
  let selectedModel = "";
  let targetBaseUrl = "";

  const envDetect = detectEnvironmentProvider();

  if (!process.stdout.isTTY && !envDetect) {
    const guideLines = [
      "Chronos Explain translates simulation failure traces into plain-English root cause analysis.",
      "Set ANY provider environment variable below to use your preferred model:",
      "",
      `  ${C.bold("Provider")}           ${C.bold("Environment Variable")}        ${C.bold("Upgraded Default Model")}`,
      "  ─────────────────────────────────────────────────────────────────────────────",
      ...PROVIDERS.map(
        (p) =>
          `  ${(p.name.split(" ")[0] || p.id).padEnd(16)} export ${p.envKey.padEnd(20)}=...    ${p.defaultModel}`
      ),
      "",
      "To override model for any provider: export CHRONOS_EXPLAIN_MODEL=your-model-id",
    ];

    return {
      exitCode: 0,
      message:
        topHeader +
        `  ${C.badgeIndigo(" CHRONOS EXPLAIN ")} ${C.slate("skipped (no AI provider key set)")}\n\n` +
        drawBox(`${C.indigo("AI PROVIDER CONFIGURATION GUIDE")}`, guideLines) +
        "\n",
    };
  }

  if (envDetect && (!process.stdout.isTTY || process.env.CI)) {
    // Non-interactive / CI environment with key: use detected provider directly
    selectedProvider = envDetect.provider;
    apiKey = envDetect.key;
    selectedModel = envDetect.model;
    targetBaseUrl = envDetect.baseUrl;
  } else {
    // Interactive Selection Workflow
    process.stdout.write(topHeader);
    process.stdout.write(`${C.bold("Chronos Failure Capsule AI Explanation")}\n`);
    process.stdout.write(`${C.muted(`Loaded capsule: ${capsulePath}`)}\n\n`);

    // 1. Select Provider via Arrow Keys
    const providerOptions = PROVIDERS.map((p) => ({
      label: p.name,
      value: p,
      hint: process.env[p.envKey] ? "Key detected in ENV" : p.id === "ollama" || p.id === "lmstudio" ? "Local Desktop" : undefined,
    }));

    selectedProvider = await selectPrompt("Select AI Provider", providerOptions, 0);

    // 2. Base URL prompt if Custom
    if (selectedProvider.id === "custom") {
      targetBaseUrl = await inputPrompt("Enter Base Endpoint URL", "http://localhost:8080/v1");
    } else {
      targetBaseUrl = selectedProvider.baseUrl;
    }

    // 3. API Key prompt if not local / not set
    const envKeyVal = process.env[selectedProvider.envKey] || (selectedProvider.id === "gemini" ? process.env.GOOGLE_API_KEY : undefined);
    if (envKeyVal) {
      apiKey = envKeyVal;
      process.stdout.write(`${C.emerald("✔")} ${C.bold("API Key")} ${C.cyan(`Loaded from ${selectedProvider.envKey}`)}\n\n`);
    } else if (selectedProvider.id === "ollama" || selectedProvider.id === "lmstudio") {
      apiKey = "local";
    } else {
      apiKey = await inputPrompt(`Enter ${selectedProvider.name} API Key`);
    }

    // 4. Auto-discover or Select Model
    process.stdout.write(`${C.slate("Fetching available models...")}\n`);
    const fetched = await fetchOnlineModels(targetBaseUrl, apiKey);
    const combinedModels = Array.from(new Set([...fetched, ...selectedProvider.popularModels]));

    const modelOptions = [
      ...combinedModels.map((m) => ({ label: m, value: m })),
      { label: "[ Enter Custom Model ID... ]", value: "custom" },
    ];

    const modelChoice = await selectPrompt("Select Model ID", modelOptions, 0);
    if (modelChoice === "custom") {
      selectedModel = await inputPrompt("Enter Custom Model ID", selectedProvider.defaultModel);
    } else {
      selectedModel = modelChoice;
    }
  }

  const prompt =
    "You are a distributed-systems debugging expert. Below is a deterministic-simulation " +
    "failure capsule (Chronos). Concisely explain the likely root cause of the invariant " +
    "violation and point to the most suspicious trace events.\n\n" +
    summarize(capsule);

  try {
    const explanationText = await executeLLMCall(selectedProvider, apiKey, selectedModel, targetBaseUrl, prompt);
    const reportLines = [
      `${C.bold("Provider")}: ${C.cyan(selectedProvider.name)}  ${C.bold("Model")}: ${C.purple(selectedModel)}`,
      `${C.bold("Capsule")}:  ${C.white(capsulePath)}  ${C.bold("Seed")}: ${C.amber(capsule.seed.toString())}`,
      "",
      `${C.bold("INVARIANT VIOLATION")}:`,
      `  ${C.rose("✕")} ${C.bold(capsule.invariant.name)} — ${C.white(capsule.invariant.detail || "violated")}`,
      "",
      `${C.bold("AI ROOT CAUSE ANALYSIS & DIAGNOSIS")}:`,
      ...explanationText.split("\n").map((line) => `  ${line}`),
    ];

    return {
      exitCode: 0,
      message: "\n" + drawBox(`${C.indigo("CHRONOS AI FAILURE EXPLANATION")}`, reportLines) + "\n",
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : "API call failed";
    return {
      exitCode: 1,
      message:
        `\n${C.badgeRose(" EXPLAIN ERROR ")} ${C.rose(`${selectedProvider.name} call failed: ${err}`)} (degraded).\n` +
        `  The core simulation run is unaffected. Capsule file: ${capsulePath}\n`,
    };
  }
}

async function executeLLMCall(
  provider: ProviderDefinition,
  key: string,
  model: string,
  baseUrl: string,
  prompt: string
): Promise<string> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 30_000);

  try {
    if (provider.type === "gemini") {
      const endpoint = baseUrl.endsWith("/generateContent")
        ? `${baseUrl}?key=${key}`
        : `${baseUrl}/models/${model}:generateContent?key=${key}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!out) throw new Error("empty Gemini completion");
      return out;
    }

    if (provider.type === "anthropic") {
      const endpoint = baseUrl.endsWith("/messages") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/messages`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { content?: { text?: string }[] };
      const out = data.content?.[0]?.text;
      if (!out) throw new Error("empty Anthropic completion");
      return out;
    }

    // Default OpenAI-compatible protocol
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      ...(provider.extraHeaders || {}),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 600,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${body.slice(0, 150)}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const out = data.choices?.[0]?.message?.content;
    if (!out) throw new Error("empty response");
    return out;
  } finally {
    clearTimeout(to);
  }
}
