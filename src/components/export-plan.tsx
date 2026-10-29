"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlanStore } from "@/lib/plan-store";

// Downloads every plan item (including removed ones) as JSON in the PlanItem
// shape, so the plan can be kept as a file next to the city data.
export function ExportPlan() {
  const items = usePlanStore((s) => s.items);

  function download() {
    const blob = new Blob([JSON.stringify(items, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trip-plan-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={download}
      disabled={!items.length}
    >
      <Download />
      Export plan
    </Button>
  );
}
