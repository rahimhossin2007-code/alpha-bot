import { Link, useLocation } from "wouter";
import { Activity, Users, Cookie, Terminal, FileText, Menu, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/admins", label: "Bot Admin System", icon: Users },
  { href: "/cookie", label: "Cookie Management", icon: Cookie },
  { href: "/commands", label: "Commands", icon: Terminal },
  { href: "/logs", label: "Console Logs", icon: FileText },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const NavLinks = () => (
    <div className="flex flex-col gap-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start ${isActive ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground font-mono">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Bot className="h-6 w-6 text-primary mr-3" />
          <h1 className="font-bold text-lg tracking-wider text-primary drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">ALPHA BOT</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavLinks />
        </nav>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center">
            <Bot className="h-6 w-6 text-primary mr-2" />
            <span className="font-bold tracking-wider text-primary">ALPHA BOT</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-background border-r-primary/20">
              <div className="flex items-center mb-8 mt-4">
                <Bot className="h-6 w-6 text-primary mr-3" />
                <h1 className="font-bold text-lg tracking-wider text-primary">ALPHA BOT</h1>
              </div>
              <NavLinks />
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gradient-to-br from-background to-card/20">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}