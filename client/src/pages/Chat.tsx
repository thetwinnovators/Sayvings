import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { loadData } from "@/lib/storage";
import { processMessage, getWelcomeMessage } from "@/lib/chatEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  chips?: string[];
  timestamp: Date;
}

export default function ChatPage() {
  const data = loadData();
  const welcome = getWelcomeMessage(data);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcome.content,
      chips: welcome.chips,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function sendMessage(text: string) {
    if (!text.trim() || typing) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const freshData = loadData();
      const response = await processMessage(text.trim(), freshData);
      await new Promise(r => setTimeout(r, response.delay));
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
        chips: response.chips,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  }

  function handleChip(chip: string) { sendMessage(chip); }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <Layout>
      <div className="flex flex-col max-w-2xl mx-auto" style={{ height: "calc(100dvh - 0px)" }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--divider)", background: "var(--surface-1)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-sm"
            style={{ background: "var(--teal)" }}>
            F
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight" data-testid="text-chat-title"
              style={{ color: "var(--text-primary)" }}>
              Finn
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--success-color)" }} />
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>Your Sayvings buddy</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Sparkles style={{ width: 13, height: 13, color: "var(--teal)" }} />
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Private · On-device</span>
          </div>
        </div>

        {/* ── Message Thread ── */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
          data-testid="chat-thread"
          style={{ background: "var(--surface-2)" }}>

          {messages.map((msg, i) => (
            <div key={msg.id}>
              <div
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                data-testid={`message-${msg.role}-${i}`}
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs text-white mt-0.5"
                  style={{
                    background: msg.role === "assistant" ? "var(--teal)" : "var(--text-faint)",
                    flexShrink: 0,
                  }}>
                  {msg.role === "assistant" ? "F" : "Y"}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  {msg.role === "assistant" ? (
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--divider)",
                        color: "var(--text-primary)",
                      }}>
                      {msg.content.split("\n").map((line, li) => (
                        <span key={li}>
                          {line}
                          {li < msg.content.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                      style={{ background: "var(--teal)" }}>
                      {msg.content}
                    </div>
                  )}
                  <span className="text-xs px-1" style={{ color: "var(--text-faint)" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>

              {/* Quick Reply Chips */}
              {msg.role === "assistant" && msg.chips && msg.chips.length > 0 && i === messages.length - 1 && !typing && (
                <div className="flex flex-wrap gap-2 mt-3 ml-10">
                  {msg.chips.map(chip => (
                    <button
                      key={chip}
                      data-testid={`chip-${chip.replace(/\s+/g, "-")}`}
                      onClick={() => handleChip(chip)}
                      className="text-xs rounded-full px-3 py-1.5 border transition-all"
                      style={{
                        background: "var(--surface-1)",
                        borderColor: "var(--divider)",
                        color: "var(--text-secondary)",
                      }}>
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {typing && (
            <div className="flex gap-2.5" data-testid="typing-indicator">
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs text-white"
                style={{ background: "var(--teal)" }}>
                F
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm"
                style={{ background: "var(--surface-1)", border: "1px solid var(--divider)" }}>
                <div className="flex gap-1 items-center h-4">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input Bar ── */}
        <div className="px-4 py-3 shrink-0"
          style={{
            borderTop: "1px solid var(--divider)",
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(12px)",
          }}>
          <div className="flex items-center gap-2 rounded-2xl px-3 py-1.5"
            style={{ background: "var(--surface-2)", border: "1.5px solid var(--divider)" }}>
            <Input
              ref={inputRef}
              data-testid="input-chat"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Finn anything about your money…"
              className="border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              style={{ color: "var(--text-primary)" }}
              disabled={typing}
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="shrink-0 w-8 h-8 p-0 rounded-xl"
              style={{ background: input.trim() ? "var(--teal)" : "var(--surface-3)" }}
              data-testid="button-send-chat"
            >
              <Send className="w-3.5 h-3.5" style={{ color: input.trim() ? "white" : "var(--text-faint)" }} />
            </Button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: "var(--text-faint)" }}>
            Finn knows your numbers · No AI · Stays on your device
          </p>
        </div>

      </div>
    </Layout>
  );
}
