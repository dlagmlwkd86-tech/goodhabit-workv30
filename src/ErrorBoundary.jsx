import React from "react";
import { Button, Card } from "./components/Common";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("app render error", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#F8FAFC,#EEF2FF)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <Card style={{ width: "100%", maxWidth: 460, padding: 22 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>앱 화면을 표시하는 중 문제가 생겼어요</div>
          <div style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.7, marginBottom: 16 }}>
            일시적인 데이터 오류이거나 오래된 캐시 때문에 화면이 깨졌을 수 있어요. 새로고침 후 다시 시도해 주세요.
          </div>
          {this.state.error?.message ? (
            <div style={{ padding: "10px 12px", borderRadius: 14, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
              {this.state.error.message}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={this.handleReload}>새로고침</Button>
            <Button variant="secondary" onClick={() => this.setState({ hasError: false, error: null })}>다시 시도</Button>
          </div>
        </Card>
      </div>
    );
  }
}
