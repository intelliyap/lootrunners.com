import { useAtomValue, useSetAtom } from "jotai";
import styles from "./Desktop.module.css";
import { ProgramEntry, programsAtom } from "@/state/programs";
import defaultIcon from "./assets/window.png";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { useCreateContextMenu } from "@/state/contextMenu";
import { useServerPrograms } from "@/lib/useServerPrograms";
import { useEffect, useRef, useState, useCallback } from "react";
import cx from "classnames";

const GRID = 96;
const GRID_MOBILE = 88;
const PADDING = 12;
const DRAG_THRESHOLD = 5;
const DOUBLE_CLICK_MS = 400;

function getGridSize() {
  if (typeof window === "undefined") return GRID;
  return window.innerWidth < 768 ? GRID_MOBILE : GRID;
}

function snapToGrid(x: number, y: number, gridSize: number) {
  return {
    col: Math.max(0, Math.round((x - PADDING) / gridSize)),
    row: Math.max(0, Math.round((y - PADDING) / gridSize)),
  };
}

function gridToPixels(col: number, row: number, gridSize: number) {
  return {
    x: PADDING + col * gridSize,
    y: PADDING + row * gridSize,
  };
}

type IconPosition = { col: number; row: number };
type IconPositions = Record<string, IconPosition>;

function getDefaultPositions(programs: ProgramEntry[], existing: IconPositions): IconPositions {
  const positions = { ...existing };
  const occupied = new Set(
    Object.values(positions).map((p) => `${p.col},${p.row}`)
  );
  const maxRows = typeof window !== "undefined"
    ? Math.floor((window.innerHeight - 80) / getGridSize())
    : 6;

  for (const program of programs) {
    if (positions[program.id]) continue;
    let placed = false;
    for (let col = 0; col < 20 && !placed; col++) {
      for (let row = 0; row < maxRows && !placed; row++) {
        const key = `${col},${row}`;
        if (!occupied.has(key)) {
          positions[program.id] = { col, row };
          occupied.add(key);
          placed = true;
        }
      }
    }
  }
  return positions;
}

export const Desktop = () => {
  const { programs } = useAtomValue(programsAtom);
  const dispatch = useSetAtom(programsAtom);
  const { fetchPrograms } = useServerPrograms();
  const didSync = useRef(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconPositions, setIconPositions] = useState<IconPositions>({});

  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;
    fetchPrograms().then((serverPrograms) => {
      if (!serverPrograms || !Array.isArray(serverPrograms)) return;
      for (const sp of serverPrograms) {
        const exists = programs.some((p) => p.id === sp.id);
        if (!exists) {
          dispatch({
            type: "ADD_PROGRAM",
            payload: {
              id: sp.id,
              name: sp.name,
              prompt: sp.prompt,
              code: sp.code ?? undefined,
              icon: sp.icon ?? undefined,
            },
          });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIconPositions((prev) => getDefaultPositions(programs, prev));
  }, [programs]);

  const moveIcon = useCallback((id: string, col: number, row: number) => {
    setIconPositions((prev) => ({ ...prev, [id]: { col, row } }));
  }, []);

  return (
    <div className={styles.desktop} onClick={() => setSelectedIcon(null)}>
      {programs.map((program) => (
        <ProgramIcon
          key={program.name}
          program={program}
          isSelected={selectedIcon === program.id}
          onSelect={() => setSelectedIcon(program.id)}
          position={iconPositions[program.id] || { col: 0, row: 0 }}
          onMove={(col, row) => moveIcon(program.id, col, row)}
        />
      ))}
    </div>
  );
};

function ProgramIcon({
  program,
  isSelected,
  onSelect,
  position,
  onMove: onMoveIcon,
}: {
  program: ProgramEntry;
  isSelected: boolean;
  onSelect: () => void;
  position: IconPosition;
  onMove: (col: number, row: number) => void;
}) {
  const createContextMenu = useCreateContextMenu();
  const dispatch = useSetAtom(programsAtom);
  const { deleteProgram } = useServerPrograms();
  const lastClickRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clean up any leftover drag on unmount
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const runProgram = useCallback(() => {
    createWindow({
      title: program.name,
      program: { type: "iframe", programID: program.id },
      icon: program.icon ?? undefined,
    });
  }, [program]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;

    const now = Date.now();
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      runProgram();
      lastClickRef.current = 0;
    } else {
      onSelect();
      lastClickRef.current = now;
    }
  };

  const startDrag = (startX: number, startY: number) => {
    const gridSize = getGridSize();
    const origin = gridToPixels(position.col, position.row, gridSize);
    isDraggingRef.current = false;

    const onPointerMove = (moveX: number, moveY: number) => {
      const dx = moveX - startX;
      const dy = moveY - startY;

      if (!isDraggingRef.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        setDragging(true);
        onSelect();
      }

      if (isDraggingRef.current) {
        setDragOffset({ x: dx, y: dy });
      }
    };

    const onEnd = (endX: number, endY: number) => {
      cleanup();

      if (isDraggingRef.current) {
        const dx = endX - startX;
        const dy = endY - startY;
        const snapped = snapToGrid(origin.x + dx, origin.y + dy, gridSize);
        onMoveIcon(snapped.col, snapped.row);
      }

      setDragging(false);
      setDragOffset(null);
      // Delay clearing so click handler sees isDraggingRef
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    };

    const onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => onEnd(e.clientX, e.clientY);
    const onBlur = () => {
      // Mouse left window — cancel drag, snap back
      cleanup();
      setDragging(false);
      setDragOffset(null);
      isDraggingRef.current = false;
    };

    const cleanup = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
  };

  const gridSize = getGridSize();
  const basePos = gridToPixels(position.col, position.row, gridSize);
  const pixelPos = dragging && dragOffset
    ? { x: basePos.x + dragOffset.x, y: basePos.y + dragOffset.y }
    : basePos;

  const contextMenuHandlers = createContextMenu([
    { label: "Run", onClick: runProgram },
    {
      label: "Delete",
      onClick: () => {
        dispatch({ type: "REMOVE_PROGRAM", payload: program.name });
        deleteProgram(program.id);
      },
    },
  ]);

  return (
    <button
      className={cx(styles.programIcon, {
        [styles.selected]: isSelected,
        [styles.dragging]: dragging,
      })}
      style={{
        position: "absolute",
        left: pixelPos.x,
        top: pixelPos.y,
        width: gridSize,
        height: gridSize,
      }}
      onContextMenu={contextMenuHandlers.onContextMenu}
      onClick={handleClick}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.preventDefault();
          startDrag(e.clientX, e.clientY);
        }
      }}
      onTouchStart={contextMenuHandlers.onTouchStart}
      onTouchEnd={contextMenuHandlers.onTouchEnd}
      onTouchMove={contextMenuHandlers.onTouchMove}
    >
      <Image
        unoptimized
        src={program.icon ?? defaultIcon}
        alt={program.name}
        width={24}
        height={24}
        draggable={false}
      />
      <div className={styles.programName}>{program.name}</div>
    </button>
  );
}
