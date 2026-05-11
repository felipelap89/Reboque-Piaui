import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wrench,
  Wallet,
  Users,
  Truck,
  Car,
  Receipt,
  HandCoins,
  BarChart3,
  Settings,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import logoUrl from "@/assets/logo-mecanica-piaui.png";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Chamados", url: "/servicos", icon: Wrench },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Motoristas", url: "/motoristas", icon: Truck },
  { title: "Veículos", url: "/veiculos", icon: Car },
  { title: "Contas", url: "/contas", icon: Landmark },
  { title: "Despesas", url: "/despesas", icon: Receipt },
  { title: "Comissões", url: "/comissoes", icon: HandCoins },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, profile, user } = useAuth();
  const navItems = isAdmin
    ? [...items.slice(0, 10), { title: "Usuários", url: "/usuarios", icon: ShieldCheck }, items[10]]
    : items;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative h-11 w-11 rounded-xl flex items-center justify-center overflow-hidden bg-background ring-1 ring-primary/40 shadow-[var(--shadow-glow)]">
            <img src={logoUrl} alt="Reboque Piauí" className="h-full w-full object-contain p-0.5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-bold tracking-tight uppercase">Mecânica <span className="text-primary">Piauí</span></span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Reboque · ERP</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Operação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 rounded-lg data-[active=true]:bg-[image:var(--gradient-primary)] data-[active=true]:text-primary-foreground data-[active=true]:shadow-[var(--shadow-glow)]"
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="rounded-lg bg-sidebar-accent/60 p-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <div className="font-medium text-foreground">{profile?.nome ?? "Usuário"}</div>
          <div className="truncate">{user?.email ?? ""}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
