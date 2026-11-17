# GAS — Quản lý câu hỏi checklist

Next.js proxy tới các action dưới đây. **Source GAS trong repo:** [`docs/code.gs`](../code.gs) — paste vào Apps Script rồi **Deploy** web app mới (cập nhật `GAS_URL` / `NEXT_PUBLIC_GAS_URL` nếu URL đổi).

Utility rebuild summary: [`docs/Untitled.gs`](../Untitled.gs) (không đổi).

## Sheet `Questions`

Tạo tab tên đúng **`Questions`**, hàng 1 là header:

| questionId | sortOrder | text | active | updatedAt |
|------------|-----------|------|--------|-----------|

- `questionId`: ID ổn định (`Q01`, `Q12`, …) — **không đổi** khi sửa nội dung.
- `sortOrder`: số thứ tự hiển thị (nhỏ hơn = trên trước).
- `text`: nội dung câu hỏi.
- `active`: `TRUE` / `FALSE` (soft-delete).
- `updatedAt`: ISO string (ví dụ `2026-11-17T07:00:00.000Z`).

### Seed Q01–Q11 (copy vào sheet)

| questionId | sortOrder | text | active |
|------------|-----------|------|--------|
| Q01 | 1 | Kiểm tra càng nâng, trụ nâng, ben thuỷ lực và các phụ kiện không có bất cứ dấu hiệu hư hỏng nào | TRUE |
| Q02 | 2 | Kiểm tra bánh xe, các dây đai an toàn, sự cố rò rỉ dưới thân xe | TRUE |
| Q03 | 3 | Kiểm tra vệ sinh xe trước khi sử dụng | TRUE |
| Q04 | 4 | Kiểm tra sự chắc chắn của đầu nối bình ắc quy và ổ cắm sạc | TRUE |
| Q05 | 5 | Kiểm tra châm nước bình định kỳ | TRUE |
| Q06 | 6 | Kiểm tra tình trạng và khả năng điều chỉnh của ghế ngồi và dây an toàn | TRUE |
| Q07 | 7 | Kiểm tra tất cả các bàn đạp và cần điều khiển về sự vận hành trơn tru | TRUE |
| Q08 | 8 | Kiểm tra thắng chân và thắng tay về sự hoạt động an toàn | TRUE |
| Q09 | 9 | Kiểm tra tình trạng của động cơ, động cơ thủy lực nâng hạ và các cơ cấu chuyền động khác | TRUE |
| Q10 | 10 | Kiểm tra đèn, đèn cảnh báo, kèn/ còi và còi de/ lùi | TRUE |
| Q11 | 11 | Kiểm tra bất kỳ sự hư hỏng hoặc khuyết tật nào được nhìn thấy | TRUE |

## Contract API

### `GET ?action=questions`

Query:

- `activeOnly=true` — chỉ câu `active=TRUE` (form `/check`)
- không có / `false` — tất cả (trang admin)

Response:

```json
{
  "questions": [
    {
      "questionId": "Q01",
      "sortOrder": 1,
      "text": "...",
      "active": true,
      "updatedAt": "2026-11-17T07:00:00.000Z"
    }
  ]
}
```

Sắp xếp theo `sortOrder` tăng dần.

### `POST ?action=saveQuestion`

Body (tạo mới — bỏ `questionId` hoặc để trống; GAS tự sinh `Q12`, …):

```json
{
  "text": "Nội dung câu mới",
  "sortOrder": 12
}
```

Body (cập nhật):

```json
{
  "questionId": "Q03",
  "text": "Nội dung đã sửa",
  "sortOrder": 3
}
```

Response: `{ "ok": true, "question": { ... } }` hoặc `{ "error": "..." }`.

### `POST ?action=setQuestionActive`

```json
{ "questionId": "Q05", "active": false }
```

Response: `{ "ok": true, "question": { ... } }`.

### `POST ?action=submitChecklist` (cập nhật)

Body answers **mới** (snapshot):

```json
{
  "forkliftCode": "FL-0001",
  "employeeCode": "NV001",
  "employeeName": "Nguyen Van A",
  "issueDescription": "",
  "answers": [
    {
      "questionId": "Q01",
      "questionText": "Kiểm tra càng nâng...",
      "answer": "PASS"
    }
  ]
}
```

Khi ghi report (`docs/code.gs`):

- Cột **`answersJson`** (tự thêm vào sheet `reports` nếu thiếu): JSON snapshot `[{ questionId, questionText, answer }, ...]` — source of truth cho submit mới.
- Vẫn fill **11 cột answer** ngay sau `employeeName` (layout cũ) bằng tối đa 11 câu đầu để tương thích.
- Không còn bắt buộc đúng 11 câu.

**Tương thích cũ:** nếu body vẫn là `answers: ["PASS","FAIL",...]` (mảng theo thứ tự), map index `0→Q01` … `10→Q11` và lấy text từ sheet Questions.

### `GET ?action=driverReports` (cập nhật `issueItems`)

Mỗi item:

```json
{
  "questionId": "Q02",
  "questionText": "Kiểm tra bánh xe...",
  "answer": "FAIL"
}
```

Fallback báo cáo cũ chỉ có số câu `q: 2`:

- `questionId = "Q" + pad(q, 2)` → `Q02`
- `questionText` = text hiện tại trên sheet (hoặc seed) theo id đó

## Implement trong repo

Logic đầy đủ (CRUD, normalize answers, `answersJson`, `driverReports` dual-mode) nằm trong [`docs/code.gs`](../code.gs). Không cần dán mẫu rời bên dưới.

### Checklist deploy

1. Tạo tab **Questions**, seed Q01–Q11 (bảng trên).
2. Paste toàn bộ `docs/code.gs` vào project Apps Script (thay file chính).
3. Deploy lại Web app → copy URL vào `GAS_URL` và `NEXT_PUBLIC_GAS_URL`.
4. Cột `answersJson` trên `reports` sẽ được script tự thêm khi submit lần đầu (hoặc thêm thủ công ở cuối header).

## Báo cáo cũ (index → Q01–Q11)

`getDriverReports` trong `code.gs`:

- Có `answersJson` → parse snapshot → `issueItems` với `questionId` + `questionText`.
- Không có → đọc 11 cột sau `employeeName`, map `1→Q01` … + text từ sheet Questions.
