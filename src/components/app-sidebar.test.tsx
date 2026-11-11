import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar, AppSidebarProvider } from "@/components/app-sidebar";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

describe("AppSidebar", () => {
  // A short window still reaches every day, collapsed or not.
  it("scrolls its content, with a visible bar, also as a rail of icons", () => {
    localStorage.setItem("sidebar-open", "false");
    const { container } = render(
      <AppSidebarProvider>
        <AppSidebar />
      </AppSidebarProvider>,
    );
    const content = container.querySelector('[data-slot="sidebar-content"]');
    expect(content).toHaveClass(
      "thin-scrollbar",
      "group-data-[collapsible=icon]:overflow-y-auto",
    );
    expect(content).not.toHaveClass("no-scrollbar");
    expect(content?.className).not.toContain(
      "group-data-[collapsible=icon]:overflow-hidden",
    );
    localStorage.removeItem("sidebar-open");
  });
});
