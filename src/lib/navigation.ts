import {
  Activity,
  Archive,
  BadgeCheck,
  Boxes,
  GitPullRequestArrow,
  LayoutGrid,
  Network,
  Server,
  Settings,
  ShieldHalf,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** small counter shown at the right of the item */
  badge?: number;
  /** "alert" makes the badge red, for things that need attention */
  badgeTone?: "default" | "alert";
};

export type NavGroup = {
  /** rendered as a code-comment style heading, e.g. `// monitor` */
  label: string;
  items: NavItem[];
};

/**
 * Single source of truth for the sidebar.
 * Add a page: create `src/app/(dashboard)/<slug>/page.tsx` and add an entry here.
 */
export const navigation: NavGroup[] = [
  {
    label: "monitor",
    items: [
      { title: "Overview", href: "/", icon: LayoutGrid },
      { title: "Network", href: "/network", icon: Network },
      { title: "Servers", href: "/servers", icon: Server },
      { title: "Services", href: "/services", icon: Activity },
    ],
  },
  {
    label: "service desk",
    items: [
      { title: "Tickets", href: "/tickets", icon: Ticket, badge: 14 },
      { title: "Assets", href: "/assets", icon: Boxes },
      { title: "Changes", href: "/changes", icon: GitPullRequestArrow, badge: 3 },
    ],
  },
  {
    label: "protect",
    items: [
      { title: "Backups", href: "/backups", icon: Archive, badge: 1, badgeTone: "alert" },
      { title: "Security", href: "/security", icon: ShieldHalf },
      { title: "Licenses", href: "/licenses", icon: BadgeCheck },
    ],
  },
  {
    label: "admin",
    items: [
      { title: "Users", href: "/users", icon: Users },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const allNavItems = navigation.flatMap((g) => g.items);

export function findNavItem(pathname: string) {
  return allNavItems.find((i) => i.href === pathname);
}
