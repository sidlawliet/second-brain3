"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { Chat } from "@/lib/db";

interface AIChatSidebarProps {
  chat: Chat | null;
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
}

export const AIChatSidebar: React.FC<AIChatSidebarProps> = ({
  chat,
  onSendMessage,
  isLoading
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await onSendMessage(text);
  };

  const handlePromptChip = async (prompt: string) => {
    if (isLoading) return;
    await onSendMessage(prompt);
  };

  const promptChips = [
    "What should I work on now?",
    "Can I finish everything this week?",
    "Why is my project at risk?"
  ];

  return (
    <div className="flex flex-col h-full w-full bg-surface border border-hairline rounded-lg overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-hairline px-4 flex items-center justify-between bg-surface-elevated">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-accent-blue" />
          <span className="text-xs font-semibold text-on-dark tracking-tight uppercase">AI Chief of Staff</span>
        </div>
        <span className="bg-accent-blue-soft text-accent-blue text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold tracking-wider">Active</span>
      </div>

      {/* Chat History */}
      <div className="flex-grow overflow-y-auto p-4 space-y-3.5 custom-scrollbar min-h-0">
        {chat ? (
          chat.messages.map((msg) => {
            const isAssistant = msg.sender === "assistant";
            return (
              <div 
                key={msg.id}
                className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[90%] rounded-lg p-2.5 text-xs leading-relaxed border ${
                  isAssistant 
                    ? "bg-surface-elevated border-hairline text-ink" 
                    : "bg-on-dark border-transparent text-button-fg font-medium"
                }`}>
                  {isAssistant && (
                    <div className="flex items-center space-x-1 mb-1 text-[9px] font-mono text-mute">
                      <Sparkles className="w-2.5 h-2.5 text-accent-yellow" />
                      <span>CHIEF OF STAFF</span>
                    </div>
                  )}
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-lg p-2.5 text-xs leading-relaxed border bg-surface-elevated border-hairline text-ink">
              <div className="flex items-center space-x-1 mb-1 text-[9px] font-mono text-mute">
                <Sparkles className="w-2.5 h-2.5 text-accent-yellow" />
                <span>CHIEF OF STAFF</span>
              </div>
              <p className="whitespace-pre-line">
                I am your AI Chief of Staff. I track task risks, prioritize schedules, and keep you accountable. What are we shipping today?
              </p>
            </div>
          </div>
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-elevated border border-hairline rounded-lg p-2.5 text-xs text-stone flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-mute rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-mute rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-mute rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Prompt suggestions chips */}
      {(!chat || chat.messages.length <= 1) && (
        <div className="px-3.5 py-2 flex flex-col space-y-1.5 border-t border-hairline/50">
          <span className="text-[9px] font-semibold text-stone tracking-wide uppercase select-none font-mono">Suggested Queries</span>
          <div className="flex flex-col space-y-1">
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handlePromptChip(chip)}
                className="text-left text-[11px] bg-surface-elevated border border-hairline rounded px-2.5 py-1.5 text-mute hover:text-on-dark hover:border-hairline-strong transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form 
        onSubmit={handleSend}
        className="p-2.5 border-t border-hairline bg-surface-elevated flex items-center space-x-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Chief of Staff..."
          disabled={isLoading}
          className="flex-grow bg-surface text-on-dark text-xs border border-hairline rounded px-2.5 py-1.5 h-8 focus:outline-none focus:border-hairline-strong placeholder-stone"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="h-8 w-8 bg-on-dark text-button-fg rounded flex items-center justify-center transition-colors hover:bg-primary-pressed disabled:bg-surface-elevated disabled:text-ash cursor-pointer flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
