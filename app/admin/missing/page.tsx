/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { gasGet } from "@/lib/gas";

export default function MissingPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const d = await gasGet("missing");
        if (d?.error) throw new Error(d.error);
        setData(d);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <div className="p-4">❌ {error}</div>;
  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-bold">Cảnh báo xe chưa checklist</h1>

      <div className="border rounded p-3">
        <p>
          <b>Ngày:</b> {data.date}
        </p>
        <p>
          <b>Tổng xe:</b> {data.total}
        </p>
        <p>
          <b>Đã checklist:</b> {data.checked}
        </p>
        <p>
          <b>Chưa checklist:</b> {data.missing.length}
        </p>
      </div>

      <div className="space-y-2">
        {data.missing.map((x: any) => (
          <div key={x.forkliftCode} className="border rounded p-3">
            <b>{x.forkliftCode}</b> — {x.name}
          </div>
        ))}
      </div>
    </div>
  );
}
