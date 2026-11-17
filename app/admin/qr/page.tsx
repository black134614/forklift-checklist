/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Loader2,
  Printer,
  RefreshCw,
  Square,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Forklift = {
  forkliftCode: string;
  name: string;
  active: boolean;
};

function checkUrlFor(code: string, origin: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/check?id=${encodeURIComponent(code)}`;
}

export default function AdminQrPage() {
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState("");

  useEffect(() => {
    const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
    const loc = typeof window !== "undefined" ? window.location.origin : "";
    setOrigin(loc);
    setAppBaseUrl((fromEnv || loc).replace(/\/$/, ""));
    document.title = "Newland VJ";
  }, []);

  async function loadForklifts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/forklifts?activeOnly=true", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Không tải được danh sách xe");
      }
      const list: Forklift[] = Array.isArray(data.forklifts)
        ? data.forklifts
        : [];
      setForklifts(list);
      setSelected(new Set(list.map((f) => f.forkliftCode)));
    } catch (e: any) {
      setError(e.message || "Không tải được danh sách xe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForklifts();
  }, []);

  const selectedList = useMemo(
    () => forklifts.filter((f) => selected.has(f.forkliftCode)),
    [forklifts, selected]
  );

  const effectiveBase = (appBaseUrl || origin).replace(/\/$/, "");

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(forklifts.map((f) => f.forkliftCode)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handlePrint() {
    if (selectedList.length === 0 || !effectiveBase) return;
    setPrinting(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        const root = document.querySelector(".print-root");
        const sections = root?.querySelectorAll(".qr-a5-page") ?? [];

        const pagesHtml: string[] = [];
        sections.forEach((section) => {
          const name =
            section.querySelector(".qr-a5-name")?.textContent?.trim() || "";
          const canvas = section.querySelector("canvas");
          const dataUrl = canvas?.toDataURL("image/png") || "";
          if (!dataUrl) return;
          pagesHtml.push(`
            <section class="page">
              <div class="name">${name
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}</div>
              <img class="qr" src="${dataUrl}" alt="" />
            </section>
          `);
        });

        if (pagesHtml.length === 0) {
          setError("Chưa render được QR. Thử Làm mới rồi in lại.");
          setPrinting(false);
          return;
        }

        const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Newland VJ</title>
  <style>
    @page { size: A5 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
    }
    .page {
      width: 100%;
      min-height: 186mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 14mm;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .name {
      font-size: 28pt;
      font-weight: 800;
      line-height: 1.2;
      max-width: 120mm;
      word-break: break-word;
      color: #000;
    }
    .qr {
      width: 85mm;
      height: 85mm;
    }
  </style>
</head>
<body>
${pagesHtml.join("\n")}
<script>
  window.onload = function () {
    window.focus();
    window.print();
  };
</script>
</body>
</html>`;

        // In qua cửa sổ riêng (title Newland VJ, không hiện /admin/qr)
        // Không dùng noopener — cần ghi document rồi gọi print
        const printWin = window.open("", "_blank");
        if (!printWin) {
          setError(
            "Trình duyệt chặn popup. Cho phép popup cho localhost rồi bấm In lại."
          );
          setPrinting(false);
          return;
        }
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        setPrinting(false);
      }, 350);
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50/80">
      <div className="no-print max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/"
                className="hover:text-foreground inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>In QR</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              In QR checklist (khổ A5)
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Mỗi xe một trang A5 (tên + QR). Khi in: chọn khổ <b>A5</b>, và{" "}
              <b>tắt Headers and footers</b> nếu vẫn thấy ngày giờ / URL ở mép
              trang.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadForklifts()}
              disabled={loading || printing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Làm mới
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={
                loading || printing || selectedList.length === 0 || !effectiveBase
              }
            >
              {printing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-1.5" />
              )}
              In {selectedList.length} trang A5
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>
              {error}
              {error.includes("Invalid action") || error.includes("forklifts")
                ? " — Cần paste docs/code.gs mới (action forklifts) rồi Deploy lại GAS."
                : null}
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">URL gốc trong QR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              value={appBaseUrl}
              onChange={(e) => setAppBaseUrl(e.target.value.replace(/\/$/, ""))}
              placeholder="https://forklift-checklist.vercel.app"
            />
            <p className="text-xs text-muted-foreground">
              Đang dùng production URL thì QR sẽ mở đúng app trên Vercel, không
              phải localhost.
            </p>
            {selectedList[0] && effectiveBase && (
              <p className="text-xs font-mono break-all text-muted-foreground">
                Ví dụ: {checkUrlFor(selectedList[0].forkliftCode, effectiveBase)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                Xe active ({forklifts.length}) — đã chọn {selectedList.length}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAll}
                  disabled={loading || forklifts.length === 0}
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  Chọn tất cả
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectNone}
                  disabled={loading || selected.size === 0}
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Bỏ chọn
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải forklifts từ Sheet...
              </div>
            )}

            {!loading && forklifts.length === 0 && (
              <Alert>
                <AlertTitle>Không có xe active</AlertTitle>
                <AlertDescription>
                  Kiểm tra sheet <b>forklifts</b> (cột active = TRUE) và action
                  GAS <code>forklifts</code>.
                </AlertDescription>
              </Alert>
            )}

            {!loading && forklifts.length > 0 && (
              <ul className="divide-y rounded-md border bg-white">
                {forklifts.map((f) => {
                  const checked = selected.has(f.forkliftCode);
                  return (
                    <li key={f.forkliftCode}>
                      <button
                        type="button"
                        onClick={() => toggle(f.forkliftCode)}
                        className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50 ${
                          checked ? "bg-zinc-50" : ""
                        }`}
                      >
                        <span
                          className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                            checked
                              ? "bg-zinc-900 border-zinc-900 text-white"
                              : "border-zinc-300 bg-white"
                          }`}
                          aria-checked={checked}
                          role="checkbox"
                        >
                          {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {f.forkliftCode}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {f.name || "—"}
                          </div>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {selectedList.length > 0 && effectiveBase && (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                Xem trước (in sẽ ra khổ A5 đầy đủ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedList.slice(0, 6).map((f) => (
                  <div
                    key={f.forkliftCode}
                    className="border rounded-lg p-4 bg-white flex flex-col items-center gap-2"
                  >
                    <QRCodeSVG
                      value={checkUrlFor(f.forkliftCode, effectiveBase)}
                      size={120}
                      level="M"
                      includeMargin
                    />
                    <div className="text-center">
                      <div className="text-sm font-semibold">{f.forkliftCode}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {selectedList.length > 6 && (
                <p className="text-xs text-muted-foreground mt-3">
                  +{selectedList.length - 6} xe nữa sẽ có trong bản in.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Print: chỉ tên lớn + QR, 1 xe / 1 trang A5 */}
      <div className="print-root" aria-hidden="true">
        {selectedList.map((f) => (
          <section key={f.forkliftCode} className="qr-a5-page">
            <div className="qr-a5-name">
              {(f.name || f.forkliftCode).trim()}
            </div>
            <div className="qr-a5-qr">
              {effectiveBase ? (
                <QRCodeCanvas
                  value={checkUrlFor(f.forkliftCode, effectiveBase)}
                  size={360}
                  level="M"
                  includeMargin={false}
                />
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
