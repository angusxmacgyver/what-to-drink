import { useState } from "react";
import type { Bottle, WheelFamily } from "../types";
import { countryFromRegion } from "../lib/normalize";
import { optionSpelling, ownerOptions, dropUnder, sameTerm, type WheelLevel } from "../lib/wheel";
import { wheelTermClass } from "../lib/colors";
import { ChipSelect } from "./ChipSelect";

/** The picked terms as the Wheel spells them where the option list has them. */
const spelled = (options: string[], picked: string[]) => picked.map((term) => optionSpelling(options, term) ?? term);

/** Picks in `before` that `after` no longer has. */
const removedFrom = (before: string[], after: string[]) =>
  before.filter((term) => !after.some((kept) => sameTerm(kept, term)));

function slugKey(distillery: string, bottling: string): string {
  const slug = (v: string) =>
    v
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `${slug(distillery)}::${slug(bottling)}`;
}

const blank = (): Bottle => ({
  id: globalThis.crypto.randomUUID(),
  bottleKey: "",
  distillery: "",
  bottling: "",
  age: null,
  abv: null,
  status: "Closed",
  notes: "",
  tastingNotes: "",
  location: "",
  region: "",
  theme: "",
  flavorFamilies: [],
  subCharacteristics: [],
  wheelFamilies: [],
  wheelSubgroups: [],
  wheelDescriptors: [],
  primaryCask: [],
  secondaryCask: [],
  atApartment: false,
  country: "",
  dateEmptied: "",
  smws: null,
  drams: [],
  lastThird: false,
  killShot: false,
});

export function OwnerForm({
  initial,
  wheel,
  caskTags,
  onSave,
  onCancel,
}: {
  initial?: Bottle;
  /** The Flavor Wheel the cellar stores, which offers the Family, Subgroup, and Descriptor choices. */
  wheel: WheelFamily[];
  /** Every cask tag already in the cellar, offered for both cask fields. */
  caskTags: string[];
  onSave: (bottle: Bottle) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Bottle>(initial ?? blank());

  const set = (patch: Partial<Bottle>) => setForm((prev) => ({ ...prev, ...patch }));

  const families = ownerOptions(wheel, "family", [], form.wheelFamilies);
  const subgroups = ownerOptions(wheel, "subgroup", form.wheelFamilies, form.wheelSubgroups);
  const descriptors = ownerOptions(wheel, "descriptor", form.wheelSubgroups, form.wheelDescriptors);
  const colorOf = (level: WheelLevel) => (term: string) => wheelTermClass(wheel, level, term);

  return (
    <form
      className="owner-form"
      onSubmit={(e) => {
        e.preventDefault();
        const bottle: Bottle = {
          ...form,
          bottleKey: form.bottleKey || slugKey(form.distillery, form.bottling),
          country: form.country || countryFromRegion(form.region),
        };
        onSave(bottle);
      }}
    >
      <h2>{initial ? "Edit bottle" : "Add bottle"}</h2>
      <p className="hint">Distillery and expression are enough to save. Fill the rest later.</p>
      <label>
        Distillery / Producer
        <input
          required
          value={form.distillery}
          onChange={(e) => set({ distillery: e.target.value })}
        />
      </label>
      <label>
        Bottling
        <input required value={form.bottling} onChange={(e) => set({ bottling: e.target.value })} />
      </label>
      <label>
        Age
        <input
          value={form.age == null ? "" : String(form.age)}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (!v) set({ age: null });
            else if (/^nas$/i.test(v)) set({ age: "NAS" });
            else set({ age: Number(v) });
          }}
        />
      </label>
      <label>
        ABV %
        <input
          value={form.abv == null ? "" : String(form.abv)}
          onChange={(e) => set({ abv: e.target.value ? Number(e.target.value) : null })}
        />
      </label>
      <label>
        Status
        <select
          value={form.status}
          onChange={(e) => set({ status: e.target.value as Bottle["status"] })}
        >
          <option>Open</option>
          <option>Closed</option>
        </select>
      </label>
      <label>
        Location
        <input value={form.location} onChange={(e) => set({ location: e.target.value })} />
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={form.atApartment}
          onChange={(e) => set({ atApartment: e.target.checked })}
        />
        Apartment
      </label>
      <label>
        Region
        <input
          value={form.region}
          onChange={(e) => set({ region: e.target.value, country: countryFromRegion(e.target.value) })}
        />
      </label>
      <label>
        SMWS Theme
        <input value={form.theme} onChange={(e) => set({ theme: e.target.value })} />
      </label>
      <ChipSelect
        label="Family"
        options={families}
        value={spelled(families, form.wheelFamilies)}
        onChange={(nextFamilies) => {
          const removed = removedFrom(form.wheelFamilies, nextFamilies);
          const kept = dropUnder(wheel, "subgroup", removed, form.wheelSubgroups);
          set({
            wheelFamilies: nextFamilies,
            wheelSubgroups: kept,
            wheelDescriptors: dropUnder(
              wheel,
              "descriptor",
              removedFrom(form.wheelSubgroups, kept),
              form.wheelDescriptors,
            ),
          });
        }}
        colorFor={colorOf("family")}
      />
      <ChipSelect
        label="Subgroup"
        options={subgroups}
        value={spelled(subgroups, form.wheelSubgroups)}
        onChange={(nextSubgroups) =>
          set({
            wheelSubgroups: nextSubgroups,
            wheelDescriptors: dropUnder(
              wheel,
              "descriptor",
              removedFrom(form.wheelSubgroups, nextSubgroups),
              form.wheelDescriptors,
            ),
          })
        }
        emptyHint="Pick a Family to narrow by Subgroup."
        colorFor={colorOf("subgroup")}
      />
      <ChipSelect
        label="Descriptor"
        options={descriptors}
        value={spelled(descriptors, form.wheelDescriptors)}
        onChange={(nextDescriptors) => set({ wheelDescriptors: nextDescriptors })}
        emptyHint="Pick a Subgroup to narrow by Descriptor."
        colorFor={colorOf("descriptor")}
      />
      <ChipSelect
        label="Primary cask"
        options={caskTags}
        value={form.primaryCask}
        onChange={(primaryCask) => set({ primaryCask })}
        emptyHint="No cask tags yet. Add them in the workbook."
      />
      <ChipSelect
        label="Secondary cask"
        options={caskTags}
        value={form.secondaryCask}
        onChange={(secondaryCask) => set({ secondaryCask })}
        emptyHint="No cask tags yet. Add them in the workbook."
      />
      <label>
        Notes
        <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <label>
        Tasting notes
        <textarea value={form.tastingNotes} onChange={(e) => set({ tastingNotes: e.target.value })} />
      </label>
      <div className="owner-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
