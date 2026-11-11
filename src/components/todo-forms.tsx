"use client";

import { useState } from "react";
import { Check, Flag, ListChecks, User, Users } from "lucide-react";
import { toast } from "sonner";

import { EditPanel, Field } from "@/components/edit-panel";
import { personLabel } from "@/components/expense-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TODO_PRIORITIES,
  TODO_STATUSES,
  type TodoListRecord,
  type TodoPriority,
  type TodoRecord,
  type TodoStatus,
} from "@/domain/schemas";
import { LIST_COLORS, nextOrder, withStatus } from "@/domain/todos";
import type { MessageKey } from "@/domain/i18n";
import { t } from "@/lib/i18n";
import { saveRecord } from "@/lib/trip-actions";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<TodoStatus, MessageKey> = {
  todo: "todos.statusTodo",
  inProgress: "todos.statusInProgress",
  done: "todos.statusDone",
};

export const PRIORITY_LABEL: Record<TodoPriority, MessageKey> = {
  low: "todos.priorityLow",
  normal: "todos.priorityNormal",
  high: "todos.priorityHigh",
};

const NOBODY = "nobody";

const refused = () => toast.error(t("common.refused"));

// Adds or edits one list: its name, what it's for and its colour.
export function ListForm({
  tripId,
  list,
  lists,
  open,
  onOpenChange,
  onSaved,
}: {
  tripId: string;
  list: TodoListRecord | null;
  lists: TodoListRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (list: TodoListRecord) => void;
}) {
  const [title, setTitle] = useState(list?.title ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [color, setColor] = useState<string>(list?.color ?? LIST_COLORS[0]);

  function save() {
    const record: TodoListRecord = {
      id: list?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || null,
      color,
      order: list?.order ?? nextOrder(lists),
      archived: false,
      updatedAt: new Date().toISOString(),
    };
    saveRecord(tripId, "todoLists", record).catch(refused);
    onSaved?.(record);
    onOpenChange(false);
  }

  return (
    <EditPanel
      open={open}
      onOpenChange={onOpenChange}
      title={list ? t("todos.editList") : t("todos.newList")}
      onSubmit={save}
      canSubmit={title.trim().length > 0}
    >
      <Field label={t("todos.listName")} htmlFor="todo-list-title">
        <Input
          id="todo-list-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label={t("todos.description")} htmlFor="todo-list-description">
        <Textarea
          id="todo-list-description"
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">
          {t("todos.color")}
        </legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {LIST_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                color === c && "ring-2 ring-foreground/60",
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </fieldset>
    </EditPanel>
  );
}

// Adds or edits one to-do. A new one goes at the end of its list.
export function TodoForm({
  tripId,
  todo,
  listId,
  lists,
  todos,
  members,
  open,
  onOpenChange,
}: {
  tripId: string;
  todo: TodoRecord | null;
  listId: string | null;
  lists: TodoListRecord[];
  todos: TodoRecord[];
  members: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [list, setList] = useState(todo?.listId ?? listId ?? lists[0]?.id);
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? "");
  const [status, setStatus] = useState<TodoStatus>(todo?.status ?? "todo");
  const [priority, setPriority] = useState<TodoPriority>(
    todo?.priority ?? "normal",
  );
  const [assignee, setAssignee] = useState(todo?.assignee ?? NOBODY);

  function save() {
    if (!list) return;
    const now = new Date();
    const base: TodoRecord = {
      id: todo?.id ?? crypto.randomUUID(),
      listId: list,
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || null,
      status: todo?.status ?? "todo",
      priority,
      assignee: assignee === NOBODY ? null : assignee,
      order:
        todo && todo.listId === list
          ? todo.order
          : nextOrder(todos.filter((r) => r.listId === list)),
      completedAt: todo?.completedAt ?? null,
      archived: false,
      updatedAt: now.toISOString(),
    };
    const record = withStatus(base, status, now);
    saveRecord(tripId, "todos", record).catch(refused);
    toast.success(t("todos.saved", { title: record.title }));
    onOpenChange(false);
  }

  return (
    <EditPanel
      open={open}
      onOpenChange={onOpenChange}
      title={todo ? t("todos.edit") : t("todos.add")}
      onSubmit={save}
      canSubmit={title.trim().length > 0 && Boolean(list)}
    >
      <Field label={t("todos.todoTitle")} htmlFor="todo-title">
        <Input
          id="todo-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label={t("todos.description")} htmlFor="todo-description">
        <Textarea
          id="todo-description"
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("todos.list")} htmlFor="todo-list">
          <Select value={list} onValueChange={setList}>
            <SelectTrigger id="todo-list" className="w-full">
              <SelectValue placeholder={t("todos.chooseList")} />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <ListChecks style={{ color: l.color }} />
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("todos.dueDate")} htmlFor="todo-due">
          <Input
            id="todo-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label={t("todos.status")} htmlFor="todo-status">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as TodoStatus)}
          >
            <SelectTrigger id="todo-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TODO_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusDot status={s} />
                  {t(STATUS_LABEL[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("todos.priority")} htmlFor="todo-priority">
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TodoPriority)}
          >
            <SelectTrigger id="todo-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TODO_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <Flag className={PRIORITY_TEXT[p]} />
                  {t(PRIORITY_LABEL[p])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("todos.assignee")} htmlFor="todo-assignee">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger id="todo-assignee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>
                <Users />
                {t("todos.nobody")}
              </SelectItem>
              {members.map((email) => (
                <SelectItem key={email} value={email}>
                  <User />
                  {personLabel(email)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </EditPanel>
  );
}

export const PRIORITY_TEXT: Record<TodoPriority, string> = {
  low: "text-muted-foreground",
  normal: "text-primary",
  high: "text-destructive",
};

const STATUS_COLOR: Record<TodoStatus, string> = {
  todo: "bg-muted-foreground/50",
  inProgress: "bg-amber-500",
  done: "bg-primary",
};

export function StatusDot({ status }: { status: TodoStatus }) {
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-full", STATUS_COLOR[status])}
    />
  );
}
