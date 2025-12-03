import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Find a Mentor", href: "/find-mentor" },
  { label: "My Sessions", href: "/my-sessions" },
  { label: "Profile", href: "/profile" },
];

export function MentorNavbar() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  const handleClose = () => setOpen(false);

  return (
    <header className="bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border/70 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 grid grid-cols-3 items-center">
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                className="relative rounded-xl border border-border/70 bg-card/60 shadow-sm transition-all duration-200 hover:border-primary/60 hover:bg-primary/10"
              >
                <Menu
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    open ? "rotate-45 opacity-0" : "rotate-0 opacity-100"
                  )}
                />
                <X
                  className={cn(
                    "absolute h-5 w-5 transition-all duration-200",
                    open ? "rotate-0 opacity-100" : "-rotate-45 opacity-0"
                  )}
                />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[320px] sm:max-w-[360px] rounded-none rounded-r-3xl border border-border/60 bg-slate-900/95 text-slate-50 shadow-2xl data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <div className="space-y-6 pt-4">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-800/60 px-4 py-3 ring-1 ring-white/5">
                  <Avatar className="h-11 w-11 border border-white/10 shadow-sm">
                    <AvatarImage src="" alt="Student avatar" />
                    <AvatarFallback className="bg-primary/80 text-primary-foreground">
                      MM
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-100">Student – @dxb.avg</p>
                    <p className="text-xs text-slate-400">Alumni–Student mentorship track</p>
                  </div>
                </div>

                <Separator className="bg-white/20 h-[3px] rounded-full" />

                <nav className="space-y-2" aria-label="Primary">
                  {navItems.map((item) => {
                    const isActive = location === item.href;

                    return (
                      <Link key={item.label} href={item.href}>
                        <a
                          className={cn(
                            "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                            "hover:bg-white/10 hover:text-white",
                            isActive
                              ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                              : "text-slate-200"
                          )}
                          onClick={handleClose}
                        >
                          <span>{item.label}</span>
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full transition-all duration-200",
                              isActive ? "bg-primary" : "bg-white/20"
                            )}
                          />
                        </a>
                      </Link>
                    );
                  })}
                </nav>

                <Separator className="bg-white/20 h-[3px] rounded-full" />

                <Link href="/find-mentor">
                  <Button
                    className="w-full rounded-2xl bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90"
                    onClick={handleClose}
                  >
                    Start New Mentorship
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-semibold">
            MM
          </div>
          <div className="hidden sm:block text-center">
            <p className="text-lg font-semibold leading-none">MentorMind</p>
            <p className="text-xs text-muted-foreground">Alumni–Student Mentorship Hub</p>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Avatar className="h-9 w-9 border border-border/70 shadow-sm">
            <AvatarImage src="" alt="Your profile" />
            <AvatarFallback className="bg-muted text-foreground">UA</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
