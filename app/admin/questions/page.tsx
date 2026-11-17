/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  X,
} from "lucide-react";

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

type FilterTab = "all" | "active" | "inactive";

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showAdd, setShowAdd] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("1");

  const [newText, setNewText] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");

  const stats = useMemo(() => {
    const active = questions.filter((q) => q.active).length;
    return {
      total: questions.length,
      active,
      inactive: questions.length - active,
    };
  }, [questions]);

  const nextSortDefault = useMemo(() => {
    if (questions.length === 0) return "1";
    const max = Math.max(...questions.map((q) => Number(q.sortOrder) || 0));
    return String(max + 1);
  }, [questions]);

  const filtered = useMemo(() => {
    if (filter === "active") return questions.filter((q) => q.active);
    if (filter === "inactive") return questions.filter((q) => !q.active);
    return questions;
  }, [questions, filter]);

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
      if (list.length === 0) setShowAdd(true);
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
    setShowAdd(false);
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
      setMsg("Đã cập nhật câu hỏi");
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
      setMsg("Đã thêm câu hỏi mới");
      setNewText("");
      setNewSortOrder("");
      setShowAdd(false);
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
      setMsg(active ? "Đã kích hoạt lại" : "Đã vô hiệu hóa");
      await loadQuestions();
    } catch (e: any) {
      setError(e.message || "Không đổi trạng thái được");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: stats.total },
    { id: "active", label: "Đang dùng", count: stats.active },
    { id: "inactive", label: "Đã tắt", count: stats.inactive },
  ];

  return (
    <div className="min-h-screen bg-zinc-50/80">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <span>/</span>
              <span>Câu hỏi</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Quản lý câu hỏi checklist
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Tắt câu hỏi không xóa dữ liệu. Báo cáo cũ giữ nguyên nội dung lúc gửi.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadQuestions()}
              disabled={loading || saving}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowAdd((v) => !v);
                cancelEdit();
              }}
              disabled={saving}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm câu hỏi
            </Button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-3 grid-cols-3">
          <Card className="shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Tổng câu hỏi
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Đang dùng trên form
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold tabular-nums text-emerald-700">
                {stats.active}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Đã tắt
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold tabular-nums text-zinc-500">
                {stats.inactive}
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {msg && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <AlertTitle>Thành công</AlertTitle>
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        {/* Add form */}
        {showAdd && (
          <Card className="shadow-none border-dashed border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Thêm câu hỏi mới</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdd(false)}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[100px_1fr_auto] md:items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Thứ tự
                  </label>
                  <Input
                    type="number"
                    value={newSortOrder}
                    onChange={(e) => setNewSortOrder(e.target.value)}
                    disabled={saving}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Nội dung câu hỏi
                  </label>
                  <Textarea
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra thắng chân và thắng tay..."
                    disabled={saving}
                    rows={2}
                    className="bg-white resize-none"
                  />
                </div>
                <Button
                  onClick={createQuestion}
                  disabled={saving || !newText.trim()}
                  className="md:mb-0.5"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1.5" />
                  )}
                  Lưu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        <Card className="shadow-none overflow-hidden">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Danh sách câu hỏi</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={filter === t.id ? "default" : "outline"}
                    onClick={() => setFilter(t.id)}
                    className="h-8"
                  >
                    {t.label}
                    <Badge
                      variant="secondary"
                      className="ml-1.5 h-5 min-w-5 justify-center px-1.5"
                    >
                      {t.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
          </CardHeader>

          <CardContent className="p-0">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải từ Google Sheet...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="py-14 px-6 text-center space-y-3">
                <div className="text-sm font-medium">
                  {questions.length === 0
                    ? "Chưa có câu hỏi nào"
                    : "Không có câu hỏi trong bộ lọc này"}
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {questions.length === 0
                    ? "Seed sheet Questions (Q01–Q11) hoặc bấm Thêm câu hỏi để tạo mới."
                    : "Đổi sang tab Tất cả hoặc Đang dùng để xem danh sách."}
                </p>
                {questions.length === 0 && (
                  <Button size="sm" onClick={() => setShowAdd(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Thêm câu hỏi đầu tiên
                  </Button>
                )}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <ul className="divide-y">
                {filtered.map((q, idx) => {
                  const isEditing = editId === q.questionId;
                  return (
                    <li
                      key={q.questionId}
                      className={`px-4 py-4 transition-colors ${
                        !q.active ? "bg-zinc-50/80" : "bg-white hover:bg-zinc-50/50"
                      }`}
                    >
                      <div className="flex gap-3 md:gap-4">
                        <div className="shrink-0 w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center text-xs font-semibold text-zinc-600 tabular-nums">
                          {q.sortOrder || idx + 1}
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[11px]">
                              {q.questionId}
                            </Badge>
                            {q.active ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                                Đang dùng
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-zinc-500">
                                Đã tắt
                              </Badge>
                            )}
                            {q.updatedAt ? (
                              <span className="text-[11px] text-muted-foreground">
                                Cập nhật {q.updatedAt}
                              </span>
                            ) : null}
                          </div>

                          {isEditing ? (
                            <div className="grid gap-2 md:grid-cols-[88px_1fr]">
                              <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">
                                  Thứ tự
                                </label>
                                <Input
                                  type="number"
                                  value={editSortOrder}
                                  onChange={(e) => setEditSortOrder(e.target.value)}
                                  disabled={saving}
                                  className="bg-white h-9"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">
                                  Nội dung
                                </label>
                                <Textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  disabled={saving}
                                  rows={3}
                                  className="bg-white resize-none"
                                />
                              </div>
                            </div>
                          ) : (
                            <p
                              className={`text-sm leading-relaxed ${
                                q.active ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {q.text}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col sm:flex-row gap-1.5">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={saving}
                                className="h-8"
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                )}
                                Lưu
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="h-8"
                              >
                                Hủy
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(q)}
                                disabled={saving}
                                className="h-8"
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Sửa
                              </Button>
                              {q.active ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActive(q, false)}
                                  disabled={saving}
                                  className="h-8 text-red-700 border-red-200 hover:bg-red-50"
                                >
                                  <PowerOff className="h-3.5 w-3.5 mr-1" />
                                  Tắt
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActive(q, true)}
                                  disabled={saving}
                                  className="h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                >
                                  <Power className="h-3.5 w-3.5 mr-1" />
                                  Bật
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
