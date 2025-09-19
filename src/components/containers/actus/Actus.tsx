import { useEffect, useState } from "react";

interface DiscordMessage {
  id: string;
  content: string;
  author: { username: string };
  timestamp: string;
}

export default function Actus() {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => {
        console.log(data); // Ajoute ceci pour déboguer
        setMessages(data);
      })
      .catch((err) => console.error(err));
  }, []);


  return (
    <div>
      <h2>Actualités</h2>
      <ul>
        {Array.isArray(messages) && messages.length > 0 ? (
          messages.map((msg) => (
            <li key={msg.id}>
              <strong>{msg.author.username}:</strong> {msg.content}
            </li>
          ))
        ) : (
          <li>Aucun message à afficher.</li>
        )}
      </ul>
    </div>
  );

}
