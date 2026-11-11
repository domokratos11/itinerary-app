import { addDays } from "./days";
import type {
  TodoListRecord,
  TodoPriority,
  TodoRecord,
  TodoStatus,
} from "./schemas";

// How far ahead a due to-do starts to warn.
export const DUE_SOON_DAYS = 7;

export type DueState = "overdue" | "soon" | "later" | "none";

export const TODO_FILTERS = ["all", "open", "done"] as const;
export type TodoFilter = (typeof TODO_FILTERS)[number];

export const TODO_SORTS = ["manual", "due", "priority"] as const;
export type TodoSort = (typeof TODO_SORTS)[number];

// Colours offered for a new list, from the app's palette.
export const LIST_COLORS = [
  "#0d9488",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#16a34a",
] as const;

const PRIORITY_RANK: Record<TodoPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function isOpen(todo: Pick<TodoRecord, "status">): boolean {
  return todo.status !== "done";
}

// Whether a to-do is late, due within the week, or neither. `today` is the
// date in Japan (lib/tokyo-date). Done to-dos never warn.
export function dueState(
  todo: Pick<TodoRecord, "dueDate" | "status">,
  today: string,
  soonDays: number = DUE_SOON_DAYS,
): DueState {
  if (!todo.dueDate) return "none";
  if (!isOpen(todo)) return "later";
  if (todo.dueDate < today) return "overdue";
  if (todo.dueDate <= addDays(today, soonDays)) return "soon";
  return "later";
}

// Open to-dos that are late or due within the week: late first, then by date.
export function todosDueSoon(
  todos: TodoRecord[],
  today: string,
  soonDays: number = DUE_SOON_DAYS,
): TodoRecord[] {
  return todos
    .filter((todo) => {
      const state = dueState(todo, today, soonDays);
      return !todo.archived && (state === "overdue" || state === "soon");
    })
    .sort((a, b) =>
      (a.dueDate ?? "") < (b.dueDate ?? "")
        ? -1
        : (a.dueDate ?? "") > (b.dueDate ?? "")
          ? 1
          : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    );
}

export function listProgress(
  todos: TodoRecord[],
  listId: string | null,
): { done: number; total: number; open: number } {
  const mine = todos.filter(
    (todo) => !todo.archived && (listId === null || todo.listId === listId),
  );
  const done = mine.filter((todo) => !isOpen(todo)).length;
  return { done, total: mine.length, open: mine.length - done };
}

// What a list shows: filtered by status, then in the chosen order. With no
// list, every list's to-dos.
export function visibleTodos(
  todos: TodoRecord[],
  listId: string | null,
  filter: TodoFilter,
  sort: TodoSort,
): TodoRecord[] {
  const rows = todos.filter(
    (todo) =>
      !todo.archived &&
      (listId === null || todo.listId === listId) &&
      (filter === "all" || (filter === "open") === isOpen(todo)),
  );
  const byOrder = (a: TodoRecord, b: TodoRecord) => a.order - b.order;
  const byDue = (a: TodoRecord, b: TodoRecord) => {
    // Without a date goes last.
    const da = a.dueDate ?? "9999-12-31";
    const db = b.dueDate ?? "9999-12-31";
    return da < db ? -1 : da > db ? 1 : byOrder(a, b);
  };
  const byPriority = (a: TodoRecord, b: TodoRecord) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b);
  return [...rows].sort(
    sort === "due" ? byDue : sort === "priority" ? byPriority : byOrder,
  );
}

// The next free place at the end of a list (or of the lists).
export function nextOrder(rows: { order: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order + 1), 0);
}

// Swaps a to-do with its neighbour in `rows` (as shown), for the up and down
// buttons. Returns the two records to save, or none at an end.
export function swapOrder<T extends { id: string; order: number }>(
  rows: T[],
  id: string,
  step: -1 | 1,
): T[] {
  const index = rows.findIndex((row) => row.id === id);
  const other = rows[index + step];
  if (index < 0 || !other) return [];
  const row = rows[index];
  // Equal orders (from old data) still move apart.
  const a = row.order === other.order ? other.order + step : other.order;
  return [
    { ...row, order: a },
    { ...other, order: row.order },
  ];
}

// Marks a to-do with a status, keeping when it was finished.
export function withStatus(
  todo: TodoRecord,
  status: TodoStatus,
  now: Date,
): TodoRecord {
  const stamp = now.toISOString();
  return {
    ...todo,
    status,
    completedAt:
      status === "done" ? (todo.completedAt ?? stamp) : null,
    updatedAt: stamp,
  };
}

// Archiving a list takes its to-dos with it, so nothing is left without one.
export function archiveList(
  list: TodoListRecord,
  todos: TodoRecord[],
  now: Date,
): { list: TodoListRecord; todos: TodoRecord[] } {
  const stamp = now.toISOString();
  return {
    list: { ...list, archived: true, updatedAt: stamp },
    todos: todos
      .filter((todo) => todo.listId === list.id && !todo.archived)
      .map((todo) => ({ ...todo, archived: true, updatedAt: stamp })),
  };
}
