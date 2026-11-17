/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const base = process.env.GAS_URL;
    if (!base) {
      return NextResponse.json(
        {
          error:
            "Missing GAS_URL in env. Thêm vào .env.local rồi restart npm run dev.",
        },
        { status: 500 }
      );
    }

    const url = `${base}?action=missing`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { error: "Empty response from Apps Script", url },
        { status: 502 }
      );
    }
    if (text.trim().startsWith("<")) {
      return NextResponse.json(
        {
          error: "Apps Script returned HTML instead of JSON",
          preview: text.slice(0, 200),
          url,
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(text);
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to fetch missing" },
      { status: 500 }
    );
  }
}
