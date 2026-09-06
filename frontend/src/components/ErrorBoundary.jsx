// Boundary global para errores de React. Captura excepciones en el árbol
// de componentes y muestra una página decente en lugar de fallar en blanco.

import { Component } from "react";
import { AlertOctagon } from "lucide-react";

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error,info) {
    // Log para la consola del navegador — útil en el prototipo.
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]",error,info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error,this.reset);
      return (<div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <h1 className="display text-xl font-semibold">Algo se rompió</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Encontramos un error inesperado en esta vista. Tu información sigue guardada.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-left text-[11px] text-muted-foreground">
              {error.message}
            </pre>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={this.reset}
                className="min-h-tap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Reintentar
              </button>
              <button
                onClick={() => window.location.assign("/")}
                className="min-h-tap rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>);
    }
    return this.props.children;
  }
}
