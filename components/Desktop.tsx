import { useAtomValue, useSetAtom } from "jotai";
import styles from "./Desktop.module.css";
import { ProgramEntry, programsAtom } from "@/state/programs";
import window from "./assets/window.png";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { useCreateContextMenu } from "@/state/contextMenu";
import { useServerPrograms } from "@/lib/useServerPrograms";
import { useEffect, useRef, useState, useCallback } from "react";
import cx from "classnames";

export const Desktop = () => {
  const { programs } = useAtomValue(programsAtom);
  const dispatch = useSetAtom(programsAtom);
  const { fetchPrograms } = useServerPrograms();
  const didSync = useRef(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

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
        />
      ))}
    </div>
  );
};

function ProgramIcon({
  program,
  isSelected,
  onSelect,
}: {
  program: ProgramEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const createContextMenu = useCreateContextMenu();
  const dispatch = useSetAtom(programsAtom);
  const { deleteProgram } = useServerPrograms();
  const lastClickRef = useRef(0);

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
    const now = Date.now();
    if (now - lastClickRef.current < 400) {
      // Double-click — open the program
      runProgram();
      lastClickRef.current = 0;
    } else {
      // Single-click — select/focus the icon
      onSelect();
      lastClickRef.current = now;
    }
  };

  return (
    <button
      className={cx(styles.programIcon, { [styles.selected]: isSelected })}
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
    >
      <Image
        unoptimized
        src={program.icon ?? window}
        alt={program.name}
        width={24}
        height={24}
      />
      <div className={styles.programName}>{program.name}</div>
    </button>
  );
}
