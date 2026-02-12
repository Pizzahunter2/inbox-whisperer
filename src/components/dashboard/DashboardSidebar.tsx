import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { 
  Inbox, 
  CheckCircle, 
  Settings, 
  LogOut, 
  Trash2,
  MessageSquare,
  PenLine,
  Crown,
  Plane,
  Moon,
  Sun,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";

interface DashboardSidebarProps {
  user: User | null;
  pendingCount: number;
  completedCount: number;
  onSignOut: () => void;
  onAddEmail: () => void;
  onDeleteOld: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

function SidebarContent({ 
  user, 
  pendingCount, 
  completedCount,
  onSignOut,
  onDeleteOld,
  onLinkClick,
}: Omit<DashboardSidebarProps, 'onAddEmail' | 'mobileOpen' | 'onMobileOpenChange'> & { onLinkClick?: () => void }) {
  const location = useLocation();
  
  const navItems = [
    { icon: Inbox, label: "Action Queue", href: "/dashboard", count: pendingCount, active: location.pathname === "/dashboard" },
    { icon: CheckCircle, label: "History", href: "/history", count: completedCount, active: location.pathname === "/history" },
    { icon: MessageSquare, label: "Inbox Chat", href: "/chat", active: location.pathname === "/chat" },
    { icon: PenLine, label: "Compose", href: "/compose", active: location.pathname === "/compose" },
    { icon: Crown, label: "Pricing", href: "/pricing", active: location.pathname === "/pricing" },
    { icon: Settings, label: "Settings", href: "/settings", active: location.pathname === "/settings" },
  ];
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Glowy background dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-6 right-4 w-24 h-24 bg-sidebar-primary/15 rounded-full blur-2xl" />
        <div className="absolute bottom-32 left-2 w-32 h-32 bg-sidebar-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-16 h-16 bg-sidebar-primary/20 rounded-full blur-xl" />
      </div>

      {/* Logo */}
      <div className="p-5 pb-4 relative z-10">
        <Link to="/dashboard" className="flex items-center gap-3 group" onClick={onLinkClick}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shadow-lg shadow-sidebar-primary/20 group-hover:shadow-sidebar-primary/40 transition-shadow">
            <Plane className="w-5 h-5 text-sidebar-primary-foreground -rotate-45" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-sidebar-foreground">Inbox Pilot</span>
            <p className="text-[10px] text-sidebar-foreground/40 -mt-0.5 tracking-wider uppercase">AI Email Assistant</p>
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent relative z-10" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 relative z-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-3 mb-2">Menu</p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                onClick={onLinkClick}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  item.active 
                    ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-[18px] h-[18px] ${item.active ? "text-sidebar-primary" : ""}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center ${
                    item.active 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "bg-sidebar-accent text-sidebar-foreground/70"
                  }`}>
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* Danger zone */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-3 mb-2">Manage</p>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 px-3 text-sm font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/10 h-10"
            onClick={() => { onDeleteOld(); onLinkClick?.(); }}
          >
            <Trash2 className="w-[18px] h-[18px]" />
            Delete Old Emails
          </Button>
        </div>
      </nav>

      {/* User section */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent relative z-10" />
      <div className="p-4 relative z-10">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs mb-2"
          onClick={toggleDark}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </Button>
        <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-sidebar-accent/30">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/60 flex items-center justify-center text-sidebar-primary-foreground shadow-sm">
            <span className="text-sm font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs"
          onClick={() => { onSignOut(); onLinkClick?.(); }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function DashboardSidebar({ 
  user, 
  pendingCount, 
  completedCount,
  onSignOut,
  onAddEmail,
  onDeleteOld,
  mobileOpen,
  onMobileOpenChange,
}: DashboardSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground">
          <SidebarContent
            user={user}
            pendingCount={pendingCount}
            completedCount={completedCount}
            onSignOut={onSignOut}
            onDeleteOld={onDeleteOld}
            onLinkClick={() => onMobileOpenChange?.(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      <SidebarContent
        user={user}
        pendingCount={pendingCount}
        completedCount={completedCount}
        onSignOut={onSignOut}
        onDeleteOld={onDeleteOld}
      />
    </aside>
  );
}
