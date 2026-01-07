import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const base = process.env.GAS_URL!;
  const url = `${base}?action=submitChecklist`;

  const body = await req.json();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 400 });
}
