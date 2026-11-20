import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlavorRadar } from "./FlavorRadar";
import { PalateCloud } from "./PalateCloud";

describe("FlavorRadar", () => {
  it("paints each Family axis in that Family's color", () => {
    render(
      <FlavorRadar
        spokes={[
          { label: "Fruity", color: "Orange", cellar: 1, open: 1 },
          { label: "Peaty", color: "Green", cellar: 0.5, open: 0 },
          { label: "Sweet", color: "Yellow", cellar: 0, open: 0 },
        ]}
        takeaway="Open bottles lean Fruity."
      />,
    );
    expect(screen.getByText("Fruity")).toHaveClass("wheel-orange");
    expect(screen.getByText("Peaty")).toHaveClass("wheel-green");
    expect(screen.getByText("Sweet")).toHaveClass("wheel-yellow");
  });
});

describe("PalateCloud", () => {
  it("shows Descriptors under their Family, in that Family's color", () => {
    render(
      <PalateCloud groups={[{ family: "Fruity", color: "Orange", descriptors: [{ label: "orange", count: 2 }] }]} />,
    );
    expect(screen.getByRole("heading", { name: "Fruity" }).closest("section")).toHaveClass("wheel-orange");
    expect(screen.getByText("orange")).toBeInTheDocument();
  });
});
