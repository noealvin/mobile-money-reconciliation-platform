import LoginPage from "./pages/LoginPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

import { useEffect, useState, useRef } from "react";
import api from "./services/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";

// =========================
// CONSTANTS
// =========================
const ISSUE_LABELS = {
  MISSING_IN_OPERATOR: "Absent chez l'opérateur",
  MISSING_IN_MERCHANT: "Absent chez le marchand",
  AMOUNT_MISMATCH: "Montant incorrect",
  STATUS_MISMATCH: "Statut incorrect",
};

const ISSUE_COLORS = {
  MISSING_IN_OPERATOR: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  MISSING_IN_MERCHANT: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  AMOUNT_MISMATCH:     { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  STATUS_MISMATCH:     { bg: "#ede9fe", text: "#6b21a8", dot: "#a855f7" },
};

const STATUS_CONFIG = {
  success:  { label: "Réussies",   color: "#22c55e", bg: "#dcfce7", text: "#166534" },
  failed:   { label: "Échouées",   color: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
  pending:  { label: "En attente", color: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
  reversed: { label: "Annulées",   color: "#94a3b8", bg: "#f1f5f9", text: "#475569" },
};

// ✅ Forme par défaut d'un résumé de réconciliation.
//    Sert de filet de sécurité : si l'API ne renvoie pas (ou mal) le champ
//    `summary`, on s'appuie sur ces valeurs au lieu de planter.
const EMPTY_SUMMARY = {
  total_anomalies: 0,
  missing_transactions: 0,
  amount_mismatches: 0,
  status_mismatches: 0,
  resolved_count: 0,
};

// =========================
// SUB-COMPONENTS
// =========================
function Badge({ type }) {
  const cfg = ISSUE_COLORS[type] || {};
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: cfg.bg, color: cfg.text,
      padding: "4px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {ISSUE_LABELS[type] || type}
    </span>
  );
}

function StatusPill({ status }) {
  const isResolved = status === "RESOLVED";
  return (
    <span style={{
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.03em",
      background: isResolved ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: isResolved ? "#22c55e" : "#ef4444",
      border: `1px solid ${isResolved ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
    }}>
      {isResolved ? "RÉSOLUE" : "OUVERTE"}
    </span>
  );
}

function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#1e293b", borderRadius: 16,
      padding: "20px 24px",
      borderLeft: `4px solid ${color}`,
      border: "1px solid rgba(255,255,255,0.07)",
      borderLeftColor: color,
    }}>
      <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#1e293b", borderRadius: 16, padding: "20px 24px",
      border: "1px solid rgba(255,255,255,0.07)", ...style,
    }}>
      {children}
    </div>
  );
}

// =========================
// MAIN APP
// =========================
export default function App() {

  // ✅ Auth hook (les hooks ne peuvent pas être appelés au niveau module)
  const { token, username, logout } = useAuth();

  // ✅ ids des anomalies marquées résolues localement (disparition immédiate du tableau)
  const [locallyResolved, setLocallyResolved] = useState(() => new Set());

  const [stats, setStats] = useState({});
  const [safeRecon, setReconciliation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const [chartView, setChartView]         = useState("today");
  const [anomalyFilter, setAnomalyFilter] = useState("all");
  const [anomalySearch, setAnomalySearch] = useState("");
  const [anomaliesOpen, setAnomaliesOpen] = useState(true);
  const [anomalyPage, setAnomalyPage]     = useState(1);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [resolvingId, setResolvingId]     = useState(null);
  const profileRef = useRef(null);
  const PER_PAGE = 8;
  const [showWelcome, setShowWelcome] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);

  // ✅ État du simulateur de transactions (start/stop depuis le dashboard)
  const [simState, setSimState] = useState({ running: false, generated: 0 });
  const [simBusy, setSimBusy]   = useState(false);

  // =========================
  // FETCHERS
  // =========================
  const fetchMetrics = async () => {
    try {
      const response = await api.get("/metrics/overview");
      setMetrics(response.data || null);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSimStatus = async () => {
    try {
      const r = await api.get("/simulator/status");
      setSimState(r.data || { running: false, generated: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSimulator = async () => {
    if (simBusy) return;
    setSimBusy(true);
    try {
      const endpoint = simState.running ? "/simulator/stop" : "/simulator/start";
      const r = await api.post(endpoint);
      setSimState(r.data || { running: !simState.running, generated: simState.generated || 0 });
      fetchStats();
    } catch (e) {
      console.error(e);
    } finally {
      setSimBusy(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/dashboard/stats");
      setStats(response.data || {});
      setLastUpdate(new Date().toLocaleTimeString("fr-FR"));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const runReconciliation = async () => {
    try {
      const response = await api.post("/reconciliation/run");
      // ✅ On garde toujours un objet exploitable, même si l'API renvoie
      //    une forme inattendue : summary par défaut + anomalies = [].
      const data = response.data || {};
      setReconciliation({
        summary: { ...EMPTY_SUMMARY, ...(data.summary || {}) },
        anomalies: Array.isArray(data.anomalies) ? data.anomalies : [],
      });
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // RESOLVE ANOMALY
  // =========================
  const resolveAnomaly = async (id) => {
    if (!id) return;
    setResolvingId(id);
    try {
      await api.put(`/anomalies/${id}/resolve`);
      // ✅ disparition immédiate du tableau (sans attendre le prochain refresh)
      setLocallyResolved((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      await runReconciliation();
    } catch (error) {
      console.error(error);
    } finally {
      setResolvingId(null);
    }
  };

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => {
    if (!token) return;
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchSimStatus();
    const interval = setInterval(fetchSimStatus, 4000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    runReconciliation();
    const interval = setInterval(runReconciliation, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // =========================
  // EXPORT CSV (avec Statut)
  // =========================
  const exportCSV = () => {
    const anomalies = safeRecon?.anomalies || [];
    const rows = [
      ["Référence", "Problème détecté", "Statut", "Gravité", "Montant", "Date"],
      ...anomalies.map(a => [
        a.reference,
        ISSUE_LABELS[a.issue] || a.issue,
        a.status || "OPEN",
        a.severity || "—",
        a.amount ?? "—",
        a.detected_at || a.date || a.created_at || "—",
      ]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anomalies_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // =========================
  // CHART DATA — TODAY
  // =========================
  const todayData = [
    { name: "Réussies",   value: stats.today_success_count  || 0, color: "#22c55e" },
    { name: "Échouées",   value: stats.today_failed_count   || 0, color: "#ef4444" },
    { name: "En attente", value: stats.today_pending_count  || 0, color: "#f59e0b" },
    { name: "Annulées",   value: stats.today_reversed_count || 0, color: "#94a3b8" },
  ];

  const sevenDaysData = Array.isArray(stats.weekly_data) ? stats.weekly_data : [];

  // ✅ Résumé toujours sûr (jamais undefined)
  const summary = { ...EMPTY_SUMMARY, ...(safeRecon?.summary || {}) };

  // =========================
  // FILTERED ANOMALIES
  // =========================
  const rawAnomalies = Array.isArray(safeRecon?.anomalies) ? safeRecon.anomalies : [];
  const allAnomalies = rawAnomalies
    .filter(a => (a.status || "OPEN") !== "RESOLVED" && !locallyResolved.has(a.id))
    .slice()
    .sort((a, b) => {
      const da = new Date(a.detected_at || a.date || a.created_at || 0).getTime();
      const db = new Date(b.detected_at || b.date || b.created_at || 0).getTime();
      return db - da;
    });
  const filteredAnomalies = allAnomalies.filter(a => {
    const matchType   = anomalyFilter === "all" || a.issue === anomalyFilter;
    const matchSearch = !anomalySearch || a.reference?.toLowerCase().includes(anomalySearch.toLowerCase());
    return matchType && matchSearch;
  });
  const pagedAnomalies = filteredAnomalies.slice((anomalyPage - 1) * PER_PAGE, anomalyPage * PER_PAGE);
  const totalPages = Math.ceil(filteredAnomalies.length / PER_PAGE);
  const countByType = (type) => allAnomalies.filter(a => a.issue === type).length;

  // ✅ KPIs aujourd'hui (avec fallback all-time pour compat anciennes versions backend)
  const todayTotal    = stats.today_total           ?? stats.total_transactions ?? 0;
  const todaySuccess  = stats.today_success_count   ?? stats.success_count      ?? 0;
  const todayFailed   = stats.today_failed_count    ?? stats.failed_count       ?? 0;
  const todayPending  = stats.today_pending_count   ?? stats.pending_count      ?? 0;
  const todayReversed = stats.today_reversed_count  ?? stats.reversed_count     ?? 0;
  const todayRate     = stats.today_success_rate    ?? stats.success_rate       ?? 0;

  // ✅ Si non authentifié, on rend la page de login (après l'exécution des hooks)
  if (!token) {
    return <LoginPage />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "white",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>

      {/* =========================
          TOPBAR
      ========================== */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "#0f172a",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 14, color: "white", flexShrink: 0,
          }}>MM</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>MM-Recon</p>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Mobile Money Platform</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 8,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 12, color: "#22c55e",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              animation: "pulse 1.5s infinite",
            }} />
            Live
          </div>

          {lastUpdate && (
            <span style={{ fontSize: 12, color: "#64748b" }}>Màj: {lastUpdate}</span>
          )}

          <button onClick={fetchStats} style={topBtnStyle}>🔄 Actualiser</button>

          {/* ✅ Bouton Démarrer / Arrêter le simulateur de transactions */}
          <button
            onClick={toggleSimulator}
            disabled={simBusy}
            title={
              simState.running
                ? `Simulateur ACTIF — ${simState.generated || 0} transaction(s) générée(s)`
                : "Simulateur arrêté"
            }
            style={{
              ...topBtnStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: simState.running ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)",
              border: simState.running ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(59,130,246,0.3)",
              color: simState.running ? "#4ade80" : "#60a5fa",
              fontWeight: 600,
              opacity: simBusy ? 0.6 : 1,
              cursor: simBusy ? "wait" : "pointer",
            }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: simState.running ? "#22c55e" : "#64748b",
                boxShadow: simState.running ? "0 0 8px rgba(34,197,94,0.7)" : "none",
                animation: simState.running ? "pulse 1.5s infinite" : "none",
                flexShrink: 0,
              }}
            />
            {simBusy
              ? "…"
              : simState.running
              ? `■ Arrêter simulation${simState.generated ? ` (${simState.generated})` : ""}`
              : "▶ Démarrer simulation"}
          </button>

          <button
            onClick={runReconciliation}
            style={{ ...topBtnStyle, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
          >
            ▶ Réconciliation
          </button>

          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14, color: "white", flexShrink: 0,
              }}
              title="Mon profil"
            >{(username || "U").charAt(0).toUpperCase()}</button>

            {profileOpen && (
              <div style={{
                position: "absolute", right: 0, top: 44,
                background: "#1e293b", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "8px 0", minWidth: 200,
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)", zIndex: 999,
              }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{username || "Utilisateur"}</p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Connecté</p>
                </div>
                <button style={dropItemStyle}>👤 Mon profil</button>
                <button style={dropItemStyle}>⚙️ Paramètres</button>
                <button
                  onClick={logout}
                  style={{ ...dropItemStyle, borderTop: "1px solid rgba(255,255,255,0.07)", color: "#f87171", marginTop: 4 }}
                >
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================
          MAIN CONTENT
      ========================== */}
      <div style={{ padding: "32px", maxWidth: 1300, margin: "0 auto" }}>

        {/* MESSAGE DE BIENVENUE */}
        {username && showWelcome && (
          <div style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))",
            border: "1px solid rgba(59,130,246,0.25)",
            borderRadius: 14,
            padding: "16px 22px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 16, color: "white", flexShrink: 0,
            }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "white" }}>
                Bienvenue <span style={{ color: "#60a5fa" }}>{username}</span> 👋
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Heureux de vous revoir sur MM-Recon
              </p>
            </div>
          </div>
        )}

        {/* VUE D'ENSEMBLE — AUJOURD'HUI */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap", marginBottom: 16,
        }}>
          <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Vue d'ensemble — aujourd'hui</h2>

          <button
            onClick={() => setShowMetrics(v => !v)}
            disabled={!metrics}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              cursor: metrics ? "pointer" : "not-allowed",
              background: showMetrics ? "rgba(255,255,255,0.05)" : "rgba(59,130,246,0.15)",
              border: `1px solid ${showMetrics ? "rgba(255,255,255,0.1)" : "rgba(59,130,246,0.3)"}`,
              color: showMetrics ? "#94a3b8" : "#60a5fa",
              fontSize: 13, fontWeight: 600,
              opacity: metrics ? 1 : 0.5,
            }}
          >
            {showMetrics ? "▲ Masquer les détails" : "▼ Détails"}
          </button>
        </div>

        {metrics && showMetrics && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
            marginBottom: 32,
          }}>
            <KpiCard label="Réconciliations"     value={metrics.total_runs ?? 0}          color="#8b5cf6" />
            <KpiCard label="Anomalies ouvertes"  value={metrics.open_anomalies ?? 0}      color="#ef4444" />
            <KpiCard label="Anomalies résolues"  value={metrics.resolved_anomalies ?? 0}  color="#22c55e" />
            <KpiCard label="Taux succès global"  value={`${metrics.success_rate ?? 0}%`}  color="#3b82f6" />
          </div>
        )}

        {isLoadingStats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16, marginBottom: 32 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ background: "#1e293b", borderRadius: 16, padding: "20px 24px", height: 96, opacity: 0.5 }}>
                <div style={{ background: "#334155", borderRadius: 6, height: 10, width: "55%", marginBottom: 14 }} />
                <div style={{ background: "#334155", borderRadius: 6, height: 26, width: "38%" }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16, marginBottom: 32 }}>
            <KpiCard label="Total transactions" value={todayTotal.toLocaleString("fr-FR")}    color="#3b82f6" sub="aujourd'hui" />
            <KpiCard label="Réussies"           value={todaySuccess.toLocaleString("fr-FR")}  color="#22c55e" sub={`${todayRate}% du jour`} />
            <KpiCard label="Échouées"           value={todayFailed.toLocaleString("fr-FR")}   color="#ef4444" />
            <KpiCard label="En attente"         value={todayPending.toLocaleString("fr-FR")}  color="#f59e0b" />
            <KpiCard label="Annulées"           value={todayReversed.toLocaleString("fr-FR")} color="#94a3b8" />
          </div>
        )}

        {/* GRAPHIQUE */}
        <Card style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Analyse des transactions
              <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>
                {chartView === "today" ? "— uniquement aujourd'hui" : "— 7 derniers jours"}
              </span>
            </h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={() => setChartView("today")} style={tabBtnStyle(chartView === "today")}>Aujourd'hui</button>
                <button onClick={() => setChartView("7days")} style={tabBtnStyle(chartView === "7days")}>7 derniers jours</button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: v.color, flexShrink: 0 }} />
                {v.label}
              </span>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            {chartView === "today" ? (
              <BarChart data={todayData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {todayData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={sevenDaysData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="success"  name="Réussies"   stackId="a" fill="#22c55e" />
                <Bar dataKey="failed"   name="Échouées"   stackId="a" fill="#ef4444" />
                <Bar dataKey="pending"  name="En attente" stackId="a" fill="#f59e0b" />
                <Bar dataKey="reversed" name="Annulées"   stackId="a" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </Card>

        {/* RÉCONCILIATION */}
        {safeRecon && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={sectionTitleStyle}>Résultats de la réconciliation</h2>

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#1e293b", borderRadius: anomaliesOpen ? "16px 16px 0 0" : 16,
              padding: "20px 24px",
              border: "1px solid rgba(239,68,68,0.2)",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "rgba(239,68,68,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, flexShrink: 0,
                }}>⚠️</div>
                <div>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 2px" }}>Anomalies à investiguer</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: "#ef4444", margin: 0, lineHeight: 1 }}>
                    {summary.total_anomalies}
                  </p>
                  {summary.resolved_count > 0 && (
                    <p style={{ fontSize: 11, color: "#22c55e", margin: "4px 0 0", fontWeight: 600 }}>
                      ✓ {summary.resolved_count} déjà résolue{summary.resolved_count > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Transactions manquantes", val: summary.missing_transactions, color: "#f59e0b" },
                    { label: "Montants incorrects",     val: summary.amount_mismatches,    color: "#3b82f6" },
                    { label: "Statuts incorrects",      val: summary.status_mismatches,    color: "#a855f7" },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: "#0f172a", borderRadius: 10, padding: "8px 14px",
                      border: `1px solid ${item.color}30`,
                    }}>
                      <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: item.color, margin: 0 }}>{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setAnomaliesOpen(v => !v)}
                style={{
                  padding: "10px 20px", borderRadius: 10, cursor: "pointer",
                  background: anomaliesOpen ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.12)",
                  border: `1px solid ${anomaliesOpen ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.3)"}`,
                  color: anomaliesOpen ? "#94a3b8" : "#f87171",
                  fontWeight: 600, fontSize: 13,
                }}
              >
                {anomaliesOpen ? "▲ Masquer" : "▼ Voir les anomalies"}
              </button>
            </div>

            {/* TABLE */}
            {anomaliesOpen && (
              <div style={{
                background: "#1e293b",
                border: "1px solid rgba(239,68,68,0.2)",
                borderTop: "none",
                borderRadius: "0 0 16px 16px",
                padding: "20px 24px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    Détail des anomalies
                    <span style={{ fontSize: 13, fontWeight: 400, color: "#64748b", marginLeft: 8 }}>
                      ({filteredAnomalies.length} résultat{filteredAnomalies.length !== 1 ? "s" : ""})
                    </span>
                  </h3>
                  <button onClick={exportCSV} style={exportBtnStyle}>↓ Exporter CSV</button>
                </div>

                {/* Search */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "9px 14px", marginBottom: 14,
                }}>
                  <span style={{ color: "#64748b" }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Chercher par référence de transaction…"
                    value={anomalySearch}
                    onChange={e => { setAnomalySearch(e.target.value); setAnomalyPage(1); }}
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      color: "white", fontSize: 13, flex: 1,
                    }}
                  />
                  {anomalySearch && (
                    <button
                      onClick={() => { setAnomalySearch(""); setAnomalyPage(1); }}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}
                    >✕</button>
                  )}
                </div>

                {/* Filter chips - TYPE */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {[
                    { key: "all",                   label: `Tous (${allAnomalies.length})` },
                    { key: "MISSING_IN_OPERATOR",   label: `Absent opérateur (${countByType("MISSING_IN_OPERATOR")})` },
                    { key: "MISSING_IN_MERCHANT",   label: `Absent marchand (${countByType("MISSING_IN_MERCHANT")})` },
                    { key: "AMOUNT_MISMATCH",       label: `Montant (${countByType("AMOUNT_MISMATCH")})` },
                    { key: "STATUS_MISMATCH",       label: `Statut (${countByType("STATUS_MISMATCH")})` },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => { setAnomalyFilter(f.key); setAnomalyPage(1); }}
                      style={chipStyle(anomalyFilter === f.key, "#3b82f6")}
                    >{f.label}</button>
                  ))}
                </div>

                {/* Table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        {["Référence", "Problème détecté", "Statut", "Gravité", "Montant", "Date", "Action"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: h === "Montant" || h === "Date" ? "right" : (h === "Action" ? "center" : "left"),
                              padding: "10px 14px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#64748b",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {pagedAnomalies.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                            Aucune anomalie trouvée
                          </td>
                        </tr>
                      ) : (
                        pagedAnomalies.map((anomaly) => {
                          const status = anomaly.status || "OPEN";
                          const isResolved = status === "RESOLVED";
                          return (
                            <tr
                              key={anomaly.id ?? anomaly.reference}
                              style={{
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                transition: "background .15s",
                                opacity: isResolved ? 0.55 : 1,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{
                                padding: "12px 14px",
                                fontFamily: "monospace",
                                fontSize: 12,
                                color: "#94a3b8",
                                whiteSpace: "nowrap",
                              }}>
                                {anomaly.reference}
                              </td>

                              <td style={{ padding: "12px 14px" }}>
                                <Badge type={anomaly.issue} />
                              </td>

                              <td style={{ padding: "12px 14px" }}>
                                <StatusPill status={status} />
                              </td>

                              <td style={{ padding: "12px 14px" }}>
                                <span style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color:
                                    anomaly.severity === "high" ? "#ef4444" :
                                    anomaly.severity === "med"  ? "#f59e0b" : "#94a3b8",
                                }}>
                                  {anomaly.severity === "high" ? "🔴 Haute"
                                    : anomaly.severity === "med" ? "🟡 Moyenne"
                                    : anomaly.severity ? `⚪ ${anomaly.severity}` : "—"}
                                </span>
                              </td>

                              <td style={{
                                padding: "12px 14px",
                                color: anomaly.amount ? "#f87171" : "#64748b",
                                fontWeight: anomaly.amount ? 600 : 400,
                                textAlign: "right",
                                whiteSpace: "nowrap",
                              }}>
                                {anomaly.amount ?? "—"}
                              </td>

                              <td style={{
                                padding: "12px 14px",
                                fontSize: 12,
                                color: "#64748b",
                                textAlign: "right",
                                whiteSpace: "nowrap",
                              }}>
                                {anomaly.detected_at || anomaly.date || anomaly.created_at || "—"}
                              </td>

                              <td style={{ padding: "12px 14px", textAlign: "center" }}>
                                {isResolved ? (
                                  <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                                ) : anomaly.id ? (
                                  <button
                                    onClick={() => resolveAnomaly(anomaly.id)}
                                    disabled={resolvingId === anomaly.id}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: 8,
                                      border: "none",
                                      cursor: resolvingId === anomaly.id ? "wait" : "pointer",
                                      background: "#22c55e",
                                      color: "white",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      opacity: resolvingId === anomaly.id ? 0.6 : 1,
                                    }}
                                  >
                                    {resolvingId === anomaly.id ? "…" : "Résoudre"}
                                  </button>
                                ) : (
                                  <span style={{ color: "#475569", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                    <button onClick={() => setAnomalyPage(p => Math.max(1, p - 1))} disabled={anomalyPage === 1} style={pageBtnStyle(false)}>‹</button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} onClick={() => setAnomalyPage(i + 1)} style={pageBtnStyle(anomalyPage === i + 1)}>{i + 1}</button>
                    ))}
                    <button onClick={() => setAnomalyPage(p => Math.min(totalPages, p + 1))} disabled={anomalyPage === totalPages} style={pageBtnStyle(false)}>›</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}

// =========================
// STYLE HELPERS
// =========================
const sectionTitleStyle = {
  fontSize: 16, fontWeight: 600, color: "white",
  margin: "0 0 16px",
};

const topBtnStyle = {
  padding: "7px 14px", borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8", cursor: "pointer", fontSize: 12,
};

const exportBtnStyle = {
  padding: "8px 16px", borderRadius: 8,
  background: "rgba(59,130,246,0.15)",
  border: "1px solid rgba(59,130,246,0.3)",
  color: "#60a5fa", cursor: "pointer",
  fontSize: 13, fontWeight: 600,
};

const dropItemStyle = {
  width: "100%", textAlign: "left", padding: "10px 16px",
  background: "none", border: "none", color: "#cbd5e1",
  cursor: "pointer", fontSize: 13, display: "block",
};

const tabBtnStyle = (active) => ({
  padding: "6px 14px", borderRadius: 6,
  background: active ? "#1e293b" : "transparent",
  border: active ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
  color: active ? "white" : "#64748b",
  cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
});

const pageBtnStyle = (active) => ({
  padding: "5px 11px", borderRadius: 8,
  background: active ? "rgba(59,130,246,0.2)" : "transparent",
  border: active ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
  color: active ? "#60a5fa" : "#64748b",
  cursor: "pointer", fontSize: 12,
});

const chipStyle = (active, color = "#3b82f6") => ({
  padding: "5px 14px", borderRadius: 999,
  border: active ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.1)",
  background: active ? `${color}22` : "transparent",
  color: active ? color : "#94a3b8",
  fontSize: 12, cursor: "pointer",
  fontWeight: active ? 600 : 400,
});
