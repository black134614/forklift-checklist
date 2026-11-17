/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Op = "saveQuestion" | "setQuestionActive";

function isOp(value: unknown): value is Op {
  return value === "saveQuestion" || value === "setQuestionActive";
}

export async function POST(req: Request) {
  try {
    const base = process.env.GAS_URL;
    if (!base) {
      return NextResponse.json({ error: "Missing GAS_URL in env" }, { status: 500 });
    }

    const body = await req.json();
    const op = body?.op;

    if (!isOp(op)) {
      return NextResponse.json(
        { error: "Invalid op. Use saveQuestion or setQuestionActive" },
        { status: 400 }
      );
    }

    const payload = { ...body };
    delete payload.op;
    const url = `${base}?action=${encodeURIComponent(op)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
    return NextResponse.json(data, { status: res.ok && !data?.error ? 200 : 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to update question" },
      { status: 500 }
    );
  }
}
