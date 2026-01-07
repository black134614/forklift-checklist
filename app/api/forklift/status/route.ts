import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const forkliftCode = (searchParams.get("forkliftCode") || "").trim();

  if (!forkliftCode) {
    return NextResponse.json({ error: "Missing forkliftCode" }, { status: 400 });
  }

  const base = process.env.GAS_URL!;
  const url = `${base}?action=status&forkliftCode=${encodeURIComponent(forkliftCode)}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  return NextResponse.json(data, { status: res.ok ? 200 : 400 });
}
