"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// A short hint on hover or keyboard focus. Opens only for keyboard focus, so
// it doesn't pop up when a closing panel hands focus back to its button.
export function Tip({
  label,
  side,
  children,
}: {
  label: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
  children: ReactElement;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger
          asChild
          onFocus={(e) => {
            if (!e.target.matches(":focus-visible")) e.preventDefault();
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-64 text-balance">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
