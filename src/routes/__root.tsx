import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { Search, LogOut, Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Voltar ao início</Link>
      </div>
    </div>
  );
}

function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Tentar novamente</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Reboque Piauí — Painel Administrativo" },
      { name: "description", content: "Gestão de serviços de guincho, mecânica, financeiro, frota e equipe." },
      { name: "theme-color", content: "#0b1220" },
      { property: "og:title", content: "Reboque Piauí — Painel Administrativo" },
      { name: "twitter:title", content: "Reboque Piauí — Painel Administrativo" },
      { property: "og:description", content: "Gestão de serviços de guincho, mecânica, financeiro, frota e equipe." },
      { name: "twitter:description", content: "Gestão de serviços de guincho, mecânica, financeiro, frota e equipe." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/9AVzJiVvoshkYja0lgA3ZRR558T2/social-images/social-1778242655707-Login.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/9AVzJiVvoshkYja0lgA3ZRR558T2/social-images/social-1778242655707-Login.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body className="dark">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
        <Toaster richColors theme="dark" position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { session, loading, profile, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      </div>
    );
  }

  // Public route: login page renders standalone (no shell)
  if (path === "/login") return <Outlet />;

  if (!session) {
    return <UnauthenticatedRedirect />;
  }

  const initial = (profile?.nome ?? "U").charAt(0).toUpperCase();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="-ml-1" />
            <div className="relative hidden md:block w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar serviço, cliente, motorista…" className="h-9 pl-8 bg-card border-border" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <div className="hidden sm:flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-1.5">
                <div className="h-7 w-7 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center text-xs font-bold text-primary-foreground">{initial}</div>
                <div className="leading-tight">
                  <div className="text-xs font-medium">{profile?.nome ?? "Usuário"}</div>
                  <div className="text-[10px] text-muted-foreground">Online</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function UnauthenticatedRedirect() {
  const router = useRouter();
  if (typeof window !== "undefined") {
    router.navigate({ to: "/login" });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}
