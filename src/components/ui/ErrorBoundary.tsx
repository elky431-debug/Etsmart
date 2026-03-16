'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Capture les erreurs React en dessous et affiche un fallback au lieu de faire planter toute l’app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <p className="text-sm font-medium text-amber-200 mb-1">Une erreur s’est produite</p>
          <p className="text-xs text-white/60 mb-4">Tu peux réessayer ou recharger la page.</p>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-200 font-medium hover:bg-amber-500/30 transition-colors"
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
