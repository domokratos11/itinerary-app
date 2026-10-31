import {
  Camera,
  CircleHelp,
  Gift,
  Heart,
  Hotel,
  Landmark,
  Package,
  Plane,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { Category, ExpenseCategory, Priority } from "@/domain/schemas";

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  lights: Sparkles,
  food: UtensilsCrossed,
  shopping: ShoppingBag,
  sight: Camera,
  daytrip: TrainFront,
  temple: Landmark,
};

export const EXPENSE_ICON: Record<ExpenseCategory, LucideIcon> = {
  flight: Plane,
  booking: Hotel,
  transport: TrainFront,
  food: UtensilsCrossed,
  souvenirs: Gift,
  attractions: Ticket,
  clothes: Shirt,
  temples: Landmark,
  other: Package,
};

export const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  must: Star,
  want: Heart,
  maybe: CircleHelp,
};
