"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Search, User } from "lucide-react";

import { findNavItem } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo, SidebarNav } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
          <Menu strokeWidth={1.75} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetTitle>Navigation</SheetTitle>
        <div className="flex h-14 items-center border-b px-4">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Shows the current route as a shell path: `~/ops/overview` */
function PathCrumb() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const slug = pathname === "/" ? "overview" : pathname.slice(1);
  return (
    <div className="min-w-0 truncate font-mono text-[13px]">
      <span className="text-muted-foreground">~/ops/</span>
      <span className="text-foreground">{slug}</span>
      {item ? <span className="sr-only"> — {item.title}</span> : null}
    </div>
  );
}

function SearchBox() {
  return (
    <label className="relative hidden w-64 md:block">
      <span className="sr-only">Search</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
      />
      <input
        type="search"
        placeholder="grep hosts, tickets…"
        className="h-8 w-full rounded-md border border-input bg-background/60 pr-12 pl-8 font-mono text-xs outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
        /
      </kbd>
    </label>
  );
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="grid size-8 place-items-center rounded-sm border bg-secondary font-mono text-xs font-medium outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Account"
        >
          NS
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          <div className="text-sm text-foreground">IT Admin</div>
          <div className="font-mono text-[11px]">admin@example.org</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <MobileNav />
      <PathCrumb />
      <div className="ml-auto flex items-center gap-1.5">
        <SearchBox />
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
