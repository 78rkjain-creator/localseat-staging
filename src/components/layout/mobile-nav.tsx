"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  MapPin,
  CheckSquare,
  Users,
  UserCheck,
  Heart,
  Megaphone,
  MoreHorizontal,
  Settings,
  User,
  ClipboardList,
} from "lucide-react";
type Role = "candidate" | "campaign_manager" | "co_chair" | "field_organizer" | "canvasser" | "volunteer_coordinator" | "finance_lead";

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 20;

function tab(label: string, href: string, icon: React.ReactNode): Tab {
  return { label, href, icon };
}

function getTabsForRole(role: Role | string | null | undefined): Tab[] {
  switch (role) {
    case "canvasser":
      return [
        tab("Canvassing", "/canvassing", <MapPin size={ICON_SIZE} />),
        tab("Follow-ups", "/follow-ups", <CheckSquare size={ICON_SIZE} />),
        tab("Voters", "/people/residents", <Users size={ICON_SIZE} />),
        tab("Account", "/account", <User size={ICON_SIZE} />),
      ];
    case "field_organizer":
      return [
        tab("Dashboard", "/dashboard", <LayoutDashboard size={ICON_SIZE} />),
        tab("Canvassing", "/canvassing", <MapPin size={ICON_SIZE} />),
        tab("Follow-ups", "/follow-ups", <CheckSquare size={ICON_SIZE} />),
        tab("Voters", "/people/residents", <Users size={ICON_SIZE} />),
        tab("Account", "/account", <User size={ICON_SIZE} />),
      ];
    case "volunteer_coordinator":
      return [
        tab("Dashboard", "/dashboard", <LayoutDashboard size={ICON_SIZE} />),
        tab("Volunteers", "/volunteers", <UserCheck size={ICON_SIZE} />),
        tab("Follow-ups", "/follow-ups", <CheckSquare size={ICON_SIZE} />),
        tab("Voters", "/people/residents", <Users size={ICON_SIZE} />),
        tab("Account", "/account", <User size={ICON_SIZE} />),
      ];
    case "finance_lead":
      return [
        tab("Dashboard", "/dashboard", <LayoutDashboard size={ICON_SIZE} />),
        tab("Donors", "/donors", <Heart size={ICON_SIZE} />),
        tab("Voters", "/people/residents", <Users size={ICON_SIZE} />),
        tab("Account", "/account", <User size={ICON_SIZE} />),
      ];
    case "super_user":
    case "super_admin":
      return [
        tab("Dashboard", "/dashboard", <LayoutDashboard size={ICON_SIZE} />),
        tab("Campaigns", "/admin/campaigns", <Settings size={ICON_SIZE} />),
        tab("Users", "/admin/users", <Users size={ICON_SIZE} />),
        tab("Audit", "/admin/audit-log", <CheckSquare size={ICON_SIZE} />),
        tab("Account", "/account", <User size={ICON_SIZE} />),
      ];
    // candidate, campaign_manager, co_chair — use "More" sheet
    default:
      return [
        tab("Dashboard", "/dashboard", <LayoutDashboard size={ICON_SIZE} />),
        tab("Voters", "/people/residents", <Users size={ICON_SIZE} />),
        tab("Canvassing", "/canvassing", <MapPin size={ICON_SIZE} />),
        tab("Follow-ups", "/follow-ups", <CheckSquare size={ICON_SIZE} />),
      ];
  }
}

const MANAGER_MORE_LINKS: Tab[] = [
  tab("Donors", "/donors", <Heart size={ICON_SIZE} />),
  tab("Volunteers", "/volunteers", <UserCheck size={ICON_SIZE} />),
  tab("Outreach", "/outreach", <Megaphone size={ICON_SIZE} />),
  tab("Team", "/team", <Users size={ICON_SIZE} />),
  tab("Surveys", "/campaign-settings/surveys", <ClipboardList size={ICON_SIZE} />),
  tab("Settings", "/campaign-settings/ward", <Settings size={ICON_SIZE} />),
];

function useShowMore(role: Role | string | null | undefined): boolean {
  return role === "candidate" || role === "campaign_manager" || role === "data_manager" || role === "co_chair";
}

export function MobileNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const role = session?.user?.activeRole;
  const tabs = getTabsForRole(role);
  const showMore = useShowMore(role);

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-slate-200 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch h-16">
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  "flex flex-col items-center justify-center flex-1 gap-0.5 pt-1 border-t-2 transition-colors",
                  active
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-slate-400 hover:text-slate-600",
                ].join(" ")}
              >
                {t.icon}
                <span className="text-[10px] font-medium leading-none">{t.label}</span>
              </Link>
            );
          })}

          {showMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={[
                "flex flex-col items-center justify-center flex-1 gap-0.5 pt-1 border-t-2 transition-colors",
                moreOpen
                  ? "border-brand-500 text-brand-500"
                  : "border-transparent text-slate-400 hover:text-slate-600",
              ].join(" ")}
            >
              <MoreHorizontal size={ICON_SIZE} />
              <span className="text-[10px] font-medium leading-none">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More sheet */}
      {showMore && moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="fixed bottom-16 inset-x-0 z-50 md:hidden bg-white border-t border-slate-200 rounded-t-2xl shadow-xl">
            <div className="px-4 pt-4 pb-6 flex flex-col gap-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">
                More
              </p>
              {MANAGER_MORE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={[
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span className="text-slate-400">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
