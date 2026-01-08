/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ✅ tránh edge runtime issues

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const forkliftCode = (searchParams.get("forkliftCode") || "").trim();
    const employeeCode = (searchParams.get("employeeCode") || "").trim(); // ✅ NEW

    if (!forkliftCode) {
      return NextResponse.json({ error: "Missing forkliftCode" }, { status: 400 });
    }

    const base = process.env.GAS_URL;
    if (!base) {
      return NextResponse.json({ error: "Missing GAS_URL in env" }, { status: 500 });
    }

    // ✅ build url include employeeCode if provided
    const url =
      `${base}?action=status&forkliftCode=${encodeURIComponent(forkliftCode)}` +
      (employeeCode ? `&employeeCode=${encodeURIComponent(employeeCode)}` : "");

    const res = await fetch(url, { cache: "no-store" });

    // ✅ parse as text first to avoid "Unexpected end of JSON input"
    const text = await res.text();

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { error: "Empty response from Apps Script", status: res.status, url },
        { status: 502 }
      );
    }

    // ✅ Apps Script đôi khi trả HTML (login / redirect)
    if (text.trim().startsWith("<")) {
      return NextResponse.json(
        {
          error: "Apps Script returned HTML instead of JSON",
          status: res.status,
          preview: text.slice(0, 200),
          url,
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(text);

    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch forklift status" },
      { status: 500 }
    );
  }
}
