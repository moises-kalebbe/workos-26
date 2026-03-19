import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "@/components/system/top-bar";

const pushMock = vi.fn();
const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: pushMock }),
}));

describe("TopBar", () => {
  beforeEach(() => {
    pushMock.mockReset();
    usePathnameMock.mockReturnValue("/");
    vi.restoreAllMocks();
  });

  it("renders weather summary for Limeira when request succeeds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 25.2,
          weather_code: 1,
          is_day: 1,
        },
      }),
    } as Response);

    render(<TopBar />);

    expect(screen.getByText("Limeira, SP")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("25°C | Quase limpo")).toBeInTheDocument();
    });
  });

  it("shows weather fallback when request fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"));

    render(<TopBar />);

    await waitFor(() => {
      expect(screen.getByText("Clima indisponível")).toBeInTheDocument();
    });
  });

  it("opens quick search and navigates when an item is selected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 23,
          weather_code: 0,
          is_day: 1,
        },
      }),
    } as Response);

    render(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: /abrir busca rápida/i }));

    const kanbanItem = await screen.findByText("Kanban");
    fireEvent.click(kanbanItem);

    expect(pushMock).toHaveBeenCalledWith("/kanban");
  });

  it("toggles quick search with keyboard shortcut", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 21,
          weather_code: 3,
          is_day: 0,
        },
      }),
    } as Response);

    render(<TopBar />);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByPlaceholderText("Ir para uma página...")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Ir para uma página...")).not.toBeInTheDocument();
    });
  });
});
