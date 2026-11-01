# Nhận lượt quét biển số từ điện thoại

Web staff đã kết nối các API GateScan có sẵn của backend. Không cần migration hoặc thư viện mới.

## Sử dụng

1. Đăng nhập web bằng tài khoản có role `staff`, chọn tầng và cổng vào hoặc cổng ra.
2. Trên Flutter staff, chọn cùng `gateId`, chụp và gửi ảnh. Mobile tiếp tục dùng `POST /api/GateScan`.
3. Bảng **Lượt quét từ điện thoại** trên web nhận ảnh, biển số và trạng thái trực tiếp.
4. Bấm **Dùng lượt quét** để điền ảnh và biển số vào form. Cổng vào dùng thông tin đặt chỗ đúng giờ nếu phù hợp khu đang chọn. Cổng ra lấy phiên đang hoạt động từ kết quả backend rồi chạy lại các bước đối chiếu xe, tầng và phí hiện có.
5. Kiểm tra thông tin và xác nhận vào/ra bãi. Luồng này không tự cho xe vào/ra và không tự xác nhận thanh toán.

Ảnh mới không ghi đè xe đang nhập hoặc xe đang chờ thanh toán. Ảnh không đọc được biển số vẫn hiện để nhân viên tự nhập. Có thể chụp bằng camera web như trước.

Lượt quét được đánh dấu `Handled` sau check-in thành công, checkout không cần thanh toán, xác nhận tiền mặt thành công hoặc PayOS đã báo thanh toán thành công. Tạo yêu cầu thanh toán đang chờ không đánh dấu đã xử lý. Có nút **Đã xử lý** và **Bỏ qua** để cập nhật thủ công. Nếu cập nhật trạng thái lỗi sau khi nghiệp vụ đã thành công, kiểm tra kết quả rồi đánh dấu lại; không gửi lại check-in/checkout chỉ để sửa nhãn lượt quét.

## Kết nối

- `GET /api/GateScan/stream?gateId=...`: nhận `scan`, `scan-updated`, bỏ qua `ping`.
- `GET /api/GateScan/recent?gateId=...&limit=20`: tải lịch sử khi kết nối và khi kết nối lại.
- `PATCH /api/GateScan/{id}/status`: gửi `{ "status": "Handled" }` hoặc `{ "status": "Dismissed" }`.
- Dùng `fetch` với header Bearer token, tái sử dụng cơ chế refresh token của `ApiClient`. Không đưa token vào URL.
- Ngắt mạng/EOF/lỗi máy chủ: thử lại từ 3 giây, tăng tối đa 30 giây. 403/404 hiển thị lỗi quyền hoặc backend thiếu API; không lặp vô hạn. 401 refresh một lần trước khi kết thúc phiên.
- Đổi trang hoặc cổng sẽ hủy reader/kết nối cũ. Web lọc lại `gateId` trước khi hiển thị, gộp theo `scanId` và giữ tối đa 20 lượt gần nhất. Lượt đang chọn vẫn được theo dõi trạng thái khi có nhiều ảnh mới.
- SSE mới được ưu tiên hơn phản hồi lịch sử cũ đến chậm. Lượt đã xử lý hoặc bỏ qua trên web khác sẽ khóa xác nhận của lượt đang chọn.

Backend hiện phát SSE trong bộ nhớ của một tiến trình. Cấu hình nhiều instance cần kênh phát chung ở backend. Lịch sử 20 lượt không đảm bảo khôi phục toàn bộ lượt cũ nếu mất mạng lâu.

## Chạy và kiểm tra local

```powershell
npm install
npm run dev -- --port 5173 --strictPort
```

`VITE_API_BASE_URL` mặc định là `https://prm393backend.onrender.com/api`. Origin web cần khớp `CORS_ORIGIN` của backend; bản Render đã kiểm tra trước đó cho phép `http://localhost:5173`.

Nếu chưa có điện thoại, mở web staff ở cổng cần kiểm tra và dùng Swagger backend: đăng nhập staff/manager, gọi `POST /api/GateScan` với `file`, UUID `gateId` giống web và `capturedAt` dạng ISO 8601. Đây là thao tác tạo lượt quét thật; dùng dữ liệu và môi trường phù hợp.

Kiểm tra Network thấy request `GateScan/stream` còn mở là bình thường. Kiểm tra bảng lượt quét để xác nhận sự kiện đã tới; không chỉ dựa vào trạng thái kết nối.

## Kiểm chứng thay đổi

Đã qua 45 kiểm tra trình duyệt Edge bằng Playwright với API và luồng SSE giả lập (12 kiểm tra parser/API, 24 kiểm tra giao diện/luồng vào-ra, 9 kiểm tra bổ sung cho PayOS, lịch sử lỗi, form bận và đổi cổng); không gọi OCR, thanh toán hay database production. Bao phủ parser SSE, refresh token, ảnh mới/sai cổng/trùng lượt, ảnh không đọc được biển số, lịch sử đến chậm, tự kết nối lại, đổi cổng, bảo vệ form đang xử lý, check-in, checkout tiền mặt và PayOS. Script kiểm tra tạm được xóa sau khi chạy theo yêu cầu.

Build TypeScript/Vite thành công (còn cảnh báo bundle lớn). Sau khi sửa thêm lỗi effect trong `ParkingMap.tsx`, lint toàn repo còn 15 lỗi và 4 cảnh báo có sẵn; các file mới và `ParkingMap.tsx` sạch lint, các file realtime đã sửa không phát sinh thêm lỗi lint. Chưa kiểm tra camera trên điện thoại thật hoặc luồng mobile tới Render thật.

Tham khảo định dạng SSE: [MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
