import { useRef, useState } from "react";
import { emptyFilters, type FilterState } from "../types";
import { popHistory, pushHistory } from "./recovery";

export function useUndoableFilters(initial: FilterState = emptyFilters()) {
  const [filters, setFilters] = useState(initial);
  const undoStack = useRef<FilterState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const change = (next: FilterState) => {
    undoStack.current = pushHistory(undoStack.current, filters);
    setCanUndo(true);
    setFilters(next);
  };

  const undo = () => {
    const popped = popHistory(undoStack.current);
    undoStack.current = popped.stack;
    setCanUndo(popped.stack.length > 0);
    if (popped.previous) setFilters(popped.previous);
  };

  return { filters, change, undo, canUndo, setFilters };
}
