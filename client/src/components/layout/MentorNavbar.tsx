import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

const navItems = [
  { label: "Home", href: "/chat" },
  { label: "Find a Mentor", href: "/chat" },
  { label: "My Sessions", href: "/chat" },
  { label: "Profile", href: "/chat" },
];

export function MentorNavbar() {
  const [open, setOpen] = useState(false);

  const NavLinks = ({ className }: { className?: string }) => (
    <nav className={cn("flex items-center gap-6 text-sm font-medium", className)}>
      {navItems.map((item) => (
        <Link key={item.label} href={item.href}>
          <a className="text-muted-foreground hover:text-foreground transition-colors">
            {item.label}
          </a>
        </Link>
      ))}
    </nav>
  );

  return (
    <header className="bg-card shadow-sm border-b border-border/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-semibold">
            MM
          </div>
          <div>
            <p className="text-lg font-semibold leading-none">MentorMind</p>
            <p className="text-xs text-muted-foreground">Alumni–Student Mentorship Hub</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <NavLinks />
          <Separator orientation="vertical" className="h-6" />
          <Button variant="secondary" className="rounded-full">Start new mentorship</Button>
        </div>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-6 space-y-6">
                <div>
                  <p className="font-semibold">MentorMind</p>
                  <p className="text-sm text-muted-foreground">Alumni–Student Mentorship Hub</p>
                </div>
                <div className="flex flex-col gap-4">
                  {navItems.map((item) => (
                    <Link key={item.label} href={item.href}>
                      <a
                        className="text-base text-foreground hover:text-primary transition-colors"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </a>
                    </Link>
                  ))}
                </div>
                <Button className="w-full" onClick={() => setOpen(false)}>
                  Start new mentorship
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
