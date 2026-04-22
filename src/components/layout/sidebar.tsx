"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@/types";
import {
  canViewAllPeople,
  canViewDonors,
  canCanvass,
  canViewVolunteers,
} from "@/lib/permissions";
import { CampaignSwitcher } from "@/components/layout/campaign-switcher";

// Voter list is visible to roles that can view all people
function canViewVoterList(role: Role): boolean {
  return canViewAllPeople(role);
}

interface SidebarProps {
  firstName: string;
  lastName: string;
  role: Role | null;
  campaignName: string | null;
  campaignCount?: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function NavLink({
  href,
  label,
  icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
        active
          ? "rounded-r-xl bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500"
          : "rounded-xl font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      <span className="h-5 w-5 flex-shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

export function Sidebar({ firstName, lastName, role, campaignName, campaignCount = 1 }: SidebarProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    if (accountOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountOpen]);

  // Fixed admin sub-items — role visibility is checked at page level.
  // Only shown to: candidate, campaign_manager, co_chair, field_organizer.
  const adminItems: NavItem[] = [
    {
      href: "/team",
      label: "Team",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      href: "/address-changes",
      label: "Address Changes",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: "/campaign-settings/ward",
      label: "Ward Boundary",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      href: "/campaign-settings/competitors",
      label: "Competitors",
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        </svg>
      ),
    },
  ];

  const showAdmin =
    role === "candidate" ||
    role === "campaign_manager" ||
    role === "co_chair" ||
    role === "field_organizer";

  // Nav items grouped for visual section dividers.
  // Groups: [Overview] [People & Field] [Operations]
  const navGroups: NavItem[][] = [
    // Group 1 — Overview
    [
      {
        href: "/dashboard",
        label: "Today",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
    // Group 2 — People & Field
    [
      ...(role && canViewAllPeople(role)
        ? [
            {
              href: "/voter-list",
              label: "Voter List",
              icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
          ]
        : []),
      ...(role && canViewVoterList(role)
        ? [
            {
              href: "/voter-import",
              label: "Import & Data Management",
              icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />
                </svg>
              ),
            },
          ]
        : []),
      ...(role && canCanvass(role)
        ? [
            {
              href: "/canvassing",
              label: "Canvassing",
              icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              ),
            },
          ]
        : []),
      {
        href: "/follow-ups",
        label: "Follow-ups",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        href: "/outreach",
        label: "Outreach",
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ),
      },
    ],
    // Group 3 — Operations
    [
      ...(role && canViewDonors(role) && role !== "field_organizer"
        ? [
            {
              href: "/donors",
              label: "Donors",
              icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ]
        : []),
      ...(role && canViewVolunteers(role)
        ? [
            {
              href: "/volunteers/schedule",
              label: "Volunteers",
              icon: (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
          ]
        : []),
    ],
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 h-full bg-white border-r border-slate-100 px-3 py-5 overflow-hidden flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 mb-6">
        <div className="h-8 w-8 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
          <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm">LocalSeat</p>
          {campaignName && (
            <CampaignSwitcher campaignName={campaignName} campaignCount={campaignCount} />
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
        {navGroups.filter((g) => g.length > 0).flatMap((group, gi) => [
          ...(gi > 0 ? [<div key={`divider-${gi}`} className="h-px bg-slate-100 my-1" />] : []),
          ...group.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          )),
        ])}

        {/* Admin collapsible section */}
        {showAdmin && (
          <>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              onClick={() => setAdminOpen((v) => !v)}
              className="flex items-center justify-between px-3 py-2.5 w-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 flex-shrink-0">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                Admin
              </span>
              <svg
                className={["h-4 w-4 text-slate-400 flex-shrink-0 transition-transform duration-200", adminOpen ? "rotate-180" : ""].join(" ")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {adminOpen && (
              <div className="ml-3 border-l border-slate-200 pl-2 flex flex-col gap-0.5 mt-0.5">
                {adminItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-r-xl transition-colors",
                        isActive
                          ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 pt-3 mt-3 relative" ref={accountRef}>
        {/* Account menu — opens above the user row */}
        {accountOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Link
              href="/account/profile"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
            <Link
              href="/account/campaigns"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7a2 2 0 012-2h4l2-2h4l2 2h4a2 2 0 012 2v14M3 21h18M9 21V11h6v10" />
              </svg>
              My Campaigns
            </Link>
            <button
              onClick={() => { setAccountOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}

        {/* User row — toggles the menu */}
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-slate-600">
              {firstName?.[0] ?? "?"}{lastName?.[0] ?? ""}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium text-slate-900 truncate">
              {firstName} {lastName}
            </p>
          </div>
          <svg
            className={["h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform", accountOpen ? "rotate-180" : ""].join(" ")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
