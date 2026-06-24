"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { CommandCenter } from "@/components/command-center";
import { motion } from "framer-motion";
import { Sparkles, ShieldAlert, Zap, Terminal, Brain } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const [showAuthForm, setShowAuthForm] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-full border-2 border-hairline border-t-on-dark animate-spin"></div>
          <span className="text-xs text-stone font-mono uppercase tracking-wider">Syncing Neural Net...</span>
        </div>
      </div>
    );
  }

  // If user is authenticated, render the Command Center Dashboard
  if (user) {
    return <CommandCenter />;
  }

  // If user is not authenticated, render the Raycast-inspired marketing page
  return (
    <div className="min-h-screen bg-canvas text-body relative overflow-x-hidden font-sans">
      
      {/* Hero Diagonal Stripe Gradient */}
      <div className="hero-stripes-container opacity-25">
        <div className="hero-stripe hero-stripe-1"></div>
        <div className="hero-stripe hero-stripe-2"></div>
        <div className="hero-stripe hero-stripe-3"></div>
      </div>

      {/* Primary Nav */}
      <header className="h-14 border-b border-hairline bg-canvas/40 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 md:px-12 max-w-[1440px] mx-auto">
        <div className="flex items-center space-x-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Second Brain Logo" className="w-6 h-6 object-contain rounded-sm" />
          <span className="text-sm font-semibold tracking-tight text-on-dark">Second Brain</span>
        </div>
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => setShowAuthForm(true)}
            className="text-xs font-semibold text-mute hover:text-on-dark transition-colors cursor-pointer"
          >
            Access Console
          </button>
          <button 
            onClick={() => setShowAuthForm(true)}
            className="h-8 px-4 bg-on-dark text-button-fg rounded-md text-xs font-semibold hover:bg-primary-pressed transition-colors cursor-pointer flex items-center"
          >
            Launch Client
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-[1240px] mx-auto px-6 pt-16 pb-12 text-center space-y-6 relative z-10">
        
        {/* New feature badge */}
        <div className="inline-flex items-center space-x-2 bg-accent-blue-soft border border-accent-blue/15 px-3 py-1 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-accent-blue" />
          <span className="text-[10px] font-bold text-accent-blue uppercase tracking-wider font-mono">Gemini-Powered Chief of Staff</span>
        </div>

        {/* Display Headline */}
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ink font-display-xl max-w-3xl mx-auto leading-none">
          The AI Chief of Staff that predicts failure.
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-lg text-mute max-w-xl mx-auto leading-relaxed">
          Second Brain is not a task list. It autonomously decomposes goals, prioritizes schedules, calculates deadline failure risks, and uses cognitive coaching to combat procrastination.
        </p>

        {/* Action button */}
        <div className="flex justify-center">
          <button 
            onClick={() => setShowAuthForm(true)}
            className="h-10 px-6 bg-on-dark text-button-fg rounded-md text-sm font-semibold hover:bg-primary-pressed transition-all hover:scale-[1.01] duration-150 cursor-pointer flex items-center shadow-xl shadow-on-dark/5"
          >
            Initialize Second Brain
          </button>
        </div>

        {/* Keycap shortcuts hint */}
        <div className="text-[11px] text-stone flex items-center justify-center space-x-1.5 pt-1 select-none">
          <span>Or press</span>
          <span className="keycap-item">⌘</span>
          <span className="keycap-item">K</span>
          <span>to inspect commands</span>
        </div>
      </section>

      {/* Interactive Mock Command Palette Hero Illustration */}
      <section className="max-w-[860px] mx-auto px-6 pb-20 relative z-10">
        {showAuthForm ? (
          <AuthModal />
        ) : (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            onClick={() => setShowAuthForm(true)}
            className="w-full bg-surface border border-hairline rounded-lg overflow-hidden flex flex-col shadow-2xl cursor-pointer hover:border-hairline-strong transition-all duration-200"
          >
            {/* Window control header */}
            <div className="flex items-center px-4 border-b border-hairline h-11 bg-surface-elevated">
              <div className="flex space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-red/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-accent-yellow/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-accent-green/20" />
              </div>
              <div className="mx-auto text-[11px] text-stone font-mono">Operator Dashboard Emulator</div>
              <span className="keycap-item">⏎ Enter</span>
            </div>

            {/* Simulated Command Palette rows */}
            <div className="p-3 space-y-1.5 bg-surface text-left">
              <div className="px-3 py-1 text-[10px] font-semibold text-stone uppercase tracking-wider font-mono">Suggested AI Operations</div>
              
              <div className="flex items-center justify-between px-3 py-2 bg-surface-card border border-hairline rounded text-sm text-on-dark font-medium">
                <div className="flex items-center space-x-3">
                  <Terminal className="w-4 h-4 text-accent-green" />
                  <span>Decompose Goal /add &ldquo;Design Presentation Slides&rdquo;</span>
                </div>
                <span className="keycap-item">⏎ Execute</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-sm text-mute">
                <div className="flex items-center space-x-3">
                  <Brain className="w-4 h-4 text-accent-yellow" />
                  <span>Prioritize Schedule via Urgency Risk metrics</span>
                </div>
                <span className="text-xs text-stone">⌘P</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-sm text-mute">
                <div className="flex items-center space-x-3">
                  <ShieldAlert className="w-4 h-4 text-accent-red" />
                  <span>Trigger Emergency Rescue Mode (Deallocate non-essentials)</span>
                </div>
                <span className="text-xs text-stone">⌘R</span>
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Feature tiles grid 3-up */}
      <section className="max-w-[1240px] mx-auto px-6 pb-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-surface border border-hairline rounded-lg p-6 space-y-3">
            <div className="p-2 bg-surface-elevated rounded border border-hairline w-fit">
              <Brain className="w-5 h-5 text-accent-yellow" />
            </div>
            <h3 className="text-base font-semibold text-on-dark">1. Predictive Failure Score</h3>
            <p className="text-xs text-mute leading-relaxed">
              Every task is evaluated in real-time. The Risk Agent projects failure probability based on context, complexity, and historical delay velocities.
            </p>
          </div>

          <div className="bg-surface border border-hairline rounded-lg p-6 space-y-3">
            <div className="p-2 bg-surface-elevated rounded border border-hairline w-fit">
              <ShieldAlert className="w-5 h-5 text-accent-red" />
            </div>
            <h3 className="text-base font-semibold text-on-dark">2. Emergency Rescue Path</h3>
            <p className="text-xs text-mute leading-relaxed">
              If deadline risk exceeds tolerances, Rescue Mode recalculates an optimized path, deallocating low-priority tasks to maximize completion momentum.
            </p>
          </div>

          <div className="bg-surface border border-hairline rounded-lg p-6 space-y-3">
            <div className="p-2 bg-surface-elevated rounded border border-hairline w-fit">
              <Zap className="w-5 h-5 text-accent-green" />
            </div>
            <h3 className="text-base font-semibold text-on-dark">3. Reality Check Engine</h3>
            <p className="text-xs text-mute leading-relaxed">
              No generic motivational jargon or therapeutic advice. Delivers concise observations exposing procrastination contradictions directly inside the console.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline py-8 text-center text-xs text-stone relative z-10">
        <p>&copy; {new Date().getFullYear()} Second Brain &mdash; Staff-level Hackathon Submission.</p>
        <p className="mt-1 opacity-75">Built with Google Gemini, Next.js 15, TypeScript and Tailwind.</p>
      </footer>

    </div>
  );
}
