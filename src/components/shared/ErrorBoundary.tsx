'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>
      if (w.Sentry) {
        const sentry = w.Sentry as { captureException: (e: Error, ctx?: unknown) => void }
        sentry.captureException(error, {
          extra: { componentStack: errorInfo.componentStack },
        })
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] py-16 px-6 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-5">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>

          <h3 className="text-lg font-semibold text-white mb-2">
            Une erreur est survenue
          </h3>
          <p className="text-sm text-white/50 max-w-sm mb-2">
            Quelque chose s&apos;est mal passe. Veuillez reessayer.
          </p>

          {this.state.error && (
            <p className="text-xs text-white/30 font-mono max-w-md mb-6 break-all">
              {this.state.error.message}
            </p>
          )}

          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Reessayer
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
