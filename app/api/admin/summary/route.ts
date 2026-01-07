/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = searchParams.get("days") || "30";

    const base = process.env.GAS_URL!;
    const url = `${base}?action=summary&days=${encodeURIComponent(days)}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
