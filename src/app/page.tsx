"use client";

import { useRef, useState } from "react";

type Source = { id: string; label: string };
type Frame =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export default function ArchaeologyPage() {
  const [repo, setRepo] = useState<string>("vercel/next.js");
  const [path, setPath] = useState<string>("packages/next/src/server/config.ts");
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);

  async function dig(): Promise<void> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/archaeology", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, path, question }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(detail?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let cut: number;
        while ((cut = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, cut).trim();
          buffer = buffer.slice(cut + 1);
          if (!line) continue;

          let parsed: Frame;
          try {
            parsed = JSON.parse(line) as Frame;
          } catch {
            continue;
          }

          if (parsed.type === "sources") setSources(parsed.sources);
          else if (parsed.type === "delta") {
            acc += parsed.text;
            setAnswer(acc);
          } else if (parsed.type === "error") throw new Error(parsed.message);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something broke");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Git archaeology</h1>
      <p className="mt-1 text-sm text-slate-600">
        Point it at a file. Ask why the code is the way it is.
      </p>

      <div className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Repo
            </span>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/name"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Path (blank = whole repo)
            </span>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="src/lib/thing.ts"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
            />
          </label>
        </div>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Why does this use a custom cache instead of the framework one?"
          className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-900"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dig}
            disabled={busy || repo.trim().length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Digging…" : "Dig"}
          </button>

          {busy && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {sources.length > 0 && (
        <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500">
            {sources.length} pieces of evidence
          </summary>
          <ul className="mt-3 space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="text-xs text-slate-600">
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
                  [{s.id}]
                </code>{" "}
                {s.label}
              </li>
            ))}
          </ul>
        </details>
      )}

      {answer && (
        <article className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed">
          {answer}
        </article>
      )}
    </main>
  );
}

