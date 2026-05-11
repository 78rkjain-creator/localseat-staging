"use client";

import { useState } from "react";

export interface TabDef {
  id: string;
  label: string;
}

interface DashboardTabsProps {
  tabs: TabDef[];
  children: React.ReactNode[];
  defaultTab?: string;
}

export function DashboardTabs({ tabs, children, defaultTab }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  const activeContent = activeIndex >= 0 ? children[activeIndex] : null;

  return (
    <div>
      {/* Tab pills — file folder style */}
      <div className="flex gap-0 pl-2" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "relative px-5 py-2.5 text-sm font-medium rounded-t-xl transition-colors",
                isActive
                  ? "bg-white text-slate-900 shadow-sm z-10 border border-slate-200 border-b-white"
                  : "bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent",
              ].join(" ")}
              style={isActive ? { marginBottom: "-1px" } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Folder body */}
      <div
        className="bg-white rounded-b-2xl rounded-tr-2xl border border-slate-200 p-5 shadow-sm"
        role="tabpanel"
      >
        {activeContent}
      </div>
    </div>
  );
}
