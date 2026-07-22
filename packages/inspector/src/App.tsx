// Chronos Inspector — Notion-Inspired Framework Landing Surface & Interactive Workspace UI.

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { ParsedCapsule } from "./capsule.js";
import {
  parseCapsule,
  isSameOriginCapsuleUrl,
  capsuleParamError,
} from "./capsule.js";
import { DEMO_CAPSULE } from "./demoCapsule.js";
import { LandingPage } from "./LandingPage.js";
import { InspectorWorkspace, ErrorView } from "./InspectorWorkspace.js";

type LoadResult = { ok: true; capsule: ParsedCapsule; filename: string } | { ok: false; error: string };

async function loadFile(file: File): Promise<LoadResult> {
  try {
    const text = await file.text();
    const capsule = parseCapsule(text);
    return { ok: true, capsule, filename: file.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function App(): JSX.Element {
  const [result, setResult] = useState<LoadResult>({
    ok: true,
    capsule: DEMO_CAPSULE,
    filename: "demo-raft-failure.json",
  });
  const [view, setView] = useState<"timeline" | "diagram" | "metrics">("timeline");
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  // Preload via ?capsule=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("capsule");
    if (!url) return;
    if (!isSameOriginCapsuleUrl(url)) {
      setResult({ ok: false, error: capsuleParamError(url) });
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        if (cancelled) return;
        try {
          setResult({ ok: true, capsule: parseCapsule(text), filename: url });
        } catch (e) {
          setResult({ ok: false, error: (e as Error).message });
        }
      })
      .catch((e) => {
        if (!cancelled) setResult({ ok: false, error: `could not fetch ${url}: ${(e as Error).message}` });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setResult(await loadFile(file));
  }, []);

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setResult(await loadFile(file));
  }, []);

  const loadDemo = useCallback(() => {
    setResult({
      ok: true,
      capsule: DEMO_CAPSULE,
      filename: "demo-raft-failure.json",
    });
  }, []);

  return (
    <LandingPage
      result={result}
      dragOver={dragOver}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onFileChange={onFileChange}
      loadDemo={loadDemo}
    >
      {result.ok ? (
        <InspectorWorkspace
          capsule={result.capsule}
          filename={result.filename}
          view={view}
          onView={setView}
          selectedSeq={selectedSeq}
          onSelect={setSelectedSeq}
          filterKind={filterKind}
          onFilterKind={setFilterKind}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
        />
      ) : (
        <ErrorView error={result.error} />
      )}
    </LandingPage>
  );
}
