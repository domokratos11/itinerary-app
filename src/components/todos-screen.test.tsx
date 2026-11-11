import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodosScreen } from "@/components/todos-screen";
import type { TodoListRecord, TodoRecord } from "@/domain/schemas";
import { useAuthStore } from "@/lib/auth-store";
import { saveRecord } from "@/lib/trip-actions";
import { useTripStore } from "@/lib/trip-store";
import { fixtureTrip } from "@/test/fixture-trip";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/todos/",
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/trip-actions", () => ({
  saveRecord: vi.fn(() => Promise.resolve()),
}));

const NOW = "2026-11-10T00:00:00.000Z";
const list: TodoListRecord = {
  id: "docs",
  title: "Documents",
  description: "Everything to carry",
  color: "#0d9488",
  order: 0,
  archived: false,
  updatedAt: NOW,
};
const todo = (over: Partial<TodoRecord>): TodoRecord => ({
  id: "t1",
  listId: "docs",
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
});

describe("TodosScreen", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
    vi.mocked(saveRecord).mockClear();
    useAuthStore.setState({ tripId: "trip-1", access: "member", trips: [] });
    useTripStore.setState({
      data: {
        ...fixtureTrip,
        todoLists: [list],
        todos: [
          todo({ id: "a", dueDate: "2026-11-08" }),
          todo({ id: "b", title: "Print JR pass", order: 1 }),
          todo({ id: "c", title: "Book eSIM", status: "done", order: 2 }),
        ],
      },
    });
  });

  it("asks for a first list when there are none", () => {
    useTripStore.setState({
      data: { ...fixtureTrip, todoLists: [], todos: [] },
    });
    render(<TodosScreen />);
    expect(screen.getByText(/No lists yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New list" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to-do" })).toBeNull();
  });

  it("shows open to-dos first, with late ones marked", () => {
    render(<TodosScreen />);
    expect(screen.getByText("Renew passports")).toBeInTheDocument();
    expect(screen.getByText("Print JR pass")).toBeInTheDocument();
    expect(screen.queryByText("Book eSIM")).toBeNull();
    expect(screen.getByText(/^Late, due/)).toBeInTheDocument();
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Done" }));
    expect(screen.getByText("Book eSIM")).toBeInTheDocument();
    expect(screen.queryByText("Renew passports")).toBeNull();
  });

  it("checks a to-do off and keeps when", () => {
    render(<TodosScreen />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mark Renew passports done" }),
    );
    expect(saveRecord).toHaveBeenCalledWith(
      "trip-1",
      "todos",
      expect.objectContaining({ id: "a", status: "done", completedAt: NOW }),
    );
  });

  it("archives a list with its to-dos instead of deleting", () => {
    render(<TodosScreen />);
    // Phones pick the list from the menu; the wide list buttons do the same.
    const lists = screen.getByRole("navigation", { name: "Lists" });
    fireEvent.click(within(lists).getByRole("button", { name: /Documents/ }));
    fireEvent.click(screen.getByRole("button", { name: "Archive list" }));
    const saved = vi.mocked(saveRecord).mock.calls.map(([, name, record]) => [
      name,
      record.id,
      record.archived,
    ]);
    expect(saved).toEqual(
      expect.arrayContaining([
        ["todos", "a", true],
        ["todos", "b", true],
        ["todos", "c", true],
        ["todoLists", "docs", true],
      ]),
    );
  });
});
