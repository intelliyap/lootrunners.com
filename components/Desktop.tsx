import { useAtomValue, useSetAtom } from "jotai";
import styles from "./Desktop.module.css";
import { ProgramEntry, programsAtom } from "@/state/programs";
import window from "./assets/window.png";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { useCreateContextMenu } from "@/state/contextMenu";
import { useServerPrograms } from "@/lib/useServerPrograms";
import { useEffect, useRef } from "react";

export const Desktop = () => {
  const { programs } = useAtomValue(programsAtom);
  const dispatch = useSetAtom(programsAtom);
  const { fetchPrograms } = useServerPrograms();
  const didSync = useRef(false);

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
    <div className={styles.desktop}>
      {programs.map((program) => (
        <ProgramIcon key={program.name} program={program} />
      ))}
    </div>
  );
};

function ProgramIcon({ program }: { program: ProgramEntry }) {
  const createContextMenu = useCreateContextMenu();
  const dispatch = useSetAtom(programsAtom);
  const { deleteProgram } = useServerPrograms();
  const runProgram = () => {
    createWindow({
      title: program.name,
      program: {
        type: "iframe",
        programID: program.id,
      },
      icon: program.icon ?? undefined,
    });
  };
  return (
    <button
      className={styles.programIcon}
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
      onClick={runProgram}
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
