import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Navbar() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="container px-4">
        <nav className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-primary-foreground">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Mail className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-semibold text-lg">Inbox Middleman</span>
          </Link>
          
          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
