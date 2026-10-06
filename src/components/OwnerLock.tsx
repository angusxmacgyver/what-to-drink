import { useEffect, useId, useRef, useState } from "react";

type Props = {
  owner: boolean;
  onUnlock: (pin: string) => Promise<boolean>;
  onLock: () => void;
  onManage: () => void;
};

export function OwnerLock({ owner, onUnlock, onLock, onManage }: Props) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const pinId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setPin("");
    setError("");
  };

  return (
    <div className="lock-wrap" ref={rootRef}>
      <button
        type="button"
        className="lock-toggle"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={owner ? "Owner tools" : "Enter owner PIN"}
        title={owner ? "Owner tools" : "Enter owner PIN"}
        onClick={() => setOpen((value) => !value)}
      >
        {owner ? <OpenPadlock /> : <LockedPadlock />}
      </button>
      {open ? (
        <div className="lock-popover" role="dialog" aria-label={owner ? "Owner tools" : "Owner PIN"}>
          {owner ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onManage();
                  close();
                }}
              >
                Bottle Management
              </button>
              <button
                type="button"
                onClick={() => {
                  onLock();
                  close();
                }}
              >
                Lock
              </button>
            </>
          ) : (
            <form
              className="owner-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onUnlock(pin).then((ok) => {
                  if (ok) close();
                  else setError("PIN did not match.");
                });
              }}
            >
              <label htmlFor={pinId}>Owner PIN</label>
              <input
                id={pinId}
                type="password"
                value={pin}
                autoFocus
                onChange={(event) => {
                  setPin(event.target.value);
                  setError("");
                }}
              />
              {error ? <p className="lock-error">{error}</p> : null}
              <button type="submit">Unlock</button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LockedPadlock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function OpenPadlock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0" />
    </svg>
  );
}
