import { useEffect, useState } from "react";
import { AuthCtx } from "./auth";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import { Button, Card, ErrorBanner } from "./components/Common";
import { db } from "./lib/db";
import { useToast } from "./toast";

export default function App() {
  const [me, setMe] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState("");
  const toast = useToast();

  const loadBootstrap = async () => {
    const data = await db.bootstrap();
    setMe(data.me || null);
    setCoaches(data.coaches || []);
    setBranches(data.branches || []);
    setTasks(data.tasks || []);
    setLoadError("");
  };

  const boot = async () => {
    setChecking(true);
    try {
      await loadBootstrap();
    } catch (error) {
      if (error.status !== 401) {
        console.error(error);
        const message = error.message || "초기 데이터를 불러오지 못했습니다.";
        setLoadError(message);
        toast.error(message, { title: "초기 로딩 실패" });
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    boot();
  }, []);

  if (checking) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0E1A", color: "#CBD5E1", fontWeight: 700 }}>로딩 중...</div>;
  }

  if (loadError && !me) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#F8FAFC,#EEF2FF)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <Card style={{ width: "100%", maxWidth: 420, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>앱을 불러오지 못했어요</div>
          <ErrorBanner message={loadError} />
          <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginTop: 10 }}>네트워크 또는 서버 상태를 확인한 뒤 다시 시도해 주세요.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button block onClick={boot}>다시 불러오기</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!me) return <LoginScreen onLogin={async () => { await loadBootstrap(); }} />;

  return (
    <AuthCtx.Provider value={me}>
      <Dashboard
        coaches={coaches}
        branches={branches}
        initialTasks={tasks}
        onLoggedOut={() => {
          setMe(null);
          setCoaches([]);
          setBranches([]);
          setTasks([]);
        }}
      />
    </AuthCtx.Provider>
  );
}
