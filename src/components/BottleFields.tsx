import type { Bottle } from "../types";

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function NoteCard({ label, body }: { label: string; body: string }) {
  if (!body) return null;
  return (
    <article className="note-card">
      <h3>{label}</h3>
      <p>{body}</p>
    </article>
  );
}

export function BottleFields({ bottle, flavorText = true }: { bottle: Bottle; flavorText?: boolean }) {
  const hasNotes = Boolean(bottle.notes);
  const hasTasting = Boolean(bottle.tastingNotes);

  return (
    <div className="bottle-fields">
      {hasNotes || hasTasting ? (
        <div className={hasNotes && hasTasting ? "notes-stage" : "notes-stage solo"}>
          <NoteCard label="Notes" body={bottle.notes} />
          <NoteCard label="Tasting notes" body={bottle.tastingNotes} />
        </div>
      ) : null}
      <dl className="fields">
        <Field label="Distillery / Producer" value={bottle.distillery} />
        <Field label="Bottling" value={bottle.bottling} />
        <Field label="Age" value={bottle.age == null ? "" : String(bottle.age)} />
        <Field label="ABV %" value={bottle.abv == null ? "" : String(bottle.abv)} />
        <Field label="Status" value={bottle.status} />
        <Field label="Location" value={bottle.location || "—"} />
        <Field label="Region" value={bottle.region} />
        <Field label="Theme" value={bottle.theme} />
        {flavorText ? (
          <>
            <Field label="Flavor families" value={bottle.flavorFamilies.join(" · ")} />
            <Field label="Sub-characteristics" value={bottle.subCharacteristics.join(" · ")} />
          </>
        ) : null}
        {bottle.smws ? (
          <>
            <Field label="Full code" value={bottle.smws.fullCode} />
            <Field label="Distillery no." value={bottle.smws.distilleryNo} />
            <Field label="Cask no." value={bottle.smws.caskNo} />
            <Field label="Flavor profile" value={bottle.smws.flavorProfile} />
            <Field label="SMWS cask" value={bottle.smws.smwsCask} />
            <Field label="Secondary maturation" value={bottle.smws.secondaryMaturation} />
            <Field label="Name (intl)" value={bottle.smws.nameIntl} />
            <Field label="Vintage" value={bottle.smws.vintage} />
            {bottle.smws.smwsUrl ? (
              <div className="field">
                <dt>SMWS</dt>
                <dd>
                  <a href={bottle.smws.smwsUrl} target="_blank" rel="noreferrer">
                    Society listing
                  </a>
                </dd>
              </div>
            ) : null}
          </>
        ) : null}
        {bottle.dateEmptied ? (
          <Field
            label="Date finished"
            value={/unknown/i.test(bottle.dateEmptied) ? "Unknown" : bottle.dateEmptied}
          />
        ) : null}
      </dl>
    </div>
  );
}
