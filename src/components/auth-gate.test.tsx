import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { signInWithGoogle } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";

let tripId: string | null = "trip-1";
vi.mock("@/lib/use-trip-id", () => ({ useTripId: () => tripId }));
vi.mock("@/lib/auth", () => ({ signInWithGoogle: vi.fn(), signOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const user = { uid: "u1", email: "ana@example.com", name: "Ana" };

describe("AuthGate", () => {
  beforeEach(() => {
    tripId = "trip-1";
    useAuthStore.setState({
      status: "loading",
      user: null,
      access: "checking",
    });
    vi.mocked(signInWithGoogle).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("asks for nothing on the trip-less preview", () => {
    tripId = null;
    useAuthStore.setState({ status: "signed-out" });
    render(<AuthGate />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits quietly while sign-in is still loading", () => {
    render(<AuthGate />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("covers the trip until someone signs in", () => {
    useAuthStore.setState({ status: "signed-out" });
    render(<AuthGate />);
    expect(
      screen.getByRole("dialog", { name: "Sign in to open the trip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeInTheDocument();
  });

  it("shows why a sign-in failed", async () => {
    useAuthStore.setState({ status: "signed-out" });
    vi.mocked(signInWithGoogle).mockRejectedValue(new Error("Blocked pop-up"));
    render(<AuthGate />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with Google" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Blocked pop-up"),
    );
  });

  it("names the account that isn't a member", () => {
    useAuthStore.setState({ status: "signed-in", user, access: "denied" });
    render(<AuthGate />);
    expect(
      screen.getByRole("dialog", { name: "Not on this trip" }),
    ).toHaveTextContent("ana@example.com");
    expect(
      screen.getByRole("button", { name: "Use another account" }),
    ).toBeInTheDocument();
  });

  it("gets out of the way for a member", () => {
    useAuthStore.setState({ status: "signed-in", user, access: "member" });
    render(<AuthGate />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
