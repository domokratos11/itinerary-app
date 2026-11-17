import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NumberHelper, NumberHelperBody } from "@/components/number-helper";
import { setLocale } from "@/lib/i18n";

let wide = false;
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => wide }));

const speak = vi.fn();

function withSpeech() {
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      lang = "";
      rate = 1;
      constructor(public text: string) {}
    },
  );
}

beforeEach(() => {
  wide = false;
  speak.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setLocale("en");
});

describe("NumberHelperBody", () => {
  it("reads a price in Japanese and says it aloud", async () => {
    withSpeech();
    render(<NumberHelperBody />);
    const input = screen.getByLabelText("Price in yen");
    expect(input).toHaveAttribute("inputmode", "numeric");
    await userEvent.type(input, "1,980");
    const written = screen.getByText("千九百八十円");
    expect(written).toHaveAttribute("lang", "ja");
    expect(screen.getByText("せんきゅうひゃくはちじゅうえん")).toBeVisible();
    expect(screen.getByText("sen kyuuhyaku hachijuu en")).toBeVisible();
    expect(screen.getByText("1,980円")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: /^Listen to せんきゅうひゃく/ }),
    );
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "せんきゅうひゃくはちじゅうえん",
        lang: "ja-JP",
        rate: 0.85,
      }),
    );
  });

  it("has no Listen button without speech", async () => {
    render(<NumberHelperBody />);
    await userEvent.type(screen.getByLabelText("Price in yen"), "540");
    expect(screen.getByText("五百四十円")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Listen/ }),
    ).not.toBeInTheDocument();
  });

  it("explains empty, invalid and out-of-range input", async () => {
    render(<NumberHelperBody />);
    expect(
      screen.getByText("Type a number to see how it's read in Japanese."),
    ).toBeVisible();
    const input = screen.getByLabelText("Price in yen");
    await userEvent.type(input, "12a");
    expect(
      screen.getByText(
        "That isn't a whole number. Use digits only, like 1980.",
      ),
    ).toBeVisible();
    expect(input).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(input);
    await userEvent.type(input, "1000000000000");
    expect(
      screen.getByText("Use a number from 0 to 999,999,999,999."),
    ).toBeVisible();
  });

  it("fills in a tapped example", async () => {
    render(<NumberHelperBody />);
    await userEvent.click(screen.getByRole("button", { name: "12,800" }));
    expect(screen.getByLabelText("Price in yen")).toHaveValue("12,800");
    expect(screen.getByText("一万二千八百円")).toBeVisible();
  });

  it("reads a time in its 24-hour, 12-hour and half-past forms", async () => {
    render(<NumberHelperBody />);
    await userEvent.click(screen.getByRole("tab", { name: "Time" }));
    await userEvent.type(screen.getByLabelText("Time, 24-hour"), "1530");
    expect(screen.getByText("24-hour, as on timetables")).toBeVisible();
    expect(screen.getByText("15時30分")).toBeVisible();
    expect(screen.getByText("juugoji sanjuppun")).toBeVisible();
    expect(screen.getByText("12-hour, as people say it")).toBeVisible();
    expect(screen.getByText("午後3時30分")).toBeVisible();
    expect(screen.getByText("Half past")).toBeVisible();
    expect(screen.getByText("gogo sanji han")).toBeVisible();
  });

  it("refuses a time past 23:59", async () => {
    render(<NumberHelperBody />);
    await userEvent.click(screen.getByRole("tab", { name: "Time" }));
    await userEvent.type(screen.getByLabelText("Time, 24-hour"), "25:00");
    expect(screen.getByText("Use a time from 0:00 to 23:59.")).toBeVisible();
  });

  it("counts with the chosen counter, with the readings also heard", async () => {
    withSpeech();
    render(<NumberHelperBody />);
    await userEvent.click(screen.getByRole("tab", { name: "Counter" }));
    expect(
      screen.getByText(
        "Things in general, up to ten: items, orders, portions.",
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: /Nights/ }));
    expect(screen.getByText("Nights at a hotel or ryokan.")).toBeVisible();
    await userEvent.type(screen.getByLabelText("How many"), "4");
    expect(screen.getByText("4泊")).toBeVisible();
    expect(screen.getByText("よんぱく")).toBeVisible();
    expect(screen.getByText("Also heard")).toBeVisible();
    expect(screen.getByText("よんはく")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Listen to よんはく" }),
    ).toBeVisible();
  });

  it("keeps つ counts to ten", async () => {
    render(<NumberHelperBody />);
    await userEvent.click(screen.getByRole("tab", { name: "Counter" }));
    await userEvent.type(screen.getByLabelText("How many"), "11");
    expect(screen.getByText("Use a number from 1 to 10.")).toBeVisible();
  });

  it("is in Spanish", async () => {
    setLocale("es");
    render(<NumberHelperBody />);
    await userEvent.type(screen.getByLabelText("Precio en yenes"), "1.980");
    expect(screen.getByText("千九百八十円")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Contador" })).toBeVisible();
  });
});

describe.each([
  ["a drawer on phones", false],
  ["a sheet on desktop", true],
])("the number helper as %s", (_name, isWide) => {
  it("opens from its button", async () => {
    wide = isWide;
    render(<NumberHelper />);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Numbers, prices and times in Japanese",
      }),
    );
    const panel = await screen.findByRole("dialog", {
      name: "Numbers in Japanese",
    });
    expect(panel).toHaveTextContent(
      "Type a price, number, time or count to see and hear how it's said.",
    );
    expect(screen.getByRole("tab", { name: "Price" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
