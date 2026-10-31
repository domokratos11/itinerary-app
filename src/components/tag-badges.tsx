import { Badge } from "@/components/ui/badge";
import type { Category, Priority } from "@/domain/schemas";
import {
  CATEGORY_COLOR,
  PRIORITY_COLOR,
  PRIORITY_INK,
  tint,
} from "@/domain/taxonomy";
import { categoryLabel } from "@/lib/category-label";
import { t } from "@/lib/i18n";
import { CATEGORY_ICON, PRIORITY_ICON } from "@/lib/taxonomy-icons";

export function CategoryBadge({ category }: { category: Category }) {
  const Icon = CATEGORY_ICON[category];
  const color = CATEGORY_COLOR[category];
  return (
    <Badge
      variant="outline"
      style={{ backgroundColor: tint(color), borderColor: color }}
    >
      <Icon style={{ color }} />
      {categoryLabel(category)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <Badge
      style={{
        backgroundColor: PRIORITY_COLOR[priority],
        color: PRIORITY_INK[priority],
      }}
    >
      <Icon />
      {t(`priorities.${priority}`)}
    </Badge>
  );
}

// An icon and label for select menus and filters.
export function CategoryOption({ category }: { category: Category }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <>
      <Icon style={{ color: CATEGORY_COLOR[category] }} />
      {categoryLabel(category)}
    </>
  );
}

export function PriorityOption({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <>
      <Icon style={{ color: PRIORITY_COLOR[priority] }} />
      {t(`priorities.${priority}`)}
    </>
  );
}
