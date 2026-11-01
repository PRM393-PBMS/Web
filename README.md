# PBMS Web (back-office)

Web cho nhân viên cổng, quản lý bãi và quản trị hệ thống của PBMS. Khách hàng dùng app di động (repo `Frontend`).
Tài khoản khách đăng nhập web sẽ bị từ chối và được hướng sang app.

React 19 + TypeScript + Vite. Gọi API backend NestJS (repo `Backend`).

## Chạy

```powershell
npm ci
npm run dev -- --port 5173 --strictPort
```

| Biến môi trường | Mặc định | Ghi chú |
|---|---|---|
| `VITE_API_BASE_URL` | `https://prm393backend.onrender.com/api` | Gốc API có `/api`. Các API không có tiền tố (ví dụ `/parkings`) tự bỏ `/api`. |

Origin của web phải nằm trong `CORS_ORIGIN` của backend.

Kiểm tra trước khi tạo PR:

```powershell
npm run lint
npm run build
```

## Khu chức năng

| Vai trò | Đường dẫn | Chức năng |
|---|---|---|
| staff | `/staff/*` | Tổng quan ca trực, check-in, đơn đặt trước, xe trong bãi, checkout, xử lý sự cố. Nhận lượt quét biển số realtime từ điện thoại (SSE `GateScan/stream`). |
| manager | `/manager/*` | Bãi đỗ, loại xe, tầng, cổng, ô đỗ, bảng giá, gói tháng, vé tháng (gia hạn tại quầy, hợp đồng), phiên gửi xe, đặt chỗ, thanh toán (đối soát PayOS), đổi biển số, sự cố, báo cáo, ví khuyến mãi. |
| admin | `/admin/*` | Tài khoản, vai trò, báo cáo toàn hệ thống, ví khuyến mãi. |

## Cổng vào / ra bằng biển số

- Xe đã **đăng ký gửi 1 lần** trên app: check-in khách vãng lai bằng biển số là đủ, backend tự nhận đăng ký.
  Camera không đọc được biển thì nhập mã 6 ký tự khách đọc (ô "Mã gửi xe 1 lần (dự phòng)").
- Xe đã **trả trước** trên app: checkout bằng biển số hoặc vé, không thu thêm. Có thể nhập tay mã ra cổng 6 ký tự.
- Khách **mất vé**: nhập biển số rồi bấm "Tìm xe theo biển số".

Chi tiết luồng realtime: [`docs/staff-gate-scan-realtime.md`](docs/staff-gate-scan-realtime.md).
