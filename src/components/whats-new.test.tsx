import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VersionTag } from "@/components/app-header";
import { setLocale } from "@/lib/i18n";

let wide = false;
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => wide }));
vi.mock("@/lib/app-reset", () => ({ APP_VERSION: "1.2.3", resetApp: vi.fn() }));
vi.mock("@/lib/auth", () => ({ signInWithGoogle: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/trip-repository-instance", () => ({ tripRepository: {} }));
vi.mock("@/lib/user-repository-instance", () => ({ userRepository: {} }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => setLocale("en"));

describe.each([
  ["a drawer on phones", false],
  ["a dialog on wide screens", true],
])("the what's new panel as %s", (_name, isWide) => {
  it("opens from the version and lists the changes", async () => {
    wide = isWide;
    render(<VersionTag />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open what's new" }),
    );
    expect(await screen.findByText("What's new")).toBeInTheDocument();
    expect(
      screen.getByText(/Version 1\.2\.3 · Nov 12, 2026/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tap the version to see what's new."),
    ).toBeInTheDocument();
  });

  it("is in Spanish", async () => {
    wide = isWide;
    setLocale("es");
    render(<VersionTag />);
    await userEvent.click(
      screen.getByRole("button", { name: "Abrir las novedades" }),
    );
    expect(await screen.findByText("Novedades")).toBeInTheDocument();
    expect(
      screen.getByText("Toca la versión para ver las novedades."),
    ).toBeInTheDocument();
  });
});
