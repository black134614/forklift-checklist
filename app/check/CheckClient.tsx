/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
import { ArrowUp } from "lucide-react";

type Answer = "PASS" | "FAIL" | "OTHER";

type Question = {
  questionId: string;
  sortOrder: number;
  text: string;
  active?: boolean;
};

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text || text.trim().length === 0) {
    throw new Error(`API trả về body rỗng (status ${res.status})`);
  }

  if (text.trim().startsWith("<")) {
    throw new Error(
      `API trả về HTML thay vì JSON (status ${res.status}): ${text.slice(
        0,
        120
      )}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Không parse được JSON: ${text.slice(0, 120)}`);
  }
}

function defaultAnswers(questions: Question[]): Record<string, Answer> {
  const next: Record<string, Answer> = {};
  for (const q of questions) {
    next[q.questionId] = "PASS";
  }
  return next;
}

export default function CheckClient() {
  const searchParams = useSearchParams();
  const forkliftCode = (searchParams.get("id") || "").trim(); // /check?id=FL-0001

  const [employees, setEmployees] = useState<
    { employeeCode: string; fullName: string }[]
  >([]);
  const [employeeCode, setEmployeeCode] = useState<string>("");
  const employee = employees.find((e) => e.employeeCode === employeeCode);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [issueDescription, setIssueDescription] = useState("");
  const hasIssue = useMemo(
    () => questions.some((q) => (answers[q.questionId] ?? "PASS") !== "PASS"),
    [answers, questions]
  );

  /**
   * status.checked = nhân viên này đã checklist xe này hôm nay chưa?
   */
  const [status, setStatus] = useState<{
    checked: boolean;
    date?: string;
  } | null>(null);

  const [initLoading, setInitLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    (async () => {
      setInitLoading(true);
      setMsg("");

      try {
        const [empRes, qRes] = await Promise.all([
          fetch("/api/employees", { cache: "no-store" }),
          fetch("/api/questions?activeOnly=true", { cache: "no-store" }),
        ]);

        const empData = await safeJson(empRes);
        if (empData?.error) throw new Error(empData.error);

        const qData = await safeJson(qRes);
        if (qData?.error) throw new Error(qData.error);

        const list: Question[] = Array.isArray(qData.questions)
          ? [...qData.questions].sort(
              (a: Question, b: Question) =>
                Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
            )
          : [];

        if (list.length === 0) {
          throw new Error("Chưa có câu hỏi active. Vào /admin/questions để cấu hình.");
        }

        setEmployees(empData.employees || []);
        setQuestions(list);
        setAnswers(defaultAnswers(list));
      } catch (e: any) {
        setMsg("❌ Không tải được dữ liệu: " + e.message);
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!forkliftCode || !employeeCode) {
      setStatus(null);
      return;
    }

    (async () => {
      setStatusLoading(true);
      setMsg("");

      try {
        const url = `/api/forklift/status?forkliftCode=${encodeURIComponent(
          forkliftCode
        )}&employeeCode=${encodeURIComponent(employeeCode)}`;

        const stRes = await fetch(url, { cache: "no-store" });
        const stData = await safeJson(stRes);

        if (stData?.error) throw new Error(stData.error);

        setStatus(stData);

        if (stData?.checked) {
          setMsg(
            "⚠️ Tài xế này đã checklist xe này hôm nay. Vui lòng chọn tài xế khác hoặc không thể gửi lại."
          );
        }
      } catch (e: any) {
        setMsg("❌ Không kiểm tra được trạng thái xe: " + e.message);
      } finally {
        setStatusLoading(false);
      }
    })();
  }, [forkliftCode, employeeCode]);

  async function submit() {
    setLoading(true);
    setMsg("");

    try {
      if (!forkliftCode)
        throw new Error("Thiếu mã xe. Vui lòng mở link dạng /check?id=FL-0001");

      if (!employee) throw new Error("Vui lòng chọn nhân viên");

      if (questions.length === 0) {
        throw new Error("Không có câu hỏi để gửi");
      }

      if (status?.checked) {
        throw new Error(
          `Bạn (${employee.fullName}) đã checklist xe ${forkliftCode} hôm nay rồi. Không thể gửi lại.`
        );
      }

      if (hasIssue && issueDescription.trim().length < 3) {
        throw new Error("Có lỗi - vui lòng mô tả sự hư hỏng");
      }

      const payload = {
        forkliftCode,
        employeeCode: employee.employeeCode,
        employeeName: employee.fullName,
        answers: questions.map((q) => ({
          questionId: q.questionId,
          questionText: q.text,
          answer: answers[q.questionId] ?? "PASS",
        })),
        issueDescription,
      };

      const res = await fetch("/api/checklist/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok || data?.error)
        throw new Error(data?.error || "Gửi thất bại");

      setMsg("✅ Gửi checklist thành công!");
      setStatus({ checked: true, date: data?.date });
    } catch (e: any) {
      setMsg("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const formDisabled =
    initLoading ||
    loading ||
    statusLoading ||
    !forkliftCode ||
    questions.length === 0 ||
    (employeeCode ? status?.checked : false);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
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
          {initLoading && (
            <Alert>
              <AlertTitle>⏳ Đang tải dữ liệu...</AlertTitle>
              <AlertDescription>
                Vui lòng chờ trong giây lát, hệ thống đang tải danh sách nhân
                viên và câu hỏi.
              </AlertDescription>
            </Alert>
          )}

          {!forkliftCode && (
            <Alert variant="destructive">
              <AlertTitle>Thiếu mã xe</AlertTitle>
              <AlertDescription>
                Vui lòng mở link dạng <b>/check?id=FL-0001</b> để vào đúng xe.
              </AlertDescription>
            </Alert>
          )}

          {employeeCode && statusLoading && (
            <Alert>
              <AlertTitle>⏳ Đang kiểm tra trạng thái xe...</AlertTitle>
              <AlertDescription>
                Đang kiểm tra xem tài xế đã checklist xe này hôm nay chưa...
              </AlertDescription>
            </Alert>
          )}

          {employeeCode && status?.checked && (
            <Alert>
              <AlertTitle>✅ Đã checklist (theo tài xế)</AlertTitle>
              <AlertDescription>
                Tài xế <b>{employee?.fullName}</b> đã checklist xe{" "}
                <b>{forkliftCode}</b> trong ngày hôm nay. Bạn không thể gửi lại
                với cùng tài xế.
              </AlertDescription>
            </Alert>
          )}

          {msg && (
            <Alert variant={msg.startsWith("✅") ? "default" : "destructive"}>
              <AlertTitle>
                {msg.startsWith("✅") ? "Thông báo" : "Lỗi"}
              </AlertTitle>
              <AlertDescription>{msg}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium mb-2">Chọn nhân viên</div>
              <Select
                value={employeeCode}
                onValueChange={setEmployeeCode}
                disabled={initLoading || !forkliftCode}
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

              <div className="text-xs text-muted-foreground mt-2">
                Rule: 1 xe có thể checklist nhiều lần/ngày, nhưng mỗi tài xế chỉ
                được làm 1 lần/ngày trên xe đó.
              </div>
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

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <Card key={q.questionId}>
                <CardContent className="p-4 space-y-2">
                  <div className="font-medium">
                    {idx + 1}. {q.text}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["PASS", "FAIL", "OTHER"] as Answer[]).map((v) => (
                      <Button
                        key={v}
                        type="button"
                        variant={
                          (answers[q.questionId] ?? "PASS") === v
                            ? "default"
                            : "outline"
                        }
                        onClick={() => {
                          setAnswers((prev) => ({
                            ...prev,
                            [q.questionId]: v,
                          }));
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
      {showTop && (
        <Button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 rounded-full w-12 h-12 p-0 shadow-lg"
          variant="default"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
