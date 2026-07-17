"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { AssistantConfig, SandboxMessage } from "./assistant-types";

interface AssistantSandboxProps {
  config: AssistantConfig;
  canWrite: boolean;
}

type ChatItem = { type: "user" | "bot" | "info"; text: string };

function newSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Parse un événement SSE brut ("event: x\ndata: {...}") → {event, data}. */
function parseSseEvent(raw: string): { event: string; data: Record<string, unknown> } {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(dataLines.join("\n") || "{}");
  } catch {
    /* garde {} */
  }
  return { event, data };
}

export function AssistantSandbox({ config, canWrite }: AssistantSandboxProps) {
  const t = useT();
  const [locale, setLocale] = useState("fr");
  const [region, setRegion] = useState("QC");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(newSessionId());
  const messagesRef = useRef<SandboxMessage[]>([]);

  const reset = () => {
    sessionIdRef.current = newSessionId();
    messagesRef.current = [];
    setItems([]);
    setError(null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");

    messagesRef.current = [...messagesRef.current, { role: "user", content: text }];
    let botText = "";
    setItems((prev) => [...prev, { type: "user", text }, { type: "bot", text: "" }]);

    const renderBot = (t: string) => {
      setItems((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].type === "bot") {
            next[i] = { type: "bot", text: t };
            break;
          }
        }
        return next;
      });
    };

    try {
      const res = await fetch("/api/assistant/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          region,
          messages: messagesRef.current,
          configOverride: config,
          sessionId: sessionIdRef.current,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("text/event-stream")) {
        let msg = `HTTP ${res.status}`;
        try {
          const d = await res.json();
          msg = d.message || d.error || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      if (!res.body) throw new Error(t("assistant.emptyResponse"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let errorCode: string | null = null;
      let limitReached = false;
      let escalated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const { event, data } = parseSseEvent(buffer.slice(0, idx));
          buffer = buffer.slice(idx + 2);
          if (event === "delta" && typeof data.text === "string") {
            botText += data.text;
            renderBot(botText);
          } else if (event === "tool" && data.signal === "escalade") {
            escalated = true;
          } else if (event === "error") {
            errorCode = (data.code as string) || "upstream";
          } else if (event === "done" && data.limitReached) {
            limitReached = true;
          }
        }
      }

      if (errorCode) {
        messagesRef.current = messagesRef.current.slice(0, -1);
        setItems((prev) => {
          const next = prev.slice(0, -1); // bulle bot vide
          const msg = errorCode === "disabled" ? t("assistant.disabledInConfig") : t("assistant.errorWithCode", { code: errorCode });
          return [...next, { type: "info", text: msg }];
        });
      } else {
        messagesRef.current = [...messagesRef.current, { role: "assistant", content: botText }];
        const infoItems: ChatItem[] = [];
        if (escalated) infoItems.push({ type: "info", text: t("assistant.escalationTriggered") });
        if (limitReached) infoItems.push({ type: "info", text: t("assistant.sessionLimitReached") });
        if (infoItems.length) setItems((prev) => [...prev, ...infoItems]);
      }
    } catch (e) {
      setItems((prev) => (prev[prev.length - 1]?.type === "bot" && !prev[prev.length - 1]?.text ? prev.slice(0, -1) : prev));
      if (messagesRef.current[messagesRef.current.length - 1]?.role === "user") {
        messagesRef.current = messagesRef.current.slice(0, -1);
      }
      setError(e instanceof Error ? e.message : t("assistant.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">{t("assistant.languageLabel")}</label>
          <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </div>
        <div>
          <label className="label">{t("assistant.regionLabel")}</label>
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="QC">{t("assistant.regionQc")}</option>
            <option value="CA">{t("assistant.regionCanada")}</option>
          </select>
        </div>
        <button type="button" className="btn-secondary" onClick={reset}>
          {t("assistant.resetSession")}
        </button>
        {!canWrite && <span className="text-sm text-chanv-terre/40">{t("assistant.readOnlyForRole")}</span>}
      </div>

      <div className="card p-4 min-h-[240px] max-h-[420px] overflow-y-auto space-y-2">
        {items.length === 0 && <p className="text-sm text-chanv-terre/40">{t("assistant.noMessages")}</p>}
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-xl px-3 py-2 text-sm max-w-[80%] ${
              item.type === "user"
                ? "bg-chanv-terre text-chanv-blanc ml-auto"
                : item.type === "bot"
                  ? "bg-chanv-fibre text-chanv-terre"
                  : "bg-amber-50 text-amber-800 border border-amber-200 mx-auto text-center"
            }`}
          >
            {item.text || (item.type === "bot" ? "…" : "")}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="input"
          placeholder={t("assistant.testMessagePlaceholder")}
          value={input}
          disabled={!canWrite || busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="btn-primary" disabled={!canWrite || busy} onClick={() => void send()}>
          {t("assistant.send")}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
    </div>
  );
}
