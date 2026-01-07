/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type MissingItem = { forkliftCode: string; name?: string };
type MissingResponse = {
  date: string;
  total: number;
  checked: number;
  missing: MissingItem[];
};

type SummaryRow = { date: string; checked_count: number; issue_count: number };
type SummaryResponse = { days?: number; data: SummaryRow[] };

export default function DashboardPage() {
  const [missing, setMissing] = useState<MissingResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        const [missingRes, summaryRes] = await Promise.all([
          fetch("/api/admin/missing", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/admin/summary", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (missingRes?.error) throw new Error(missingRes.error);
        if (summaryRes?.error) throw new Error(summaryRes.error);

        setMissing(missingRes);
        setSummary(summaryRes);
      } catch (e: any) {
        setError(e.message || "Không tải được dữ liệu dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpi = useMemo(() => {
    if (!missing || !summary) return null;

    const total = Number(missing.total || 0);
    const today = String(missing.date || "").trim();

    // ✅ Lấy checked_count của hôm nay từ daily_summary để đảm bảo đúng
    const todayRow = summary.data?.find((r) => String(r.date).trim() === today);
    const checkedToday = todayRow ? Number(todayRow.checked_count || 0) : Number(missing.checked || 0);

    // ✅ Tính missing thủ công dựa trên tổng xe
    const missingCountCalculated = Math.max(0, total - checkedToday);

    const completion = total ? Math.round((checkedToday / total) * 100) : 0;

    // ⚠️ kiểm tra mismatch giữa API missing list và calculated
    const missingListCount = Array.isArray(missing.missing) ? missing.missing.length : 0;
    const mismatch = missingListCount !== missingCountCalculated;

    return {
      date: today,
      total,
      checked: checkedToday,
      missingCalculated: missingCountCalculated,
      missingListCount,
      completion,
      mismatch,
      issueToday: todayRow ? Number(todayRow.issue_count || 0) : 0,
    };
  }, [missing, summary]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Dashboard Checklist Xe Nâng</h1>
        {kpi?.date && (
          <div className="text-sm text-muted-foreground">
            Ngày hiện tại: <Badge variant="secondary">{kpi.date}</Badge>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Lỗi</AlertTitle>
          <AlertDescription>❌ {error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Alert>
          <AlertTitle>⏳ Đang tải dữ liệu...</AlertTitle>
          <AlertDescription>
            Vui lòng chờ trong giây lát, hệ thống đang tải báo cáo hôm nay và dữ liệu biểu đồ.
          </AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {!loading && missing && summary && kpi && (
        <>
          {/* ⚠️ Mismatch warning */}
          

          {/* KPI */}
          <div className="grid gap-3 md:grid-cols-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tổng xe Active</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{kpi.total}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Đã checklist hôm nay</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{kpi.checked}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Chưa checklist hôm nay</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-red-600">
                {kpi.missingCalculated}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sự cố hôm nay</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-orange-600">
                {kpi.issueToday}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tỉ lệ hoàn thành</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{kpi.completion}%</CardContent>
            </Card>
          </div>

          <Separator />

          {/* Missing List (NO LINKS) */}
          <Card>
            <CardHeader>
              <CardTitle>Danh sách xe chưa checklist hôm nay</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {missing.missing.length === 0 ? (
                <Alert>
                  <AlertTitle>✅ Tất cả xe đã checklist</AlertTitle>
                  <AlertDescription>
                    Không còn xe nào thiếu checklist trong ngày hôm nay.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert variant="destructive">
                    <AlertTitle>⚠️ Cảnh báo</AlertTitle>
                    <AlertDescription>
                      Danh sách <b>{missing.missing.length}</b> xe chưa checklist hôm nay.
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-2 md:grid-cols-2">
                    {missing.missing.map((x) => (
                      <Card key={x.forkliftCode}>
                        <CardContent className="p-3">
                          <div className="font-semibold">{x.forkliftCode}</div>
                          <div className="text-sm text-muted-foreground">
                            {x.name || "-"}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Biểu đồ Checklist & Sự cố (Daily Summary)</CardTitle>
            </CardHeader>

            <CardContent style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="checked_count"
                    name="Số xe checklist"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="issue_count"
                    name="Số sự cố"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
