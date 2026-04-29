import type { SupportLevel } from "@/types";

export type SupportBadgeData = {
  level: SupportLevel;
  source: "canvass" | "imported";
} | null;

export function deriveSupportBadge(args: {
  latestCanvassSupport: SupportLevel | null | undefined;
  importedSupport: SupportLevel | null | undefined;
}): SupportBadgeData {
  if (args.latestCanvassSupport) {
    return { level: args.latestCanvassSupport, source: "canvass" };
  }
  if (args.importedSupport) {
    return { level: args.importedSupport, source: "imported" };
  }
  return null;
}
