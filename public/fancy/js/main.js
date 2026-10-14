import { Sound } from "./audio.js";
import { buildEntries, consumePool, describe, entryForBottle, pickBottle } from "./data.js";
import { Stage } from "./scene.js";

const TAU = Math.PI * 2;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const timing = reduceMotion
  ? { intro: 0.35, spin: 1.5, collapse: 0.35, reveal: 0.55, drink: 1.8 }
  : { intro: 1.0, spin: 5.6, collapse: 0.9, reveal: 1.25, drink: 4.8 };
const easeOut = (value) => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 4);

const bottles = consumePool();
const entries = buildEntries(bottles);
const canvas = document.querySelector("#gl");
const labelsRoot = document.querySelector("#labels");
const result = document.querySelector("#result");
const empty = document.querySelector("#empty");
const enjoy = document.querySelector("#enjoy");
const stage = new Stage(canvas);
const sound = new Sound();
const slots = Array.from({ length: 12 }, (_, index) => {
  const label = document.createElement("div");
  label.className = "slot";
  label.innerHTML = '<span class="slot-title"></span><span class="slot-sub"></span>';
  labelsRoot.append(label);
  return { label, index, entry: null };
});

let phase = bottles.length ? "intro" : "empty";
let phaseStarted = performance.now();
let angle = -0.35;
let spinFrom = angle;
let spinTo = angle;
let picked = null;
let pickedEntry = null;
let previousId = null;
let lastSlot = 0;

document.querySelector("#count").textContent = bottles.length
  ? `${bottles.length} ${bottles.length === 1 ? "bottle" : "bottles"} in the wheel`
  : "";

function randomEntry(exceptKey = "") {
  const choices = entries.length > 1 ? entries.filter((entry) => entry.key !== exceptKey) : entries;
  return choices[Math.floor(Math.random() * choices.length)];
}

function setSlot(slot, entry) {
  if (!entry || slot.entry === entry) return;
  slot.entry = entry;
  slot.label.querySelector(".slot-title").textContent = entry.wheelTitle;
  slot.label.querySelector(".slot-sub").textContent = entry.wheelSub || "";
}

function seedSlots() {
  slots.forEach((slot) => setSlot(slot, randomEntry(pickedEntry?.key)));
}

function startSpin() {
  if (!bottles.length) return;
  picked = pickBottle(bottles, previousId);
  previousId = picked.id;
  pickedEntry = entryForBottle(bottles, picked);
  spinFrom = angle;
  spinTo = spinFrom + TAU * (reduceMotion ? 1.5 : 4.4 + Math.random() * 0.8);
  lastSlot = Math.floor(spinFrom / (TAU / slots.length));
  seedSlots();
  result.hidden = true;
  result.classList.remove("show");
  phase = "spin";
  phaseStarted = performance.now();
  sound.release();
}

function fillResult() {
  const info = describe(pickedEntry);
  document.querySelector("#name").textContent = info.title;
  document.querySelector("#bottling").textContent = info.subtitle;
  document.querySelector("#meta").textContent = info.meta.join(" · ");
  document.querySelector("#theme").textContent = info.theme;
  document.querySelector("#notes").textContent = info.notes;
  document.querySelector("#find").textContent = `Find it · ${info.location}`;
  const flavors = document.querySelector("#flavors");
  flavors.replaceChildren(
    ...info.flavors.map((flavor) => {
      const item = document.createElement("li");
      item.textContent = flavor;
      return item;
    }),
  );
  document.querySelector("#enjoyName").textContent = [info.title, info.subtitle].filter(Boolean).join(" · ");
}

function beginReveal() {
  fillResult();
  result.hidden = false;
  requestAnimationFrame(() => result.classList.add("show"));
  sound.chime();
}

function placeLabels(visible) {
  const radius = Math.min(innerHeight * 0.43, Math.max(innerWidth * 0.34, 260));
  const centerX = innerWidth / 2;
  const centerY = innerHeight + radius * 0.02;
  slots.forEach((slot) => {
    const slotAngle = angle + (slot.index / slots.length) * TAU;
    const wrapped = Math.atan2(Math.sin(slotAngle), Math.cos(slotAngle));
    const front = Math.max(0, Math.cos(wrapped));
    const x = centerX + Math.sin(slotAngle) * radius;
    const y = centerY - Math.cos(slotAngle) * radius;
    slot.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    slot.label.style.opacity = String(visible * Math.pow(front, 2));
  });
}

function update(now) {
  const elapsed = (now - phaseStarted) / 1000;
  let collapse = 0;
  let labelOpacity = 0;
  let lift = 0;

  if (phase === "intro") {
    labelOpacity = 0;
    if (elapsed >= timing.intro) startSpin();
  } else if (phase === "spin") {
    const progress = Math.min(1, elapsed / timing.spin);
    angle = spinFrom + (spinTo - spinFrom) * easeOut(progress);
    labelOpacity = 1 - Math.max(0, (progress - 0.68) / 0.25);
    const slot = Math.floor(angle / (TAU / slots.length));
    if (slot !== lastSlot) {
      sound.tick(Math.max(0.25, 1 - progress));
      setSlot(slots[Math.abs(slot) % slots.length], randomEntry(pickedEntry.key));
      lastSlot = slot;
    }
    if (progress >= 1) {
      phase = "collapse";
      phaseStarted = now;
    }
  } else if (phase === "collapse") {
    collapse = easeOut(elapsed / timing.collapse);
    if (elapsed >= timing.collapse) {
      phase = "reveal";
      phaseStarted = now;
      beginReveal();
    }
  } else if (phase === "reveal") {
    lift = Math.min(1.4, easeOut(elapsed / timing.reveal) * 1.4);
    if (elapsed >= timing.reveal) phase = "result";
  } else if (phase === "drink") {
    stage.setPour(Math.min(1, elapsed / timing.drink));
    if (elapsed >= timing.drink) {
      phase = "enjoy";
      result.hidden = true;
      enjoy.hidden = false;
      requestAnimationFrame(() => enjoy.classList.add("show"));
      sound.chime();
    }
  }

  if (phase !== "drink" && phase !== "enjoy" && phase !== "empty") {
    stage.setWheel({ angle, collapse, opacity: 0.72, lift });
  }
  placeLabels(labelOpacity);
  stage.render(now / 1000);
  requestAnimationFrame(update);
}

function returnToPicker() {
  if (history.length > 1) {
    history.back();
    window.setTimeout(() => {
      if (location.pathname.includes("/fancy")) location.assign("/");
    }, 500);
  } else {
    location.assign("/");
  }
}

document.querySelectorAll("[data-back], #back").forEach((button) => button.addEventListener("click", returnToPicker));
document.querySelector("#again").addEventListener("click", startSpin);
document.querySelector("#drink").addEventListener("click", () => {
  sound.unlock();
  result.classList.remove("show");
  phase = "drink";
  phaseStarted = performance.now();
  sound.pour();
});
window.addEventListener("pointerdown", () => sound.unlock(), { once: true });
window.addEventListener("resize", stage.resize);
window.addEventListener("pagehide", () => stage.dispose(), { once: true });

if (!bottles.length) {
  empty.hidden = false;
  labelsRoot.hidden = true;
} else {
  seedSlots();
}
requestAnimationFrame(update);
