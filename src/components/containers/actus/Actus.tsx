import { useEffect, useState } from "react";

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string; // <- ajouté
    username: string;
    avatar?: string;
  };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

export default function Actus() {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10); // nombre de messages à récupérer

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/news?limit=${limit}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchMessages();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [limit]);

  const loadMore = () => setLimit((prev) => prev + 10);

  return (
  <div
    style={{
      maxWidth: "700px",
      margin: "0 auto",
      padding: "1rem",
      fontFamily: "Arial, sans-serif",
    }}
  >
    <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Actualités</h2>
    <ul style={{ listStyle: "none", padding: 0 }}>
      {messages.map((msg) => (
        <li
          key={msg.id}
          style={{
            border: "1px solid #333",
            borderRadius: "12px",
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: "#111",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header : avatar + username + date */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
            <img
              src={
                msg.author.avatar
                  ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                  : "/default-avatar.png"
              }
              alt={msg.author.username}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                marginRight: "0.75rem",
                objectFit: "cover",
              }}
            />
            <strong>{msg.author.username}</strong>
            <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#aaa" }}>
              {new Date(msg.timestamp).toLocaleString()}
            </span>
          </div>

          {/* Contenu + image attachée */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <p style={{ flex: 1, whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>

            {msg.attachments.length > 0 &&
              msg.attachments.map(
                (att, i) =>
                  att.content_type?.startsWith("image/") && (
                    <img
                      key={i}
                      src={att.url}
                      alt="attachment"
                      style={{
                        width: "120px",
                        height: "120px",
                        borderRadius: "8px",
                        objectFit: "cover",
                      }}
                    />
                  )
              )}
          </div>
        </li>
      ))}
    </ul>

    {messages.length >= limit && (
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          onClick={loadMore}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "5px",
            border: "none",
            backgroundColor: "#0070f3",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Voir plus
        </button>
      </div>
    )}
  </div>
);

}
