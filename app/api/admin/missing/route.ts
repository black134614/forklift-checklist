import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const base = process.env.GAS_URL!;
  const url = `${base}?action=missing`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  return NextResponse.json(data);
}
