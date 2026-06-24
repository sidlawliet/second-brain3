"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

// ponytail: minimal error boundary, one file, no framework — use the platform
// upgrade: add error reporting service when there's a backend to log to
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="border border-accent-red/20 bg-accent-red-soft rounded-lg p-4">
            <p className="text-xs text-accent-red font-medium">
              Something went wrong — but the system is still running. Continue your workflow.
            </p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
