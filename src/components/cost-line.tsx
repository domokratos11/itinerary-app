import { costTotal } from "@/domain/plan";
import type { Place } from "@/domain/schemas";

// Estimated spend for some stops. Stops without a researched price are
// counted apart, so an unknown price never reads as free.
export function CostLine({ places }: { places: (Place | undefined)[] }) {
  if (places.length === 0) return null;
  const { yen, unpriced } = costTotal(places);
  return (
    <p className="text-sm text-muted-foreground">
      Est. ¥{yen.toLocaleString("en-US")}
      {unpriced > 0 && ` · ${unpriced} without a price yet`}
    </p>
  );
}
