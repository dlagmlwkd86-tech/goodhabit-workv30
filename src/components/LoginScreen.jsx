import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../lib/db";
import { Button, Card, ErrorBanner, Badge, Icon, ThemeSwitcher } from "./Common";

export default function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [options, setOptions] = useState({ coaches: [], branches: [] });
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const refs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingOptions(true);
      try {
        const data = await db.loginOptions();
        if (!alive) return;
        const next = { coaches: data.coaches || [], branches: data.branches || [] };
        setOptions(next);
        const firstCoachId = next.coaches[0]?.id || "";
        setSelectedCoachId((prev) => prev || firstCoachId);
        setOptionsError("");
      } catch (e) {
        if (!alive) return;
        setOptionsError(e.message || "로그인 목록을 불러오지 못했습니다");
      } finally {
        if (alive) setLoadingOptions(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const branchMap = useMemo(() => Object.fromEntries((options.branches || []).map((branch) => [branch.id, branch])), [options.branches]);
  const selectedCoach = useMemo(() => (options.coaches || []).find((coach) => coach.id === selectedCoachId) || null, [options.coaches, selectedCoachId]);

  const submitLogin = async (digits = pin) => {
    if (!selectedCoachId) {
      setError("먼저 로그인할 코치를 선택해주세요");
      return;
    }
    if (!digits.every(Boolean)) {
      setError("PIN 4자리를 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await db.login(selectedCoachId, digits.join(""));
      await onLogin();
    } catch (e) {
      setError(e.message || "PIN이 일치하지 않습니다");
      setPin(["", "", "", ""]);
      refs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const hi = async (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...pin];
    next[i] = v;
    setPin(next);
    setError("");
    if (v && i < 3) refs[i + 1].current?.focus();
    if (v && i === 3 && next.every(Boolean)) {
      await submitLogin(next);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--hero-gradient)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-24%", right: "-12%", width: 360, height: 360, borderRadius: "50%", background: "var(--hero-accent-a)" }} />
      <div style={{ position: "absolute", bottom: "-18%", left: "-14%", width: 320, height: 320, borderRadius: "50%", background: "var(--hero-accent-b)" }} />
      <div style={{ position: "absolute", top: 18, right: 18, zIndex: 2 }}><ThemeSwitcher compact /></div>
      <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#FDBA74", letterSpacing: 3.2, marginBottom: 12 }}>GOOD HABITS PT</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: -0.6 }}>좋은습관<span style={{ color: "#FF9C73" }}>PT</span></div>
        <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 8 }}>센터 과제관리 앱</div>
      </div>
      <Card style={{ borderRadius: 30, padding: "34px 28px 30px", width: "100%", maxWidth: 420, textAlign: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", position: "relative" }}>
        <Badge tone="dark" icon="pin" style={{ marginBottom: 18, padding: "8px 12px" }}>코치 선택 + 서버 검증 PIN 로그인</Badge>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#F8FAFC", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="users" size={17} /> 로그인할 코치 선택</div>

        {loadingOptions ? (
          <div style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 18 }}>코치 목록을 불러오는 중...</div>
        ) : optionsError ? (
          <ErrorBanner message={optionsError} />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
              {(options.coaches || []).map((coach) => {
                const branch = coach.branch_id ? branchMap[coach.branch_id] : null;
                const active = selectedCoachId === coach.id;
                return (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={() => { setSelectedCoachId(coach.id); setError(""); refs[0].current?.focus(); }}
                    style={{
                      borderRadius: 16,
                      border: active ? "1.8px solid rgba(255,179,111,0.8)" : "1px solid rgba(255,255,255,0.12)",
                      background: active ? "rgba(255,179,111,0.14)" : "rgba(255,255,255,0.06)",
                      color: "#fff",
                      padding: "12px 12px 11px",
                      textAlign: "left",
                      cursor: "pointer",
                      boxShadow: active ? "0 14px 28px rgba(255,179,111,0.12)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{coach.emoji || "🏋️"}</span>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{coach.name}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: active ? "#FFE7D1" : "#CBD5E1" }}>
                      {coach.role === "owner" ? "대표/관리자" : branch?.name || "코치"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 16, fontWeight: 800, color: "#F8FAFC", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="lock" size={17} /> PIN 코드 입력</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
              {pin.map((d, i) => (
                <input key={i} ref={refs[i]} value={d} onChange={(e) => hi(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !pin[i] && i > 0) refs[i - 1].current?.focus(); if (e.key === "Enter") submitLogin(); }} onFocus={(e) => e.target.select()} type="tel" inputMode="numeric" maxLength={1} style={{ width: 58, height: 68, borderRadius: 18, border: `1.8px solid ${error ? "#FCA5A5" : d ? "#FFB36F" : "rgba(255,255,255,0.14)"}`, textAlign: "center", fontSize: 28, fontWeight: 900, fontFamily: "inherit", outline: "none", background: d ? "rgba(255,179,111,0.12)" : "rgba(255,255,255,0.06)", color: "#fff", boxShadow: d ? "0 12px 24px rgba(255,179,111,0.14)" : "none" }} />
              ))}
            </div>
            {selectedCoach ? (
              <div style={{ fontSize: 12, color: "#CBD5E1", marginBottom: 14 }}>
                <strong style={{ color: "#fff" }}>{selectedCoach.name}</strong> 계정으로 로그인합니다.
              </div>
            ) : null}
            {error ? <ErrorBanner message={error} /> : null}
            <Button variant="warm" block icon="lock" disabled={loading || loadingOptions || !selectedCoachId} onClick={() => submitLogin()} style={{ marginTop: 12 }}>
              {loading ? "확인 중..." : "로그인"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
