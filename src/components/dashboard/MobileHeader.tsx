import { Mail, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface MobileHeaderProps {
  title: string;
  onOpenSidebar: () => void;
}

export function MobileHeader({ title, onOpenSidebar }: MobileHeaderProps) {
  return (
    <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
      <Button variant="ghost" size="icon" onClick={onOpenSidebar} className="flex-shrink-0">
        <Menu className="w-5 h-5" />
      </Button>
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Mail className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-semibold text-sm">Inbox Pilot</span>
      </Link>
      <span className="text-sm text-muted-foreground ml-auto">{title}</span>
    </div>
  );
}
