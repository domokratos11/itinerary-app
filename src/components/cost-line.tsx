import { costTotal } from "@/domain/plan";
import type { Place } from "@/domain/schemas";
import { t } from "@/lib/i18n";

// Estimated spend for some stops. Stops without a researched price are
// counted apart, so an unknown price never reads as free.
export function CostLine({ places }: { places: (Place | undefined)[] }) {
  if (places.length === 0) return null;
  const { yen, unpriced } = costTotal(places);
  return (
    <p className="text-sm text-muted-foreground">
      {unpriced > 0
        ? t("misc.costEstimateUnpriced", {
            yen: yen.toLocaleString("en-US"),
            count: unpriced,
          })
        : t("misc.costEstimate", { yen: yen.toLocaleString("en-US") })}
    </p>
  );
}
