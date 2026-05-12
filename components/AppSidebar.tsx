"use client";

import {
  IconHome,
  IconListNumbers,
  IconPlugConnected,
  IconRefresh,
} from "@tabler/icons-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";

const links = [
  {
    label: "Home",
    href: "/",
    icon: (
      <IconHome className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
  {
    label: "WebSocket Echo",
    href: "/01-ws-echo",
    icon: (
      <IconPlugConnected className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
  {
    label: "Reconnect",
    href: "/02-reconnect",
    icon: (
      <IconRefresh className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
  {
    label: "Sequence gap",
    href: "/03-seq-gap",
    icon: (
      <IconListNumbers className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
];

export const AppSidebar = ({ children }: { children: React.ReactNode }) => {
  return (
    <Sidebar>
      <div className="flex min-h-screen w-full flex-col bg-neutral-50 text-neutral-950 md:flex-row dark:bg-neutral-950 dark:text-neutral-50">
        <SidebarBody className="border-r h-screen border-neutral-200 dark:border-neutral-800">
          <div className="flex h-full flex-col gap-8">
            <SidebarLink
              link={{
                label: "Order Book",
                href: "/",
                icon: (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
                    OB
                  </span>
                ),
              }}
              className="font-semibold"
            />
            <nav className="flex flex-col gap-2">
              {links.map((link) => (
                <SidebarLink key={link.href} link={link} />
              ))}
            </nav>
          </div>
        </SidebarBody>
        <main className="flex min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-10">
          {children}
        </main>
      </div>
    </Sidebar>
  );
};
