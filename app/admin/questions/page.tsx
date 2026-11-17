/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type Question = {
  questionId: string;
  sortOrder: number;
  text: string;
  active: boolean;
  updatedAt?: string;
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("1");

  const [newText, setNewText] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");

  const nextSortDefault = useMemo(() => {
    if (questions.length === 0) return "1";
    const max = Math.max(...questions.map((q) => Number(q.sortOrder) || 0));
    return String(max + 1);
  }, [questions]);

  async function loadQuestions() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/questions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Không tải được danh sách câu hỏi");
      }
      const list: Question[] = Array.isArray(data.questions)
        ? [...data.questions].sort(
            (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
          )
        : [];
      setQuestions(list);
    } catch (e: any) {
      setError(e.message || "Không tải được danh sách câu hỏi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (!newSortOrder) setNewSortOrder(nextSortDefault);
  }, [nextSortDefault, newSortOrder]);

  function startEdit(q: Question) {
    setEditId(q.questionId);
    setEditText(q.text);
    setEditSortOrder(String(q.sortOrder));
    setMsg("");
  }

  function cancelEdit() {
    setEditId(null);
    setEditText("");
    setEditSortOrder("1");
  }

  async function postOp(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || "Thao tác thất bại");
    }
    return data;
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const sortOrder = Number(editSortOrder);
      if (!editText.trim()) throw new Error("Nội dung câu hỏi không được trống");
      if (!Number.isFinite(sortOrder)) throw new Error("Thứ tự phải là số");

      await postOp({
        op: "saveQuestion",
        questionId: editId,
        text: editText.trim(),
        sortOrder,
      });
      setMsg("✅ Đã cập nhật câu hỏi");
      cancelEdit();
      await loadQuestions();
    } catch (e: any) {
      setError(e.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  async function createQuestion() {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const sortOrder = Number(newSortOrder || nextSortDefault);
      if (!newText.trim()) throw new Error("Nội dung câu hỏi không được trống");
      if (!Number.isFinite(sortOrder)) throw new Error("Thứ tự phải là số");

      await postOp({
        op: "saveQuestion",
        text: newText.trim(),
        sortOrder,
      });
      setMsg("✅ Đã thêm câu hỏi mới");
      setNewText("");
      setNewSortOrder("");
      await loadQuestions();
    } catch (e: any) {
      setError(e.message || "Không thêm được");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(q: Question, active: boolean) {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      await postOp({
        op: "setQuestionActive",
        questionId: q.questionId,
        active,
      });
      setMsg(active ? "✅ Đã kích hoạt lại" : "✅ Đã vô hiệu hóa");
      await loadQuestions();
    } catch (e: any) {
      setError(e.message || "Không đổi trạng thái được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý câu hỏi checklist</h1>
          <p className="text-sm text-muted-foreground">
            Soft-delete: tắt câu hỏi không xóa; báo cáo cũ giữ snapshot nội dung lúc gửi.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">← Về Dashboard</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Lỗi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {msg && (
        <Alert>
          <AlertTitle>Thông báo</AlertTitle>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Alert>
          <AlertTitle>⏳ Đang tải...</AlertTitle>
          <AlertDescription>Đang lấy danh sách câu hỏi từ Google Sheet.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thêm câu hỏi mới</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[120px_1fr]">
            <div>
              <div className="text-sm font-medium mb-1">Thứ tự</div>
              <Input
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Nội dung</div>
              <Textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Nhập nội dung câu hỏi..."
                disabled={saving}
              />
            </div>
          </div>
          <Button onClick={createQuestion} disabled={saving || !newText.trim()}>
            {saving ? "Đang lưu..." : "Thêm câu hỏi"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3">
        {!loading && questions.length === 0 && (
          <Alert>
            <AlertTitle>Chưa có câu hỏi</AlertTitle>
            <AlertDescription>
              Seed sheet <b>Questions</b> (xem docs/gas/QUESTIONS.md) hoặc thêm câu mới ở trên.
            </AlertDescription>
          </Alert>
        )}

        {questions.map((q) => (
          <Card key={q.questionId}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{q.questionId}</Badge>
                  <Badge variant="outline">Thứ tự {q.sortOrder}</Badge>
                  {q.active ? (
                    <Badge>Active</Badge>
                  ) : (
                    <Badge variant="destructive">Tắt</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editId === q.questionId ? (
                    <>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        Lưu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(q)}
                      disabled={saving}
                    >
                      Sửa
                    </Button>
                  )}
                  {q.active ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setActive(q, false)}
                      disabled={saving}
                    >
                      Vô hiệu hóa
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setActive(q, true)}
                      disabled={saving}
                    >
                      Kích hoạt lại
                    </Button>
                  )}
                </div>
              </div>

              {editId === q.questionId ? (
                <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                  <div>
                    <div className="text-sm font-medium mb-1">Thứ tự</div>
                    <Input
                      type="number"
                      value={editSortOrder}
                      onChange={(e) => setEditSortOrder(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Nội dung</div>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm">{q.text}</div>
              )}

              {q.updatedAt ? (
                <div className="text-xs text-muted-foreground">
                  Cập nhật: {q.updatedAt}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
