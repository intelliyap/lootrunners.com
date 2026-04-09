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
    // Find next free slot (column-first like Win98)
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

  // Assign default positions to any new icons
  useEffect(() => {
    setIconPositions((prev) => getDefaultPositions(programs, prev));
  }, [programs]);

  const moveIcon = useCallback((id: string, col: number, row: number) => {
    setIconPositions((prev) => ({
      ...prev,
      [id]: { col, row },
    }));
  }, []);

  return (
    <div
      className={styles.desktop}
      onClick={() => setSelectedIcon(null)}
    >
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
  onMove,
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
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const runProgram = useCallback(() => {
    createWindow({
      title: program.name,
      program: {
        type: "iframe",
        programID: program.id,
      },
      icon: program.icon ?? undefined,
    });
  }, [program]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't count as click if we just finished dragging
    if (dragStartRef.current?.moved) return;

    const now = Date.now();
    if (now - lastClickRef.current < 400) {
      runProgram();
      lastClickRef.current = 0;
    } else {
      onSelect();
      lastClickRef.current = now;
    }
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    dragStartRef.current = { x: clientX, y: clientY, moved: false };
    const gridSize = getGridSize();
    const pos = gridToPixels(position.col, position.row, gridSize);
    setDragPos(pos);

    const handleDragMove = (moveX: number, moveY: number) => {
      if (!dragStartRef.current) return;
      const dx = moveX - dragStartRef.current.x;
      const dy = moveY - dragStartRef.current.y;

      // Only start visual drag after 5px movement
      if (!dragStartRef.current.moved && Math.abs(dx) + Math.abs(dy) > 5) {
        dragStartRef.current.moved = true;
        setDragging(true);
        onSelect();
      }

      if (dragStartRef.current.moved) {
        setDragPos({
          x: pos.x + dx,
          y: pos.y + dy,
        });
      }
    };

    const handleDragEnd = (endX: number, endY: number) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);

      if (dragStartRef.current?.moved) {
        const dx = endX - dragStartRef.current.x;
        const dy = endY - dragStartRef.current.y;
        const newPixelX = pos.x + dx;
        const newPixelY = pos.y + dy;
        const snapped = snapToGrid(newPixelX, newPixelY, gridSize);
        onMove(snapped.col, snapped.row);
      }

      setDragging(false);
      setDragPos(null);
      // Reset moved flag after a tick so click handler can read it
      setTimeout(() => {
        if (dragStartRef.current) dragStartRef.current.moved = false;
      }, 10);
    };

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => handleDragEnd(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      handleDragEnd(touch.clientX, touch.clientY);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
  };

  const gridSize = getGridSize();
  const pixelPos = dragging && dragPos
    ? dragPos
    : gridToPixels(position.col, position.row, gridSize);

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
      {...createContextMenu([
        { label: "Run", onClick: runProgram },
        {
          label: "Delete",
          onClick: () => {
            dispatch({
              type: "REMOVE_PROGRAM",
              payload: program.name,
            });
            deleteProgram(program.id);
          },
        },
      ])}
      onClick={handleClick}
      onMouseDown={(e) => {
        if (e.button === 0) handleDragStart(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        // Don't interfere with context menu long-press
        // Drag starts on move, not on touch start
        const touch = e.touches[0];
        dragStartRef.current = { x: touch.clientX, y: touch.clientY, moved: false };
        const gSize = getGridSize();
        const pos = gridToPixels(position.col, position.row, gSize);
        setDragPos(pos);

        const onTouchMove = (te: TouchEvent) => {
          const t = te.touches[0];
          const dx = t.clientX - dragStartRef.current!.x;
          const dy = t.clientY - dragStartRef.current!.y;
          if (!dragStartRef.current!.moved && Math.abs(dx) + Math.abs(dy) > 10) {
            dragStartRef.current!.moved = true;
            setDragging(true);
            onSelect();
          }
          if (dragStartRef.current!.moved) {
            setDragPos({ x: pos.x + dx, y: pos.y + dy });
          }
        };
        const onTouchEnd = (te: TouchEvent) => {
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
          if (dragStartRef.current?.moved) {
            const t = te.changedTouches[0];
            const dx = t.clientX - dragStartRef.current.x;
            const dy = t.clientY - dragStartRef.current.y;
            const snapped = snapToGrid(pos.x + dx, pos.y + dy, gSize);
            onMove(snapped.col, snapped.row);
          }
          setDragging(false);
          setDragPos(null);
          setTimeout(() => {
            if (dragStartRef.current) dragStartRef.current.moved = false;
          }, 10);
        };
        window.addEventListener("touchmove", onTouchMove);
        window.addEventListener("touchend", onTouchEnd);
      }}
    >
      <Image
        unoptimized
        src={program.icon ?? defaultIcon}
        alt={program.name}
        width={24}
        height={24}
      />
      <div className={styles.programName}>{program.name}</div>
    </button>
  );
}
