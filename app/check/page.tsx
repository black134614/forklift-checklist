/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Answer = "PASS" | "FAIL" | "OTHER";

const QUESTIONS = [
  "Kiểm tra càng nâng, trụ nâng, ben thuỷ lực và các phụ kiện không có bất cứ dấu hiệu hư hỏng nào",
  "Kiểm tra bánh xe, các dây đai an toàn, sự cố rò rỉ dưới thân xe",
  "Kiểm tra vệ sinh xe trước khi sử dụng",
  "Kiểm tra sự chắc chắn của đầu nối bình ắc quy và ổ cắm sạc",
  "Kiểm tra châm nước bình định kỳ",
  "Kiểm tra tình trạng và khả năng điều chỉnh của ghế ngồi và dây an toàn",
  "Kiểm tra tất cả các bàn đạp và cần điều khiển về sự vận hành trơn tru",
  "Kiểm tra thắng chân và thắng tay về sự hoạt động an toàn",
  "Kiểm tra tình trạng của động cơ, động cơ thủy lực nâng hạ và các cơ cấu chuyền động khác",
  "Kiểm tra đèn, đèn cảnh báo, kèn/ còi và còi de/ lùi",
  "Kiểm tra bất kỳ sự hư hỏng hoặc khuyết tật nào được nhìn thấy",
];

export default function CheckPage() {
  const searchParams = useSearchParams();
  const forkliftCode = (searchParams.get("id") || "").trim();

  const [employees, setEmployees] = useState<
    { employeeCode: string; fullName: string }[]
  >([]);
  const [employeeCode, setEmployeeCode] = useState<string>("");
  const employee = employees.find((e) => e.employeeCode === employeeCode);

  const [answers, setAnswers] = useState<Answer[]>(Array(11).fill("PASS"));
  const [issueDescription, setIssueDescription] = useState("");
  const hasIssue = useMemo(() => answers.some((a) => a !== "PASS"), [answers]);

  const [status, setStatus] = useState<{
    checked: boolean;
    date?: string;
  } | null>(null);

  const [initLoading, setInitLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // ✅ 1) Load employees + status ngay khi vào page
  useEffect(() => {
    (async () => {
      setInitLoading(true);
      setMsg("");

      try {
        // load employees
        const empRes = await fetch("/api/employees", { cache: "no-store" });
        const empData = await empRes.json();
        if (empData?.error) throw new Error(empData.error);
        setEmployees(empData.employees || []);

        // check forklift status
        if (forkliftCode) {
          const stRes = await fetch(
            `/api/forklift/status?forkliftCode=${encodeURIComponent(
              forkliftCode
            )}`,
            { cache: "no-store" }
          );
          const stData = await stRes.json();
          if (stData?.error) throw new Error(stData.error);
          setStatus(stData);

          // ✅ cảnh báo ngay khi load nếu đã checklist
          if (stData?.checked) {
            setMsg("⚠️ Xe này đã checklist hôm nay. Không thể gửi lại.");
          }
        } else {
          setStatus(null);
        }
      } catch (e: any) {
        setMsg("❌ Không tải được dữ liệu: " + e.message);
      } finally {
        setInitLoading(false);
      }
    })();
  }, [forkliftCode]);

  async function submit() {
    setLoading(true);
    setMsg("");

    try {
      if (!forkliftCode)
        throw new Error("Thiếu mã xe. Vui lòng mở link dạng /check?id=FL-0001");

      if (!employee) throw new Error("Vui lòng chọn nhân viên");

      // ✅ Chặn ngay nếu status đã checked
      if (status?.checked)
        throw new Error("Xe này đã checklist hôm nay. Không thể gửi lại.");

      if (hasIssue && issueDescription.trim().length < 3) {
        throw new Error("Có lỗi - vui lòng mô tả sự hư hỏng");
      }

      const payload = {
        forkliftCode,
        employeeCode: employee.employeeCode,
        employeeName: employee.fullName,
        answers,
        issueDescription,
      };

      const res = await fetch("/api/checklist/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data?.error)
        throw new Error(data?.error || "Gửi thất bại");

      setMsg("✅ Gửi checklist thành công!");
      setStatus({ checked: true, date: data?.date });

      // ✅ Sau khi gửi xong: khóa form
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const formDisabled =
    initLoading || loading || !forkliftCode || status?.checked;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {initLoading && (
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải dữ liệu...
          </AlertTitle>
          <AlertDescription>
            Vui lòng chờ trong giây lát, hệ thống đang tải danh sách nhân viên
            và kiểm tra trạng thái xe.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Checklist Xe Nâng
            {forkliftCode ? (
              <Badge variant="secondary">{forkliftCode}</Badge>
            ) : (
              <Badge variant="destructive">Thiếu ID</Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Nếu thiếu mã xe */}
          {!forkliftCode && (
            <Alert variant="destructive">
              <AlertTitle>Thiếu mã xe</AlertTitle>
              <AlertDescription>
                Vui lòng mở link dạng <b>/check?id=FL-0001</b> để vào đúng xe.
              </AlertDescription>
            </Alert>
          )}

          {/* ✅ Nếu status checked, cảnh báo ngay */}
          {status?.checked && (
            <Alert>
              <AlertTitle>✅ Xe đã checklist hôm nay</AlertTitle>
              <AlertDescription>
                Xe <b>{forkliftCode}</b> đã được tạo checklist trong ngày hôm
                nay. Bạn không thể gửi lại.
              </AlertDescription>
            </Alert>
          )}

          {/* Message tổng */}
          {msg && (
            <Alert variant={msg.startsWith("✅") ? "default" : "destructive"}>
              <AlertTitle>
                {msg.startsWith("✅") ? "Thông báo" : "Lỗi"}
              </AlertTitle>
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}

          {/* Chọn nhân viên + gửi */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium mb-2">Chọn nhân viên</div>
              <Select
                value={employeeCode}
                onValueChange={setEmployeeCode}
                disabled={formDisabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn nhân viên --" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.employeeCode} value={e.employeeCode}>
                      {e.fullName} ({e.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={formDisabled || !employee}
                onClick={submit}
              >
                {loading ? "Đang gửi..." : "Gửi Checklist"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Checklist */}
          <div className="space-y-3">
            {QUESTIONS.map((q, idx) => (
              <Card key={idx}>
                <CardContent className="p-4 space-y-2">
                  <div className="font-medium">
                    {idx + 1}. {q}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["PASS", "FAIL", "OTHER"] as Answer[]).map((v) => (
                      <Button
                        key={v}
                        type="button"
                        variant={answers[idx] === v ? "default" : "outline"}
                        onClick={() => {
                          const next = [...answers];
                          next[idx] = v;
                          setAnswers(next);
                        }}
                        disabled={formDisabled}
                      >
                        {v === "PASS"
                          ? "Đạt"
                          : v === "FAIL"
                          ? "Không đạt"
                          : "Khác"}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mô tả lỗi */}
          {hasIssue && !status?.checked && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-red-600">
                  ⚠️ Có lỗi - vui lòng mô tả
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Mô tả sự hư hỏng..."
                  disabled={formDisabled}
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
