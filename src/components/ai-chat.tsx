"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { Chat } from "@/lib/db";

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat | null;
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
}

export const AIChat: React.FC<AIChatProps> = ({
  isOpen,
  onClose,
  chat,
  onSendMessage,
  isLoading
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages, isOpen, isLoading]);

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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-canvas z-40"
          />

          {/* Chat Panel Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-surface border-l border-hairline z-40 flex flex-col"
          >
            {/* Header */}
            <div className="h-14 border-b border-hairline px-4 flex items-center justify-between bg-surface-elevated">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-accent-blue" />
                <span className="text-sm font-semibold text-on-dark tracking-tight">AI Chief of Staff</span>
                <span className="bg-accent-blue-soft text-accent-blue text-[10px] px-1.5 py-0.5 rounded font-mono">ONLINE</span>
              </div>
              <button 
                onClick={onClose}
                className="text-stone hover:text-on-dark transition-colors p-1 rounded-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {chat?.messages.map((msg) => {
                const isAssistant = msg.sender === "assistant";
                return (
                  <div 
                    key={msg.id}
                    className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed border ${
                      isAssistant 
                        ? "bg-surface-elevated border-hairline text-ink" 
                        : "bg-on-dark border-transparent text-button-fg font-medium"
                    }`}>
                      {isAssistant && (
                        <div className="flex items-center space-x-1 mb-1 text-[10px] font-mono text-mute">
                          <Sparkles className="w-3 h-3 text-accent-yellow" />
                          <span>CHIEF OF STAFF</span>
                        </div>
                      )}
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-elevated border border-hairline rounded-lg p-3 text-sm text-stone flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-mute rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-mute rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-mute rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Prompt suggestions chips */}
            {chat && chat.messages.length <= 1 && (
              <div className="px-4 py-2 flex flex-col space-y-1.5 border-t border-hairline/50">
                <span className="text-[11px] font-medium text-stone tracking-wide uppercase select-none">Suggested Queries</span>
                <div className="flex flex-col space-y-1">
                  {promptChips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptChip(chip)}
                      className="text-left text-xs bg-surface-elevated border border-hairline rounded-md px-3 py-2 text-mute hover:text-on-dark hover:border-hairline-strong transition-colors cursor-pointer"
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
              className="p-3 border-t border-hairline bg-surface-elevated flex items-center space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Chief of Staff..."
                disabled={isLoading}
                className="flex-grow bg-surface text-on-dark text-sm border border-hairline rounded-md px-3 py-2 h-9 focus:outline-none focus:border-hairline-strong placeholder-stone"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-9 w-9 bg-on-dark text-button-fg rounded-md flex items-center justify-center transition-colors hover:bg-primary-pressed disabled:bg-surface-elevated disabled:text-ash cursor-pointer flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
