/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
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

type DriverItem = { employeeCode: string; employeeName: string; count: number };
type DriversResponse = { date: string; totalDrivers: number; drivers: DriverItem[] };

type DriverReport = {
  createdAt: string;
  date: string;
  forkliftCode: string;
  employeeCode: string;
  employeeName: string;
  status: string; // PASS | HAS_ISSUE
  issueDescription: string;
  issueItems: { q: number; answer: string }[];
};

type DriverReportsResponse = {
  date: string;
  employeeCode: string;
  employeeName: string;
  totalReports: number;
  issueReports: number;
  reports: DriverReport[];
};

export default function DashboardPage() {
  const [missing, setMissing] = useState<MissingResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [drivers, setDrivers] = useState<DriversResponse | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Driver detail dialog
  const [openDriver, setOpenDriver] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverItem | null>(null);
  const [driverReports, setDriverReports] = useState<DriverReportsResponse | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        const [missingRes, summaryRes, driversRes] = await Promise.all([
          fetch("/api/admin/missing", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/admin/summary", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/admin/drivers", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (missingRes?.error) throw new Error(missingRes.error);
        if (summaryRes?.error) throw new Error(summaryRes.error);
        if (driversRes?.error) throw new Error(driversRes.error);

        setMissing(missingRes);
        setSummary(summaryRes);
        setDrivers(driversRes);
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

    // ✅ Ưu tiên theo danh sách missing (thực tế)
    const missingCount = Array.isArray(missing.missing) ? missing.missing.length : 0;
    const checkedCount = Math.max(0, total - missingCount);
    const completion = total ? Math.round((checkedCount / total) * 100) : 0;

    // issue lấy từ daily_summary để thống kê
    const todayRow = summary.data?.find((r) => String(r.date).trim() === today);
    const issueToday = todayRow ? Number(todayRow.issue_count || 0) : 0;

    // optional mismatch warning giữa summary checked_count và thực tế
    const summaryChecked = todayRow ? Number(todayRow.checked_count || 0) : null;
    const mismatch = summaryChecked !== null && summaryChecked !== checkedCount;

    return {
      date: today,
      total,
      checked: checkedCount,
      missing: missingCount,
      completion,
      issueToday,
      mismatch,
      summaryChecked,
    };
  }, [missing, summary]);

  async function openDriverDetail(d: DriverItem) {
    setSelectedDriver(d);
    setOpenDriver(true);
    setDriverReports(null);
    setDriverError("");

    try {
      setDriverLoading(true);
      const date = kpi?.date || "";
      const url =
        `/api/admin/driver-reports?employeeCode=${encodeURIComponent(d.employeeCode)}` +
        (date ? `&date=${encodeURIComponent(date)}` : "");

      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Không tải được chi tiết checklist theo nhân viên");
      }

      setDriverReports(data);
    } catch (e: any) {
      setDriverError(e.message || "Không tải được chi tiết");
    } finally {
      setDriverLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Dashboard Checklist Xe Nâng</h1>
          {kpi?.date && (
            <div className="text-sm text-muted-foreground">
              Ngày hiện tại: <Badge variant="secondary">{kpi.date}</Badge>
            </div>
          )}
        </div>

        <Button asChild variant="outline">
          <a
            href="https://docs.google.com/spreadsheets/d/1EPb1LKzWo6Z0qRsCBIPAr-d0UpBjakwxG8YoxczjBvA/edit?gid=0#gid=0"
            target="_blank"
            rel="noreferrer"
          >
            Mở Google Sheet quản lý
          </a>
        </Button>
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
            Vui lòng chờ trong giây lát, hệ thống đang tải báo cáo hôm nay, danh sách nhân viên và dữ liệu biểu đồ.
          </AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {!loading && missing && summary && drivers && kpi && (
        <>
          {/* Optional mismatch warning */}
          {kpi.mismatch && (
            <Alert variant="destructive">
              <AlertTitle>⚠️ daily_summary chưa khớp thực tế</AlertTitle>
              <AlertDescription>
                <div>
                  Theo danh sách thiếu checklist (thực tế): <b>{kpi.checked}</b> xe đã checklist
                </div>
                <div>
                  Theo daily_summary: <b>{kpi.summaryChecked}</b> xe đã checklist
                </div>
                <div className="text-sm mt-2 text-muted-foreground">
                  KPI đang ưu tiên theo danh sách xe thiếu checklist để luôn đúng thực tế.
                </div>
              </AlertDescription>
            </Alert>
          )}

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
              <CardContent className="text-3xl font-bold text-red-600">{kpi.missing}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sự cố hôm nay</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold text-orange-600">{kpi.issueToday}</CardContent>
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
                  <AlertDescription>Không còn xe nào thiếu checklist trong ngày hôm nay.</AlertDescription>
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
                          <div className="text-sm text-muted-foreground">{x.name || "-"}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Drivers Today (click to open detail) */}
          <Card>
            <CardHeader>
              <CardTitle>Nhân viên đã thực hiện checklist hôm nay</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {drivers.drivers.length === 0 ? (
                <Alert>
                  <AlertTitle>Chưa có dữ liệu</AlertTitle>
                  <AlertDescription>Hôm nay chưa có nhân viên nào thực hiện checklist.</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    Tổng nhân viên đã checklist: <b>{drivers.totalDrivers}</b>
                    <span className="ml-2">(Bấm vào nhân viên để xem xe và lỗi)</span>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {drivers.drivers.map((d) => (
                      <Card
                        key={d.employeeCode}
                        className="cursor-pointer hover:shadow-md transition"
                        onClick={() => openDriverDetail(d)}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{d.employeeName}</div>
                            <div className="text-sm text-muted-foreground">{d.employeeCode}</div>
                          </div>
                          <Badge variant="secondary">{d.count} lượt</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Chart (Column + Line) */}
          <Card>
            <CardHeader>
              <CardTitle>Biểu đồ Checklist & Sự cố (Daily Summary)</CardTitle>
            </CardHeader>

            <CardContent style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={summary.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip labelFormatter={(label) => `Ngày: ${label}`} />
                  <Legend />

                  <Bar
                    yAxisId="left"
                    dataKey="checked_count"
                    name="Số xe checklist"
                    barSize={28}
                    radius={[6, 6, 0, 0]}
                  />

                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="issue_count"
                    name="Số sự cố"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Driver Detail Dialog */}
      <Dialog open={openDriver} onOpenChange={setOpenDriver}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Chi tiết checklist — {selectedDriver?.employeeName} ({selectedDriver?.employeeCode})
            </DialogTitle>
          </DialogHeader>

          {driverLoading && (
            <Alert>
              <AlertTitle>⏳ Đang tải dữ liệu...</AlertTitle>
              <AlertDescription>Vui lòng chờ trong giây lát.</AlertDescription>
            </Alert>
          )}

          {driverError && (
            <Alert variant="destructive">
              <AlertTitle>Lỗi</AlertTitle>
              <AlertDescription>❌ {driverError}</AlertDescription>
            </Alert>
          )}

          {!driverLoading && !driverError && driverReports && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Ngày: <b>{driverReports.date}</b> — Tổng lượt: <b>{driverReports.totalReports}</b> — Lượt có lỗi:{" "}
                <b className="text-red-600">{driverReports.issueReports}</b>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
                {driverReports.reports.map((r, idx) => (
                  <Card key={`${r.createdAt}-${r.forkliftCode}-${idx}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">
                          Xe: {r.forkliftCode}
                          <span className="text-xs text-muted-foreground ml-2">{r.createdAt}</span>
                        </div>
                        {r.status === "HAS_ISSUE" ? (
                          <Badge variant="destructive">Có lỗi</Badge>
                        ) : (
                          <Badge variant="secondary">Đạt</Badge>
                        )}
                      </div>

                      {r.status === "HAS_ISSUE" && (
                        <>
                          <div className="text-sm">
                            <b>Mô tả lỗi:</b> {r.issueDescription || "(không có mô tả)"}
                          </div>

                          {r.issueItems?.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              <b>Câu bị lỗi:</b>{" "}
                              {r.issueItems.map((x) => `#${x.q} (${x.answer})`).join(", ")}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
