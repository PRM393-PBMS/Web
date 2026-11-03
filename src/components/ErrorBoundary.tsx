import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface State {
  error: Error | null
}

/** Lỗi khi vẽ một trang (dữ liệu sai dạng, tải trang thất bại sau khi deploy) chỉ làm hỏng trang đó, không làm trắng cả web. */
class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi hiển thị trang:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    // Tải trang lỗi sau khi có bản web mới: tải lại là được bản mới.
    const chunk = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(this.state.error.message)
    return (
      <div className="page-loading" role="alert">
        <div>
          <strong>{chunk ? 'Web vừa được cập nhật.' : 'Trang gặp lỗi khi hiển thị.'}</strong>
          <p>{chunk ? 'Tải lại trang để dùng bản mới.' : 'Thử tải lại trang. Nếu vẫn lỗi, chuyển sang trang khác rồi quay lại.'}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </div>
    )
  }
}

/** Đổi trang thì xoá lỗi cũ: lỗi ở một trang không chặn các trang khác. */
export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
}
