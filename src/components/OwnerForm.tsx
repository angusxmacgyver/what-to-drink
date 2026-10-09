import { useState } from "react";
import type { Bottle } from "../types";
import { countryFromRegion } from "../lib/normalize";

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
  atApartment: false,
  country: "",
  dateEmptied: "",
  smws: null,
});

export function OwnerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Bottle;
  onSave: (bottle: Bottle) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Bottle>(initial ?? blank());

  const set = (patch: Partial<Bottle>) => setForm((prev) => ({ ...prev, ...patch }));

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
