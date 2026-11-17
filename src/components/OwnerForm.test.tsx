import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bottle, WheelFamily } from "../types";
import { visitBottle } from "../test/visitCatalog";
import { OwnerForm } from "./OwnerForm";

const wheel: WheelFamily[] = [
  {
    name: "Fruity",
    color: "Orange",
    subgroups: [
      { name: "Citric", descriptors: ["orange", "lemon zest"] },
      { name: "Dried Fruit", descriptors: ["raisin"] },
    ],
  },
  { name: "Peaty", color: "Green", subgroups: [{ name: "Medicinal", descriptors: ["iodine"] }] },
];

afterEach(() => cleanup());

function renderForm(initial?: Bottle) {
  const onSave = vi.fn();
  render(<OwnerForm initial={initial} wheel={wheel} caskTags={[]} onSave={onSave} onCancel={() => {}} />);
  return onSave;
}

function field(label: string): HTMLElement {
  return screen.getByText(label, { selector: ".chipset-label" }).closest(".chipset") as HTMLElement;
}

function chipNames(label: string): string[] {
  return within(field(label))
    .queryAllByRole("button")
    .filter((button) => button.classList.contains("chip"))
    .map((button) => button.textContent ?? "");
}

function isPressed(label: string, name: string): boolean {
  return within(field(label)).getByRole("button", { name }).getAttribute("aria-pressed") === "true";
}

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, name: string) {
  await user.click(within(field(label)).getByRole("button", { name }));
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Distillery / Producer"), "Ardbeg");
  await user.type(screen.getByLabelText("Bottling"), "10");
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("owner form wheel fields", () => {
  it("shows Family, Subgroup, and Descriptor in place of Flavor families and Sub-characteristics", () => {
    renderForm();
    expect(screen.queryByText("Flavor families")).toBeNull();
    expect(screen.queryByText("Sub-characteristics")).toBeNull();
    expect(field("Family")).toBeDefined();
    expect(field("Subgroup")).toBeDefined();
    expect(field("Descriptor")).toBeDefined();
  });

  it("offers only wheel terms, scoped under the picked Families and Subgroups", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(chipNames("Family")).toEqual(["Fruity", "Peaty"]);
    expect(within(field("Subgroup")).getByText("Pick a Family to narrow by Subgroup.")).toBeDefined();

    await pick(user, "Family", "Fruity");
    expect(chipNames("Subgroup")).toEqual(["Citric", "Dried Fruit"]);

    await pick(user, "Subgroup", "Citric");
    expect(chipNames("Descriptor")).toEqual(["orange", "lemon zest"]);

    await pick(user, "Family", "Peaty");
    expect(chipNames("Subgroup")).toEqual(["Citric", "Dried Fruit", "Medicinal"]);
  });

  it("drops the Subgroups and Descriptors under a Family that is unpicked", async () => {
    const user = userEvent.setup();
    renderForm();

    await pick(user, "Family", "Fruity");
    await pick(user, "Subgroup", "Citric");
    await pick(user, "Family", "Fruity");
    expect(within(field("Descriptor")).getByText("Pick a Subgroup to narrow by Descriptor.")).toBeDefined();

    await pick(user, "Family", "Fruity");
    expect(isPressed("Subgroup", "Citric")).toBe(false);
  });
});

describe("owner form stray terms", () => {
  it("lists a stray term the bottle already has as pressed, and keeps it on save", async () => {
    const user = userEvent.setup();
    const onSave = renderForm(
      visitBottle({
        id: "b1",
        distillery: "Ardbeg",
        bottling: "10",
        wheelFamilies: ["Fruity", "Smoky"],
        wheelSubgroups: ["Citric"],
        wheelDescriptors: ["orange", "raisins"],
      }),
    );

    expect(chipNames("Family")).toContain("Smoky");
    expect(isPressed("Family", "Smoky")).toBe(true);
    expect(isPressed("Descriptor", "raisins")).toBe(true);

    await save(user);
    const saved = onSave.mock.calls[0][0] as Bottle;
    expect(saved.wheelFamilies).toEqual(["Fruity", "Smoky"]);
    expect(saved.wheelDescriptors).toEqual(["orange", "raisins"]);
  });

  it("removes a stray Family when the owner unpicks it", async () => {
    const user = userEvent.setup();
    const onSave = renderForm(
      visitBottle({ id: "b1", distillery: "Ardbeg", bottling: "10", wheelFamilies: ["Fruity", "Smoky"] }),
    );

    await pick(user, "Family", "Smoky");
    await save(user);

    expect((onSave.mock.calls[0][0] as Bottle).wheelFamilies).toEqual(["Fruity"]);
  });

  it("lists a wheel term under no picked parent, so the owner can see and remove it", async () => {
    const user = userEvent.setup();
    const onSave = renderForm(visitBottle({ id: "b1", distillery: "Ardbeg", bottling: "10", wheelDescriptors: ["iodine"] }));

    expect(isPressed("Descriptor", "iodine")).toBe(true);

    await pick(user, "Descriptor", "iodine");
    await save(user);

    expect((onSave.mock.calls[0][0] as Bottle).wheelDescriptors).toEqual([]);
  });

  it("keeps a term under no picked parent when the owner picks an unrelated Family", async () => {
    const user = userEvent.setup();
    const onSave = renderForm(visitBottle({ id: "b1", distillery: "Ardbeg", bottling: "10", wheelDescriptors: ["iodine"] }));

    await pick(user, "Family", "Fruity");
    await save(user);

    expect((onSave.mock.calls[0][0] as Bottle).wheelDescriptors).toEqual(["iodine"]);
  });

  it("shows a Family spelled differently on the bottle as the Wheel Glossary writes it", () => {
    renderForm(visitBottle({ id: "b1", distillery: "Ardbeg", bottling: "10", wheelFamilies: ["fruity"] }));
    expect(isPressed("Family", "Fruity")).toBe(true);
  });
});

describe("owner form save", () => {
  it("saves the picked Families, Subgroups, and Descriptors on the bottle", async () => {
    const user = userEvent.setup();
    const onSave = renderForm();
    await fillRequired(user);

    await pick(user, "Family", "Fruity");
    await pick(user, "Subgroup", "Citric");
    await pick(user, "Descriptor", "orange");
    await save(user);

    const saved = onSave.mock.calls[0][0] as Bottle;
    expect(saved.wheelFamilies).toEqual(["Fruity"]);
    expect(saved.wheelSubgroups).toEqual(["Citric"]);
    expect(saved.wheelDescriptors).toEqual(["orange"]);
  });
});
