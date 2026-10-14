import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api";
import type { AppNotification } from "../types";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getNotifications()
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unread);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link_type === "proposal" && n.link_id) {
      navigate(`/work?proposal=${encodeURIComponent(n.link_id)}`);
    } else if (n.link_type === "opportunity" && n.link_id) {
      navigate(`/work?opportunity=${encodeURIComponent(n.link_id)}`);
    } else {
      navigate("/work");
    }
    load();
  }

  async function markAll() {
    await markAllNotificationsRead().catch(() => {});
    load();
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="theme-toggle"
        style={{ position: "relative" }}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications (${unread} unread)`}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--coral)",
              color: "#fff",
              borderRadius: 10,
              fontSize: 10,
              minWidth: 16,
              height: 16,
              lineHeight: "16px",
              textAlign: "center",
              padding: "0 4px",
              fontWeight: 700,
            }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="user-dropdown card" style={{ width: 320, maxHeight: 420, overflowY: "auto" }}>
          <div className="spread" style={{ marginBottom: 6 }}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="btn ghost sm" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="divider" />
          {items.length === 0 && <div className="faint" style={{ padding: "8px 0" }}>No notifications.</div>}
          {items.map((n) => (
            <button
              key={n.id}
              className="nav-link"
              style={{
                display: "block",
                textAlign: "left",
                width: "100%",
                marginBottom: 4,
                opacity: n.is_read ? 0.6 : 1,
                borderLeft: n.is_read ? "none" : "3px solid var(--coral)",
                paddingLeft: n.is_read ? 12 : 9,
              }}
              onClick={() => handleClick(n)}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
              {n.body && <div className="faint" style={{ fontSize: 12, whiteSpace: "normal" }}>{n.body}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
