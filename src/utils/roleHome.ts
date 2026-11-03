/** Trang chủ theo vai trò; vai trò không dùng web (khách, vai trò lạ) thì về đăng nhập. */
export function roleHome(role?: string): string {
  return role === 'staff' || role === 'manager' || role === 'admin' ? `/${role}/dashboard` : '/dang-nhap'
}
