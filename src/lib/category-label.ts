import type { Category } from "@/domain/schemas";
import { t } from "@/lib/i18n";

export function categoryLabel(category: Category): string {
  return t(`category.${category}`);
}
