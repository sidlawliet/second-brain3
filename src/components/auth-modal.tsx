"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const AuthModal: React.FC = () => {
  const { login, signup, loginWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setError((err as Error).message || "Google Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      // Guest mode bypasses Firebase — writes directly to localStorage
      const guestProfile = {
        uid: `guest_${crypto.randomUUID?.().slice(0, 8) || Date.now().toString(36)}`,
        email: "guest@secondbrain.local",
        displayName: "Guest Operator",
      };
      localStorage.setItem("sb_user", JSON.stringify(guestProfile));
      window.location.reload();
    } catch {
      setError("Failed to enter guest mode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 z-10 relative">
      <div className="w-full max-w-[400px] bg-surface border border-hairline rounded-lg p-6 flex flex-col space-y-6">
        
        {/* Header */}
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-medium text-ink font-display-xl tracking-tight">
            {isSignUp ? "Create your Second Brain" : "Initialize Chief of Staff"}
          </h2>
          <p className="text-sm text-mute">
            {isSignUp 
              ? "Establish your automated executive agent." 
              : "Enter your credentials or initialize in guest mode."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-medium text-mute" htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chief Executive"
                required
                className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong placeholder-stone"
              />
            </div>
          )}

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-mute" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@secondbrain.ai"
              required
              className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong placeholder-stone"
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-mute" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-9 bg-surface-elevated text-on-dark border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-hairline-strong placeholder-stone"
            />
          </div>

          {error && (
            <p className="text-xs text-accent-red bg-accent-red-soft border border-accent-red/20 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-on-dark text-button-fg rounded-md text-sm font-medium transition-colors hover:bg-primary-pressed duration-150 flex items-center justify-center cursor-pointer"
          >
            {loading ? "Initializing..." : isSignUp ? "Create Agent" : "Authenticate"}
          </button>
        </form>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-9 bg-white hover:bg-stone-100 text-black rounded-md text-sm font-medium transition-colors duration-150 flex items-center justify-center cursor-pointer gap-2 border border-hairline"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="flex items-center justify-between text-xs text-stone">
          <div className="h-[1px] bg-hairline flex-grow mr-2"></div>
          <span>OR</span>
          <div className="h-[1px] bg-hairline flex-grow ml-2"></div>
        </div>

        {/* Guest Auth */}
        <button
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full h-9 bg-surface-elevated border border-hairline text-on-dark rounded-md text-sm font-medium transition-colors hover:bg-surface-card hover:border-hairline-strong duration-150 flex items-center justify-center cursor-pointer"
        >
          Initialize Guest Mode (Offline Mock)
        </button>

        {/* Toggle link */}
        <div className="text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-mute hover:text-on-dark transition-colors"
          >
            {isSignUp ? "Already configured? Sign in" : "New operator? Initialize agent here"}
          </button>
        </div>

      </div>
    </div>
  );
};
