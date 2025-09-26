import { useEffect, useState } from "react";

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

function ChannelFeed({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/channel/${channelId}?limit=${limit}`);
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
  }, [limit, channelId]);

  const loadMore = () => setLimit((prev) => prev + 10);

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "1rem" }}>
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
            {/* Header */}
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

            {/* Content */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <p style={{ flex: 1, whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>
              {msg.attachments.map(
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

export default function Actus() {
  const [activeTab, setActiveTab] = useState<"news" | "expos">("news");

  const channels = {
    news: process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID as string,
    expos: process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID as string,
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Actualités & Expositions</h2>

      {/* Onglets */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
        {(["news", "expos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.5rem 1rem",
              margin: "0 0.5rem",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === tab ? "#0070f3" : "#333",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {tab === "news" ? "News" : "Expos"}
          </button>
        ))}
      </div>

      {/* Feed */}
      <ChannelFeed channelId={channels[activeTab]} />
    </div>
  );
}
