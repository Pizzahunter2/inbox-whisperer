import { Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Mail className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-semibold text-lg">Inbox Middleman</span>
          </Link>
          
          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-primary-foreground/70">
            <Link to="/login" className="hover:text-primary-foreground transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="hover:text-primary-foreground transition-colors">
              Sign Up
            </Link>
          </nav>
          
          {/* Copyright */}
          <p className="text-sm text-primary-foreground/50">
            © {new Date().getFullYear()} Inbox Middleman
          </p>
        </div>
      </div>
    </footer>
  );
}
