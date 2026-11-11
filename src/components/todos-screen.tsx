"use client";

import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Archive,
  CalendarClock,
  Flag,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  ListForm,
  PRIORITY_LABEL,
  PRIORITY_TEXT,
  STATUS_LABEL,
  StatusDot,
  TodoForm,
} from "@/components/todo-forms";
import { personLabel } from "@/components/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TODO_STATUSES,
  type TodoListRecord,
  type TodoRecord,
  type TodoStatus,
} from "@/domain/schemas";
import {
  archiveList,
  dueState,
  listProgress,
  swapOrder,
  TODO_FILTERS,
  TODO_SORTS,
  todosDueSoon,
  visibleTodos,
  withStatus,
  type TodoFilter,
  type TodoSort,
} from "@/domain/todos";
import type { MessageKey } from "@/domain/i18n";
import { useActiveTrip } from "@/lib/auth-store";
import { formatDayLabel } from "@/lib/format-day";
import { t } from "@/lib/i18n";
import { todayInTokyo } from "@/lib/tokyo-date";
import { saveRecord } from "@/lib/trip-actions";
import { useTrip } from "@/lib/trip-store";
import { useTripId } from "@/lib/use-trip-id";
import { cn } from "@/lib/utils";
import { useReadOnly } from "@/lib/viewer-store";

const noopSubscribe = () => () => {};
const ALL = "all";

const FILTER_LABEL: Record<TodoFilter, MessageKey> = {
  all: "todos.filterAll",
  open: "todos.filterOpen",
  done: "todos.filterDone",
};

const SORT_LABEL: Record<TodoSort, MessageKey> = {
  manual: "todos.sortManual",
  due: "todos.sortDue",
  priority: "todos.sortPriority",
};

const refused = () => toast.error(t("common.refused"));

type Editing =
  | { kind: "todo"; todo: TodoRecord | null }
  | { kind: "list"; list: TodoListRecord | null }
  | null;

// /todos/: the trip's to-do lists. Wide screens show the lists beside the
// open one; phones choose the list from a menu above it.
export function TodosScreen() {
  const tripId = useTripId();
  const readOnly = useReadOnly();
  const { todoLists: lists, todos } = useTrip();
  const members = useActiveTrip()?.members ?? [];
  const params = useSearchParams();
  const today = useSyncExternalStore(noopSubscribe, todayInTokyo, () => null);
  const [chosen, setChosen] = useState<string>(params.get("list") ?? ALL);
  const [filter, setFilter] = useState<TodoFilter>("open");
  const [sort, setSort] = useState<TodoSort>("manual");
  const [editing, setEditing] = useState<Editing>(null);
  // A new key per opening, so each form starts from what it edits.
  const [formKey, setFormKey] = useState(0);

  const list = lists.find((l) => l.id === chosen) ?? null;
  const listId = list?.id ?? null;
  const rows = visibleTodos(todos, listId, filter, sort);
  const progress = listProgress(todos, listId);
  const listsById = new Map(lists.map((l) => [l.id, l]));
  const canEdit = Boolean(tripId) && !readOnly;

  function open(next: Editing) {
    setFormKey((k) => k + 1);
    setEditing(next);
  }

  function save(record: TodoRecord) {
    if (tripId) saveRecord(tripId, "todos", record).catch(refused);
  }

  function setStatus(todo: TodoRecord, status: TodoStatus) {
    save(withStatus(todo, status, new Date()));
  }

  function archive(todo: TodoRecord) {
    save({ ...todo, archived: true, updatedAt: new Date().toISOString() });
    toast.success(t("todos.archived"));
  }

  function move(todo: TodoRecord, step: -1 | 1) {
    for (const record of swapOrder(rows, todo.id, step)) save(record);
  }

  function retireList(target: TodoListRecord) {
    if (!tripId) return;
    const result = archiveList(target, todos, new Date());
    for (const todo of result.todos) save(todo);
    saveRecord(tripId, "todoLists", result.list).catch(refused);
    setChosen(ALL);
    toast.success(t("todos.listArchived"));
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("todos.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("todos.intro")}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => open({ kind: "list", list: null })}
            >
              <Plus />
              {t("todos.newList")}
            </Button>
            {lists.length > 0 && (
              <Button onClick={() => open({ kind: "todo", todo: null })}>
                <Plus />
                {t("todos.add")}
              </Button>
            )}
          </div>
        )}
      </header>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-sm text-muted-foreground">
            <ListChecks className="size-6 text-primary" aria-hidden />
            {t("todos.noLists")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Phones: the list is chosen from a menu. */}
          <div className="lg:hidden">
            <Select value={listId ?? ALL} onValueChange={setChosen}>
              <SelectTrigger className="w-full" aria-label={t("todos.lists")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  <ListChecks />
                  {t("todos.allLists")}
                </SelectItem>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <ListChecks style={{ color: l.color }} />
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav
            aria-label={t("todos.lists")}
            className="hidden flex-col gap-1.5 lg:flex"
          >
            <ListButton
              title={t("todos.allLists")}
              color={null}
              active={listId === null}
              progress={listProgress(todos, null)}
              onClick={() => setChosen(ALL)}
            />
            {lists.map((l) => (
              <ListButton
                key={l.id}
                title={l.title}
                color={l.color}
                active={listId === l.id}
                progress={listProgress(todos, l.id)}
                onClick={() => setChosen(l.id)}
              />
            ))}
          </nav>

          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: list?.color ?? "var(--primary)",
                    }}
                  />
                  {list ? list.title : t("todos.allLists")}
                </h2>
                {list?.description && (
                  <p className="text-sm text-muted-foreground">
                    {list.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Progress
                    value={
                      progress.total ? (progress.done / progress.total) * 100 : 0
                    }
                    className="h-1.5 w-32"
                  />
                  {t("todos.progress", progress)}
                  {today && (
                    <DueSoonNote todos={todos} listId={listId} today={today} />
                  )}
                </div>
              </div>
              {canEdit && list && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => open({ kind: "list", list })}
                  >
                    <Pencil />
                    {t("todos.editList")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retireList(list)}
                  >
                    <Archive />
                    {t("todos.archiveList")}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={filter}
                onValueChange={(v) => v && setFilter(v as TodoFilter)}
                aria-label={t("todos.filter")}
              >
                {TODO_FILTERS.map((f) => (
                  <ToggleGroupItem key={f} value={f}>
                    {t(FILTER_LABEL[f])}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Select value={sort} onValueChange={(v) => setSort(v as TodoSort)}>
                <SelectTrigger
                  size="sm"
                  className="w-fit sm:ml-auto"
                  aria-label={t("todos.sort")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TODO_SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      <ArrowDownUp />
                      {t(SORT_LABEL[s])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {progress.total === 0
                  ? t("todos.noTodos")
                  : t("todos.noMatches")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rows.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    today={today}
                    list={listId === null ? listsById.get(todo.listId) : null}
                    canEdit={canEdit}
                    canMove={
                      canEdit && sort === "manual" && listId !== null
                        ? { up: index > 0, down: index < rows.length - 1 }
                        : null
                    }
                    onStatus={(status) => setStatus(todo, status)}
                    onEdit={() => open({ kind: "todo", todo })}
                    onArchive={() => archive(todo)}
                    onMove={(step) => move(todo, step)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tripId && editing?.kind === "list" && (
        <ListForm
          key={formKey}
          tripId={tripId}
          list={editing.list}
          lists={lists}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={(saved) => setChosen(saved.id)}
        />
      )}
      {tripId && editing?.kind === "todo" && (
        <TodoForm
          key={formKey}
          tripId={tripId}
          todo={editing.todo}
          listId={listId}
          lists={lists}
          todos={todos}
          members={members}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

function DueSoonNote({
  todos,
  listId,
  today,
}: {
  todos: TodoRecord[];
  listId: string | null;
  today: string;
}) {
  const count = todosDueSoon(
    todos.filter((todo) => listId === null || todo.listId === listId),
    today,
  ).length;
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
      <CalendarClock className="size-3.5" aria-hidden />
      {t("todos.dueSoonCount", { count })}
    </span>
  );
}

function ListButton({
  title,
  color,
  active,
  progress,
  onClick,
}: {
  title: string;
  color: string | null;
  active: boolean;
  progress: { done: number; total: number; open: number };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "border-primary/50 bg-primary/10 hover:bg-primary/15",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color ?? "var(--primary)" }}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <Badge variant="secondary">
          {t("todos.openCount", { count: progress.open })}
        </Badge>
      </span>
      <Progress
        value={progress.total ? (progress.done / progress.total) * 100 : 0}
        className="h-1.5"
      />
    </button>
  );
}

function TodoRow({
  todo,
  today,
  list,
  canEdit,
  canMove,
  onStatus,
  onEdit,
  onArchive,
  onMove,
}: {
  todo: TodoRecord;
  today: string | null;
  list: TodoListRecord | null | undefined;
  canEdit: boolean;
  canMove: { up: boolean; down: boolean } | null;
  onStatus: (status: TodoStatus) => void;
  onEdit: () => void;
  onArchive: () => void;
  onMove: (step: -1 | 1) => void;
}) {
  const done = todo.status === "done";
  const due = today ? dueState(todo, today) : "none";
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <Checkbox
        className="mt-0.5"
        checked={done}
        disabled={!canEdit}
        aria-label={
          done
            ? t("todos.markOpen", { title: todo.title })
            : t("todos.markDone", { title: todo.title })
        }
        onCheckedChange={(checked) => onStatus(checked ? "done" : "todo")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button
          type="button"
          disabled={!canEdit}
          onClick={onEdit}
          aria-label={t("todos.editAria", { title: todo.title })}
          className={cn(
            "rounded-sm text-left text-sm font-medium break-words underline-offset-4 enabled:hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </button>
        {todo.description && (
          <p className="text-xs whitespace-pre-line text-muted-foreground">
            {todo.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {list && (
            <Badge variant="outline" className="gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: list.color }}
              />
              {list.title}
            </Badge>
          )}
          {todo.status === "inProgress" && (
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              <StatusDot status={todo.status} />
              {t(STATUS_LABEL[todo.status])}
            </Badge>
          )}
          {todo.dueDate && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                due === "overdue" &&
                  "border-destructive/40 bg-destructive/10 text-destructive",
                due === "soon" &&
                  "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              <CalendarClock aria-hidden />
              {due === "overdue"
                ? t("todos.overdue", { day: formatDayLabel(todo.dueDate) })
                : t("todos.dueOn", { day: formatDayLabel(todo.dueDate) })}
            </Badge>
          )}
          {todo.priority !== "normal" && (
            <Badge variant="outline" className="gap-1">
              <Flag className={PRIORITY_TEXT[todo.priority]} aria-hidden />
              {t(PRIORITY_LABEL[todo.priority])}
            </Badge>
          )}
          {todo.assignee && (
            <Badge variant="secondary">{personLabel(todo.assignee)}</Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canMove && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canMove.up}
              aria-label={t("todos.moveUp", { title: todo.title })}
              onClick={() => onMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!canMove.down}
              aria-label={t("todos.moveDown", { title: todo.title })}
              onClick={() => onMove(1)}
            >
              <ArrowDown />
            </Button>
          </>
        )}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("todos.more", { title: todo.title })}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{t("todos.status")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={todo.status}
                onValueChange={(v) => onStatus(v as TodoStatus)}
              >
                {TODO_STATUSES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    <StatusDot status={s} />
                    {t(STATUS_LABEL[s])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil />
                {t("todos.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onArchive}>
                <Archive />
                {t("todos.archive")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
