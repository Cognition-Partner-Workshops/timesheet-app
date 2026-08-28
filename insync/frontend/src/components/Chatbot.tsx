import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getChatMeta, sendChat } from "../api";
import { useAuth } from "../auth";
import type { ChatResponse } from "../types";

// Stash key the Create Opportunity page reads to pre-fill a brief from chat.
export const CHAT_BRIEF_KEY = "tb_opportunity_brief";

// Per-user chat history is persisted to localStorage so closing/reopening the
// panel (or reloading the page) never loses the conversation. History is keyed
// by the signed-in user so Sarah, Raj and Jenny never see each other's chats.
const CHAT_HISTORY_PREFIX = "talentbridge_chat_history_";

function historyKey(email: string | undefined | null): string | null {
  return email ? `${CHAT_HISTORY_PREFIX}${email.toLowerCase()}` : null;
}

interface Turn {
  role: "user" | "bot";
  text: string;
  data?: ChatResponse;
  brief?: string;
}

export default function Chatbot() {
  const { user } = useAuth();
  const storageKey = historyKey(user?.email);
  const [open, setOpen] = useState(false);
  const [retrievalEnabled, setRetrievalEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Restore this user's chat history whenever the signed-in user changes.
  useEffect(() => {
    if (!storageKey) {
      setTurns([]);
      setLoadedKey(null);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      setTurns(raw ? (JSON.parse(raw) as Turn[]) : []);
    } catch {
      setTurns([]);
    }
    setLoadedKey(storageKey);
  }, [storageKey]);

  // Persist on every change (only after the current user's history has loaded,
  // so we never clobber stored history with the initial empty state).
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(turns));
    } catch {
      /* storage full / unavailable — keep working in-memory */
    }
  }, [turns, storageKey, loadedKey]);

  function clearChat() {
    if (!window.confirm("Are you sure you want to clear this chat?")) return;
    setTurns([]);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }

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
      setTurns((t) => [
        ...t,
        {
          role: "bot",
          text: res.answer,
          data: res,
          brief: res.intent === "create_opportunity" ? q : undefined,
        },
      ]);
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
            <div className="chat-head-actions">
              <button
                className="btn ghost sm"
                onClick={clearChat}
                disabled={turns.length === 0}
                title="Clear this conversation"
              >
                Clear Chat
              </button>
              <button
                className="drawer-close"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                ×
              </button>
            </div>
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
                  {t.brief && (
                    <button
                      className="btn primary sm"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        sessionStorage.setItem(CHAT_BRIEF_KEY, t.brief as string);
                        setOpen(false);
                        navigate("/intake");
                      }}
                    >
                      Open in Create Opportunity →
                    </button>
                  )}
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
