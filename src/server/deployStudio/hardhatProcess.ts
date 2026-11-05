import { execFile, ChildProcess } from "child_process";
import { IS_WINDOWS } from "./hardhat";

/**
 * Arrête le nœud Hardhat lancé par le Deploy Studio — uniquement CE processus
 * (et ses enfants), jamais « tous les node.exe » ni une fenêtre au titre correspondant.
 */
export function killHardhatProcess(): boolean {
  const g = globalThis as any;
  const proc = g.__hardhatProcess as ChildProcess | null;
  if (!proc || !proc.pid) return false;

  try {
    if (IS_WINDOWS) {
      execFile("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { windowsHide: true }, () => {});
    } else {
      process.kill(-proc.pid, "SIGTERM"); // processus détaché = chef de son groupe
    }
  } catch {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* déjà terminé */
    }
  }
  g.__hardhatProcess = null;
  return true;
}
