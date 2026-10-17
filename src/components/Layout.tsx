import { Outlet, useLocation } from "react-router-dom";
import Footer from "./Footer";
import Header from "./Header";

export default function Layout() {
  const location = useLocation();

  const isLogin = location.pathname === "/dang-nhap";

  const isStaffOrAdmin =
    location.pathname.startsWith("/staff") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/manager");

  return (
    <div className="app-shell">
      {!isLogin && <Header />}

      <main
        className={
          isLogin
            ? "app-main"
            : isStaffOrAdmin
              ? "app-main app-main--workspace"
              : "app-main"
        }
      >
        <Outlet />
      </main>

      {!isLogin && !isStaffOrAdmin && <Footer />}
    </div>
  );
}
