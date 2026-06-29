import { useEffect, useRef, useState } from "react";
import { getChatMeta, sendChat } from "../api";
import type { ChatResponse } from "../types";

interface Turn {
  role: "user" | "bot";
  text: string;
  data?: ChatResponse;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [retrievalEnabled, setRetrievalEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || suggestions.length) return;
    getChatMeta()
      .then((m) => {
        setRetrievalEnabled(m.retrieval_enabled);
        setSuggestions(m.suggestions);
      })
      .catch(() => undefined);
  }, [open, suggestions.length]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await sendChat(q);
      setTurns((t) => [...t, { role: "bot", text: res.answer, data: res }]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: "bot", text: "Something went wrong reaching the assistant. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open assistant"
      >
        {open ? "×" : "💬"}
      </button>

      {open && (
        <div className="chat-panel card">
          <div className="chat-head">
            <div>
              <strong>TalentBridge Assistant</strong>
              <div className="faint chat-mode">
                {retrievalEnabled ? "pgvector retrieval" : "fallback mode"}
              </div>
            </div>
            <button className="drawer-close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {turns.length === 0 && (
              <div className="chat-empty">
                <p className="muted">
                  Ask about candidates, skills, roles, opportunities or approvals.
                  Answers are grounded in retrieved evidence.
                </p>
                <div className="chat-suggestions">
                  {suggestions.map((s) => (
                    <button key={s} className="chat-suggest" onClick={() => ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={`chat-turn ${t.role}`}>
                <div className="chat-bubble">
                  {t.text.split("\n").map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                  {t.data && t.data.sources.length > 0 && (
                    <details className="chat-sources">
                      <summary>
                        Evidence · {t.data.sources.length}{" "}
                        {t.data.used_ai ? "· AI explained" : "· deterministic"}
                      </summary>
                      {t.data.sources.map((s) => (
                        <div key={s.document_key} className="chat-source">
                          <span className="tag">{s.source_type}</span>{" "}
                          <span className="faint">score {s.score.toFixed(2)}</span>
                          <div className="muted">{s.snippet}</div>
                        </div>
                      ))}
                    </details>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="chat-turn bot"><div className="chat-bubble">…</div></div>}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the assistant…"
            />
            <button className="btn primary sm" type="submit" disabled={busy}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
