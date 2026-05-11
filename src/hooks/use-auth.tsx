import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "operador" | "financeiro";

interface Profile { user_id: string; nome: string; telefone: string | null }

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setProfile(null); setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadUserData(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadUserData(uid: string) {
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("user_id, nome, telefone").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p.data as any);
    setRoles(((r.data ?? []) as any[]).map((x) => x.role));
  }

  const value: AuthCtx = {
    session, user: session?.user ?? null, profile, roles, loading,
    isAdmin: roles.includes("admin"),
    hasRole: (r) => roles.includes(r),
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
