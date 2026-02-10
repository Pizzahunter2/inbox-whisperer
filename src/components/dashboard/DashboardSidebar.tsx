import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  Inbox, 
  CheckCircle, 
  Settings, 
  LogOut, 
  Plus,
  Clock,
  Trash2,
  MessageSquare,
  PenLine
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface DashboardSidebarProps {
  user: User | null;
  pendingCount: number;
  completedCount: number;
  onSignOut: () => void;
  onAddEmail: () => void;
  onDeleteOld: () => void;
}

export function DashboardSidebar({ 
  user, 
  pendingCount, 
  completedCount,
  onSignOut,
  onAddEmail,
  onDeleteOld
}: DashboardSidebarProps) {
  const location = useLocation();
  
  const navItems = [
    { 
      icon: Inbox, 
      label: "Action Queue", 
      href: "/dashboard", 
      count: pendingCount,
      active: location.pathname === "/dashboard" 
    },
    { 
      icon: CheckCircle, 
      label: "History", 
      href: "/history", 
      count: completedCount,
      active: location.pathname === "/history" 
    },
    {
      icon: MessageSquare,
      label: "Inbox Chat",
      href: "/chat",
      active: location.pathname === "/chat"
    },
    {
      icon: PenLine,
      label: "Compose",
      href: "/compose",
      active: location.pathname === "/compose"
    },
    { 
      icon: Settings, 
      label: "Settings", 
      href: "/settings",
      active: location.pathname === "/settings" 
    },
  ];

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Mail className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Inbox Pilot</span>
        </Link>
      </div>

      {/* Actions */}
      <div className="p-4">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={onDeleteOld}
        >
          <Trash2 className="w-4 h-4" />
          Delete Old Emails
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                  item.active 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>

      </div>
    </aside>
  );
}
