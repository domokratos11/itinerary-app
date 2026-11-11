import { describe, expect, it } from "vitest";

import type { TodoListRecord, TodoRecord } from "./schemas";
import {
  archiveList,
  dueState,
  listProgress,
  nextOrder,
  swapOrder,
  todosDueSoon,
  visibleTodos,
  withStatus,
} from "./todos";

const NOW = "2026-11-10T00:00:00.000Z";
const TODAY = "2026-11-10";

function todo(over: Partial<TodoRecord> = {}): TodoRecord {
  return {
    id: "t1",
    listId: "l1",
    title: "Renew passports",
    description: null,
    dueDate: null,
    status: "todo",
    priority: "normal",
    assignee: null,
    order: 0,
    completedAt: null,
    archived: false,
    updatedAt: NOW,
    ...over,
  };
}

describe("dueState", () => {
  it("warns a week ahead and when late, never once done", () => {
    expect(dueState(todo(), TODAY)).toBe("none");
    expect(dueState(todo({ dueDate: "2026-11-09" }), TODAY)).toBe("overdue");
    expect(dueState(todo({ dueDate: TODAY }), TODAY)).toBe("soon");
    expect(dueState(todo({ dueDate: "2026-11-17" }), TODAY)).toBe("soon");
    expect(dueState(todo({ dueDate: "2026-11-18" }), TODAY)).toBe("later");
    expect(
      dueState(todo({ dueDate: "2026-11-01", status: "done" }), TODAY),
    ).toBe("later");
  });
});

describe("todosDueSoon", () => {
  it("lists open, late or near ones, late first", () => {
    const rows = [
      todo({ id: "a", dueDate: "2026-11-15" }),
      todo({ id: "b", dueDate: "2026-11-02" }),
      todo({ id: "c", dueDate: "2026-12-30" }),
      todo({ id: "d", dueDate: "2026-11-12", status: "done" }),
      todo({ id: "e", dueDate: "2026-11-12", archived: true }),
      todo({ id: "f" }),
    ];
    expect(todosDueSoon(rows, TODAY).map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("listProgress and visibleTodos", () => {
  const rows = [
    todo({ id: "a", order: 2, priority: "low", dueDate: "2026-11-20" }),
    todo({ id: "b", order: 1, status: "done" }),
    todo({ id: "c", order: 0, priority: "high", dueDate: "2026-12-01" }),
    todo({ id: "d", listId: "l2", order: 0 }),
  ];

  it("counts what's done in one list or all", () => {
    expect(listProgress(rows, "l1")).toEqual({ done: 1, total: 3, open: 2 });
    expect(listProgress(rows, null)).toEqual({ done: 1, total: 4, open: 3 });
  });

  it("filters and sorts", () => {
    const ids = (r: TodoRecord[]) => r.map((x) => x.id);
    expect(ids(visibleTodos(rows, "l1", "all", "manual"))).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(ids(visibleTodos(rows, "l1", "open", "due"))).toEqual(["a", "c"]);
    expect(ids(visibleTodos(rows, "l1", "done", "manual"))).toEqual(["b"]);
    expect(ids(visibleTodos(rows, "l1", "open", "priority"))).toEqual([
      "c",
      "a",
    ]);
    expect(visibleTodos(rows, null, "all", "manual")).toHaveLength(4);
  });
});

describe("ordering", () => {
  it("adds at the end and swaps neighbours", () => {
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([{ order: 3 }, { order: 1 }])).toBe(4);
    const rows = [todo({ id: "a", order: 0 }), todo({ id: "b", order: 1 })];
    expect(swapOrder(rows, "a", 1).map((r) => [r.id, r.order])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
    expect(swapOrder(rows, "a", -1)).toEqual([]);
  });
});

describe("withStatus and archiveList", () => {
  const now = new Date("2026-11-11T00:00:00.000Z");

  it("keeps when it was first finished, and clears it when reopened", () => {
    const done = withStatus(todo(), "done", now);
    expect(done.completedAt).toBe(now.toISOString());
    expect(withStatus(done, "done", new Date()).completedAt).toBe(
      now.toISOString(),
    );
    expect(withStatus(done, "todo", now).completedAt).toBeNull();
  });

  it("archives a list with its live to-dos", () => {
    const list: TodoListRecord = {
      id: "l1",
      title: "Before we fly",
      description: null,
      color: "#0d9488",
      order: 0,
      archived: false,
      updatedAt: NOW,
    };
    const result = archiveList(
      list,
      [todo({ id: "a" }), todo({ id: "b", listId: "l2" })],
      now,
    );
    expect(result.list.archived).toBe(true);
    expect(result.todos.map((r) => [r.id, r.archived])).toEqual([["a", true]]);
  });
});
