"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";

import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <span className="grid size-7 place-items-center rounded-sm border border-primary/40 bg-primary/10 font-mono text-[13px] font-semibold text-primary">
        &gt;_
      </span>
      <span className="font-mono text-[15px] font-semibold tracking-tight">
        itdash<span className="text-primary animate-blink">_</span>
      </span>
    </Link>
  );
}

/** Navigation list — shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 font-mono text-[11px] text-muted-foreground/80">
            <span className="text-primary/70">{"//"}</span> {group.label}
          </p>
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-8 items-center gap-2.5 rounded-sm px-3 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                      active && "bg-sidebar-accent text-foreground",
                    )}
                  >
                    {/* active rail */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon
                      className={cn("size-4 shrink-0", active && "text-primary")}
                      strokeWidth={1.75}
                    />
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          "min-w-5 rounded-sm px-1 text-center font-mono text-[10.5px] leading-5",
                          item.badgeTone === "alert"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border p-3">
      <a
        href="mailto:helpdesk@example.org"
        className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      >
        <LifeBuoy className="size-4" strokeWidth={1.75} />
        Help desk
      </a>
      <div className="mt-2 px-3 font-mono text-[10.5px] leading-relaxed text-muted-foreground/70">
        v0.1.0 · build local
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <SidebarNav />
      </div>
      <SidebarFooter />
    </aside>
  );
}
