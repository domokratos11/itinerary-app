"use client";

import type { ReactNode } from "react";
import { ListFilter } from "lucide-react";

import { BarList } from "@/components/charts-lazy";
import { Figure } from "@/components/budget-figures";
import { ExpenseRow } from "@/components/budget-parts";
import { personLabel } from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useYenValues, Yen } from "@/components/yen";
import {
  filterExpenses,
  NO_FILTER,
  personDetails,
  type MemberTotal,
} from "@/domain/budget";
import type { CashPerson } from "@/domain/cash";
import type { ExpenseRecord } from "@/domain/schemas";
import { EXPENSE_COLOR } from "@/domain/taxonomy";
import { t } from "@/lib/i18n";
import { EXPENSE_ICON } from "@/lib/taxonomy-icons";
import { useMediaQuery } from "@/lib/use-media-query";

// Everything one person paid: totals, card or cash, by category, their cash
// and each of their expenses. A side Sheet on wide screens, a bottom Drawer
// on phones, as the place details are.
export function PersonPanel({
  person,
  open,
  expenses,
  members,
  cash,
  onOpenChange,
  onEdit,
  onArchive,
  onShowInList,
}: {
  person: MemberTotal | null;
  open: boolean;
  expenses: ExpenseRecord[];
  members: readonly string[];
  cash: CashPerson | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (expense: ExpenseRecord) => void;
  onArchive: (expense: ExpenseRecord) => void;
  onShowInList: (email: string) => void;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  const name = person ? personLabel(person.email) : "";
  const body = person && (
    <PersonBody
      person={person}
      expenses={expenses}
      members={members}
      cash={cash}
      onEdit={onEdit}
      onArchive={onArchive}
      onShowInList={onShowInList}
    />
  );

  if (wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle className="text-xl">{name}</SheetTitle>
            <SheetDescription>
              {t("budget.personIntro", { name })}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>{body}</SheetBody>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-xl">{name}</DrawerTitle>
            <DrawerDescription>
              {t("budget.personIntro", { name })}
            </DrawerDescription>
          </DrawerHeader>
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function PersonBody({
  person,
  expenses,
  members,
  cash,
  onEdit,
  onArchive,
  onShowInList,
}: {
  person: MemberTotal;
  expenses: ExpenseRecord[];
  members: readonly string[];
  cash: CashPerson | null;
  onEdit: (expense: ExpenseRecord) => void;
  onArchive: (expense: ExpenseRecord) => void;
  onShowInList: (email: string) => void;
}) {
  const money = useYenValues();
  const name = personLabel(person.email);
  const details = personDetails(expenses, person.email, members);
  const own = filterExpenses(
    expenses,
    { ...NO_FILTER, person: person.email },
    "newest",
    members,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Figure
          label={t("budget.paid")}
          value={<Yen yen={details.paid} />}
          hint={
            person.target === null
              ? undefined
              : t("budget.ofTarget", {
                  paid: money.format(details.paid),
                  target: money.format(person.target),
                })
          }
        />
        <Figure
          label={t("budget.planned")}
          value={<Yen yen={details.planned} />}
        />
        <Figure
          label={t("budget.byCard")}
          value={<Yen yen={details.byCard} />}
        />
        <Figure
          label={t("budget.inCash")}
          value={<Yen yen={details.byCash} />}
        />
      </div>

      {cash && (cash.withdrawn > 0 || cash.received > 0 || cash.given > 0) && (
        <>
          <Separator />
          <Section title={t("cash.title")}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Figure
                label={t("cash.onHand")}
                value={<Yen yen={cash.onHand} />}
                hint={t("cash.onHandHint")}
              />
              <Figure
                label={t("cash.withdrawn")}
                value={<Yen yen={cash.withdrawn} />}
              />
              <Figure
                label={t("cash.received")}
                value={<Yen yen={cash.received} />}
              />
              <Figure
                label={t("cash.given")}
                value={<Yen yen={cash.given} />}
              />
            </div>
          </Section>
        </>
      )}

      <Separator />
      <Section title={t("budget.personCategories")}>
        {details.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("budget.personNothing", { name })}
          </p>
        ) : (
          <BarList
            rows={details.categories.map(({ category, paid }) => ({
              key: category,
              label: t(`expenseCategory.${category}`),
              value: paid,
              color: EXPENSE_COLOR[category],
              icon: EXPENSE_ICON[category],
            }))}
            {...money}
          />
        )}
      </Section>

      <Separator />
      <Section title={t("budget.personExpenses")}>
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("budget.personCount", { count: details.count })}
        </p>
        {own.length > 0 && (
          <>
            <ul className="flex flex-col gap-2">
              {own.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={() => onEdit(expense)}
                  onArchive={() => onArchive(expense)}
                />
              ))}
            </ul>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => onShowInList(person.email)}
            >
              <ListFilter />
              {t("budget.seeAll")}
            </Button>
          </>
        )}
      </Section>
    </div>
  );
}
