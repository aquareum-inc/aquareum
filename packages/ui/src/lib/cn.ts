import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Our type and radius tokens, registered so they are not mistaken for colours when merging. */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "body", "lead", "title", "display"] }],
      rounded: [{ rounded: ["field", "media", "card", "sheet"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
