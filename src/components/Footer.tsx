import { Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

const LOGO_SRC = "/image/logo.png";

export default function Footer() {
  const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()));

  return (
    <footer className="site-footer" id="support">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src={LOGO_SRC} alt="EasyParking" className="footer-logo" />
          <div>
            <strong>
              <span className="brand-easy">Easy</span>
              <span className="brand-parking">Parking</span>
            </strong>
            <p>Hệ thống đặt trước chỗ đỗ xe thông minh</p>
          </div>
        </div>

        <div className="footer-columns">
          <div className="footer-links">
            <h4>Dịch vụ</h4>
            <ul>
              <li><Link to="/dat-cho">Đặt chỗ ngắn hạn</Link></li>
              <li><Link to="/dang-ky-thang">Đăng ký thẻ tháng</Link></li>
              <li><Link to="/lich-su">Lịch sử đặt chỗ</Link></li>
            </ul>
          </div>

          <div className="footer-links">
            <h4>Điều khoản</h4>
            <ul>
              <li><Link to={{ pathname: '/legal', hash: '#terms' }}>Điều khoản sử dụng</Link></li>
              <li><Link to={{ pathname: '/legal', hash: '#privacy' }}>Chính sách bảo mật</Link></li>
              <li><Link to={{ pathname: '/legal', hash: '#booking-rules' }}>Quy định đặt chỗ</Link></li>
              <li><Link to={{ pathname: '/legal', hash: '#cancellation' }}>Chính sách hủy đặt chỗ</Link></li>
            </ul>
          </div>

          <div className="footer-contact">
            <h4>Hỗ trợ</h4>
            <p><Phone size={16} strokeWidth={2} aria-hidden /> Hotline: 1900 6868</p>
            <p><Mail size={16} strokeWidth={2} aria-hidden /> support@easyparking.vn</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {year} EasyParking - Nhóm 6.</p>
      </div>
    </footer>
  );
}
