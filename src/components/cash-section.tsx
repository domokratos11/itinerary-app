"use client";

import { useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  Banknote,
  Landmark,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { personLabel } from "@/components/expense-form";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAmountsHidden, useYenValues, Yen } from "@/components/yen";
import { formatUsdAt, formatYen, parseUsd } from "@/domain/budget";
import type { CashSummary } from "@/domain/cash";
import { parseYen } from "@/domain/quick-expense";
import type { CashKind, CashRecord } from "@/domain/schemas";
import { useAuthStore } from "@/lib/auth-store";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { todayInTokyo } from "@/lib/tokyo-date";
import { archiveRecord, saveRecord } from "@/lib/trip-actions";

const KIND_ICON = { withdrawal: Landmark, handover: ArrowRightLeft } as const;

// Dollars exactly as typed, never converted.
const usd = (amount: number) => formatUsdAt(amount, 1);

type Editing = { kind: CashKind; record: CashRecord | null } | null;

// Cash taken out and handed between members, next to the budget but never
// in it. Spending the cash is an ordinary expense marked as paid in cash.
export function CashSection({
  tripId,
  cash,
  summary,
  members,
}: {
  tripId: string;
  cash: CashRecord[];
  summary: CashSummary;
  members: string[];
}) {
  const hidden = useAmountsHidden();
  const [editing, setEditing] = useState<Editing>(null);

  function archive(record: CashRecord) {
    const yen = formatYen(record.amountJPY);
    archiveRecord(
      tripId,
      "cash",
      record,
      t("activity.archivedCash", { yen }),
    ).catch(() => toast.error(t("common.refused")));
    toast(t("common.archivedName", { name: t(`cash.${record.kind}`) }), {
      action: {
        label: t("common.undo"),
        onClick: () =>
          saveRecord(tripId, "cash", record).catch(() =>
            toast.error(t("common.refused")),
          ),
      },
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="size-4 text-primary" />
            {t("cash.title")}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("cash.intro")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tip label={t("cash.tipWithdrawal")}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing({ kind: "withdrawal", record: null })}
            >
              <Landmark />
              {t("cash.addWithdrawal")}
            </Button>
          </Tip>
          {members.length > 1 && (
            <Tip label={t("cash.tipHandover")}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing({ kind: "handover", record: null })}
              >
                <ArrowRightLeft />
                {t("cash.addHandover")}
              </Button>
            </Tip>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {summary.people.map((p) => (
              <li key={p.email} className="rounded-lg border p-3 text-sm">
                <span className="block text-muted-foreground">
                  {personLabel(p.email)}
                </span>
                <span
                  className="block text-lg font-semibold tabular-nums"
                  title={t("cash.onHandHint")}
                >
                  <Yen yen={p.onHand} />
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("cash.onHand")}
                </span>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">
                    {t("cash.withdrawn")}
                  </dt>
                  <dd className="text-right tabular-nums">
                    <Yen yen={p.withdrawn} />
                  </dd>
                  <dt className="text-muted-foreground">
                    {t("cash.received")}
                  </dt>
                  <dd className="text-right tabular-nums">
                    <Yen yen={p.received} />
                  </dd>
                  <dt className="text-muted-foreground">{t("cash.given")}</dt>
                  <dd className="text-right tabular-nums">
                    <Yen yen={p.given} />
                  </dd>
                  <dt className="text-muted-foreground">
                    {t("cash.spentCash")}
                  </dt>
                  <dd className="text-right tabular-nums">
                    <Yen yen={p.spentCash} />
                  </dd>
                </dl>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("cash.withdrawn")}</span>
            <span className="tabular-nums">
              <Yen yen={summary.withdrawn} />
              {!hidden && summary.withdrawnUSD > 0 && (
                <span className="text-muted-foreground">
                  {" · "}
                  {t("cash.usdCharged", { usd: usd(summary.withdrawnUSD) })}
                </span>
              )}
            </span>
            {summary.missingUSD > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TriangleAlert className="size-3.5 text-warning" />
                {t("cash.usdMissing", { count: summary.missingUSD })}
              </span>
            )}
          </div>

          {members.length > 1 && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("cash.owing")}</span>
              {summary.debts.length === 0 ? (
                <span className="text-muted-foreground">
                  {t("cash.allSquare")}
                </span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {summary.debts.map((d) => (
                    <DebtLine
                      key={`${d.from}-${d.to}`}
                      from={d.from}
                      to={d.to}
                      yen={d.yen}
                    />
                  ))}
                </ul>
              )}
              <span className="text-xs text-muted-foreground">
                {t("cash.settleHint")}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("cash.movements")}</span>
          {cash.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("cash.none")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cash.map((record) => (
                <CashRow
                  key={record.id}
                  record={record}
                  onEdit={() => setEditing({ kind: record.kind, record })}
                  onArchive={() => archive(record)}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      {editing && (
        <CashForm
          key={editing.record?.id ?? editing.kind}
          tripId={tripId}
          kind={editing.kind}
          record={editing.record}
          members={members}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function DebtLine({
  from,
  to,
  yen,
}: {
  from: string;
  to: string;
  yen: number;
}) {
  const money = useYenValues();
  return (
    <li className="tabular-nums">
      <Yen yen={yen}>
        {t("cash.owes", {
          from: personLabel(from),
          to: personLabel(to),
          yen: money.format(yen),
        })}
      </Yen>
    </li>
  );
}

function CashRow({
  record,
  onEdit,
  onArchive,
}: {
  record: CashRecord;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const hidden = useAmountsHidden();
  const Icon = KIND_ICON[record.kind];
  const label = t(`cash.${record.kind}`);
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-muted-foreground">
          {formatDayLabel(record.date)} ·{" "}
          {record.kind === "handover" && record.to
            ? t("cash.handedTo", {
                from: personLabel(record.by),
                to: personLabel(record.to),
              })
            : personLabel(record.by)}
        </span>
        {record.note && <span className="block">{record.note}</span>}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="font-medium tabular-nums">
          <Yen yen={record.amountJPY} />
        </span>
        {record.kind === "withdrawal" &&
          !hidden &&
          (record.amountUSD === null ? (
            <Badge variant="outline">{t("cash.noUsd")}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("cash.usdCharged", { usd: usd(record.amountUSD) })}
            </span>
          ))}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          hidden
            ? t("budget.showToEdit")
            : t("common.editName", { name: label })
        }
        disabled={hidden}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("budget.archiveName", { name: label })}
        onClick={onArchive}
      >
        <Archive />
      </Button>
    </li>
  );
}

function PersonSelect({
  id,
  value,
  people,
  onChange,
}: {
  id: string;
  value: string | null;
  people: string[];
  onChange: (email: string) => void;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("budget.pickPayer")} />
      </SelectTrigger>
      <SelectContent>
        {people.map((email) => (
          <SelectItem key={email} value={email}>
            {personLabel(email)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// A withdrawal, or cash handed from one member to another. The dollars of a
// withdrawal are typed from the bank, never worked out.
function CashForm({
  tripId,
  kind,
  record,
  members,
  onClose,
}: {
  tripId: string;
  kind: CashKind;
  record: CashRecord | null;
  members: string[];
  onClose: () => void;
}) {
  const me = useAuthStore((s) => s.user?.email?.toLowerCase() ?? null);
  const people = [
    ...new Set([
      ...members,
      ...(record ? [record.by, ...(record.to ? [record.to] : [])] : []),
    ]),
  ];
  const firstBy = record?.by ?? (me && people.includes(me) ? me : people[0]);
  const [date, setDate] = useState(record?.date ?? todayInTokyo());
  const [by, setBy] = useState<string | null>(firstBy ?? null);
  const [to, setTo] = useState<string | null>(
    record?.to ?? people.find((p) => p !== firstBy) ?? null,
  );
  const [yen, setYen] = useState(record ? String(record.amountJPY) : "");
  const [dollars, setDollars] = useState(
    record?.amountUSD != null ? String(record.amountUSD) : "",
  );
  const [note, setNote] = useState(record?.note ?? "");

  const amount = parseYen(yen);
  const amountUSD = dollars.trim() === "" ? null : parseUsd(dollars);
  const samePerson = kind === "handover" && by !== null && by === to;
  const valid =
    amount !== null &&
    by !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (dollars.trim() === "" || amountUSD !== null) &&
    (kind === "withdrawal" || (to !== null && !samePerson));

  function save() {
    if (amount === null || by === null) return;
    const next: CashRecord = {
      id: record?.id ?? crypto.randomUUID(),
      kind,
      date,
      amountJPY: amount,
      amountUSD: kind === "withdrawal" ? amountUSD : null,
      by,
      to: kind === "handover" ? to : null,
      note: note.trim() || null,
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    saveRecord(
      tripId,
      "cash",
      next,
      t("activity.savedCash", { yen: formatYen(amount) }),
    ).catch(() => toast.error(t("common.refused")));
    onClose();
  }

  const title =
    kind === "withdrawal"
      ? record
        ? t("cash.editWithdrawal")
        : t("cash.addWithdrawal")
      : record
        ? t("cash.editHandover")
        : t("cash.addHandover");

  return (
    <EditPanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={kind === "handover" ? t("cash.settleHint") : undefined}
      canSubmit={valid}
      onSubmit={save}
    >
      {kind === "withdrawal" ? (
        <Field label={t("cash.who")} htmlFor="cash-by">
          <PersonSelect
            id="cash-by"
            value={by}
            people={people}
            onChange={setBy}
          />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("cash.from")} htmlFor="cash-by">
            <PersonSelect
              id="cash-by"
              value={by}
              people={people}
              onChange={setBy}
            />
          </Field>
          <Field
            label={t("cash.to")}
            htmlFor="cash-to"
            hint={samePerson ? t("cash.samePerson") : undefined}
          >
            <PersonSelect
              id="cash-to"
              value={to}
              people={people}
              onChange={setTo}
            />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("budget.amount")} htmlFor="cash-yen">
          <Input
            id="cash-yen"
            inputMode="numeric"
            value={yen}
            required
            autoFocus={!record}
            onChange={(e) => setYen(e.target.value)}
          />
        </Field>
        <Field label={t("common.date")} htmlFor="cash-date">
          <Input
            id="cash-date"
            type="date"
            value={date}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      {kind === "withdrawal" && (
        <Field
          label={t("cash.amountUSD")}
          htmlFor="cash-usd"
          hint={t("cash.amountUSDHint")}
        >
          <Input
            id="cash-usd"
            inputMode="decimal"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
          />
        </Field>
      )}
      <Field label={t("common.noteOptional")} htmlFor="cash-note">
        <Input
          id="cash-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </EditPanel>
  );
}
