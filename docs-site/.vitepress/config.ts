import { defineConfig } from "vitepress";

// Chronos docs site config. Deployed on Vercel at the root domain.
const REPO = "https://github.com/sx4im/chronos";

export default defineConfig({
  lang: "en-US",
  title: "Chronos",
  description: "Deterministic simulation testing for Node.js & TypeScript.",
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["meta", { name: "theme-color", content: "#097fe8" }],
    ["link", { rel: "icon", href: "/logo.svg" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  ],
  themeConfig: {
    siteTitle: "Chronos",
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/quickstart", activeMatch: "/guide/" },
      {
        text: "Concepts",
        link: "/concepts/determinism",
        activeMatch: "/concepts/",
      },
      { text: "API", link: "/api/", activeMatch: "/api/" },
      { text: "Examples", link: "/examples", activeMatch: "/examples" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Getting started",
          items: [
            { text: "15-minute quickstart", link: "/guide/quickstart" },
            { text: "Writing testable systems with DI", link: "/guide/di" },
            { text: "Replay & failure capsules", link: "/guide/replay" },
            { text: "The CLI", link: "/guide/cli" },
          ],
        },
      ],
      "/concepts/": [
        {
          text: "Concepts",
          items: [
            { text: "The determinism model", link: "/concepts/determinism" },
            {
              text: "Virtual time & the scheduler",
              link: "/concepts/scheduler",
            },
            { text: "Simulated network & chaos", link: "/concepts/network" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API reference",
          items: [{ text: "Overview", link: "/api/" }],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: REPO }],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Saim Shafique",
    },
    search: { provider: "local" },
    editLink: {
      pattern:
        "https://github.com/sx4im/chronos/edit/main/docs-site/:path",
      text: "Edit this page on GitHub",
    },
  },
});
