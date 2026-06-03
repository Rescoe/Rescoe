import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST() {
  exec("taskkill /F /IM node.exe /T");
  return NextResponse.json({ status: "stopped" });
}
