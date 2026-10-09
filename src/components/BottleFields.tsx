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

function pertinentFields(bottle: Bottle) {
  return (
    <>
      <Field label="Age" value={bottle.age == null ? "" : String(bottle.age)} />
      <Field label="ABV %" value={bottle.abv == null ? "" : String(bottle.abv)} />
      <Field label="Status" value={bottle.status} />
      <Field label="Location" value={bottle.location || "—"} />
      <Field label="Region" value={bottle.region} />
      <Field label="SMWS Theme" value={bottle.theme} />
    </>
  );
}

function hasExtraFields(bottle: Bottle, flavorText: boolean) {
  return (
    (flavorText && (bottle.flavorFamilies.length > 0 || bottle.subCharacteristics.length > 0)) ||
    Boolean(bottle.smws) ||
    Boolean(bottle.dateEmptied)
  );
}

export function BottleFields({
  bottle,
  flavorText = true,
  factsFirst = false,
}: {
  bottle: Bottle;
  flavorText?: boolean;
  factsFirst?: boolean;
}) {
  const hasNotes = Boolean(bottle.notes);
  const hasTasting = Boolean(bottle.tastingNotes);
  const notes =
    hasNotes || hasTasting ? (
      <div className={hasNotes && hasTasting ? "notes-stage" : "notes-stage solo"}>
        <NoteCard label="Notes" body={bottle.notes} />
        <NoteCard label="Tasting notes" body={bottle.tastingNotes} />
      </div>
    ) : null;
  const extra = (
    <>
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
    </>
  );

  if (factsFirst) {
    return (
      <div className="bottle-fields">
        <dl className="fields fields-lead">{pertinentFields(bottle)}</dl>
        {notes}
        {hasExtraFields(bottle, flavorText) ? <dl className="fields">{extra}</dl> : null}
      </div>
    );
  }

  return (
    <div className="bottle-fields">
      {notes}
      <dl className="fields">
        <Field label="Distillery / Producer" value={bottle.distillery} />
        <Field label="Bottling" value={bottle.bottling} />
        {pertinentFields(bottle)}
        {extra}
      </dl>
    </div>
  );
}
