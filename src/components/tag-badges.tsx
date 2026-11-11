import { Badge } from "@/components/ui/badge";
import type { Category, Priority } from "@/domain/schemas";
import { CATEGORY_COLOR, PRIORITY_COLOR } from "@/domain/taxonomy";
import { categoryLabel } from "@/lib/category-label";
import { t } from "@/lib/i18n";
import { CATEGORY_ICON, PRIORITY_ICON } from "@/lib/taxonomy-icons";

// A quiet badge: the word carries the meaning and the coloured icon helps
// find it, so the text stays readable on any colour in light and dark.
export function CategoryBadge({ category }: { category: Category }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <Badge variant="secondary">
      <Icon style={{ color: CATEGORY_COLOR[category] }} />
      {categoryLabel(category)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <Badge variant="outline">
      <Icon style={{ color: PRIORITY_COLOR[priority] }} />
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
