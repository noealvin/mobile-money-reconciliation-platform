import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

// ✅ Identifiants par défaut — pré-remplis pour faciliter la démo.
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "123456";

export default function LoginPage() {
  const { login } = useAuth();

  // ✅ Champs pré-remplis : l'utilisateur n'a qu'à cliquer "Se connecter".
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState("");

  // ✅ État de chargement + message "le serveur se réveille"
  const [loading, setLoading] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const slowTimer = useRef(null);

  // Nettoyage du timer si le composant est démonté en cours de requête
  useEffect(() => {
    return () => clearTimeout(slowTimer.current);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return; // évite les double-clics

    setError("");
    setLoading(true);
    setSlowHint(false);

    // Au bout de 4 s sans réponse → on prévient que le serveur se réveille
    // (plan gratuit Render : démarrage à froid jusqu'à ~1 min).
    slowTimer.current = setTimeout(() => setSlowHint(true), 4000);

    try {
      const response = await api.post("/auth/login", { username, password });
      login(response.data.access_token, username);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.status === 401
          ? "Identifiants invalides"
          : "Connexion impossible. Le serveur se réveille peut-être — réessayez dans un instant."
      );
    } finally {
      clearTimeout(slowTimer.current);
      setLoading(false);
      setSlowHint(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: 20,
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: 360,
          background: "#1e293b",
          padding: 32,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
              color: "white",
            }}
          >
            MM
          </div>
        </div>

        <h2 style={{ color: "white", margin: "0 0 4px", textAlign: "center", fontSize: 22 }}>
          Connexion MM-Recon
        </h2>
        <p style={{ color: "#64748b", margin: "0 0 22px", textAlign: "center", fontSize: 13 }}>
          Mobile Money Platform
        </p>

        {/* ✅ Encart identifiants visibles */}
        <div
          style={{
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.25)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: "#cbd5e1",
            lineHeight: 1.7,
          }}
        >
          <span style={{ display: "block", color: "#60a5fa", fontWeight: 600, marginBottom: 4 }}>
            🔑 Identifiants de démonstration
          </span>
          Identifiant : <b style={{ color: "white" }}>{DEFAULT_USERNAME}</b>
          <br />
          Mot de passe : <b style={{ color: "white" }}>{DEFAULT_PASSWORD}</b>
        </div>

        <input
          type="text"
          placeholder="Nom utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.8 : 1,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {loading && (
            <span
              style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "white",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
          )}
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        {/* ✅ Message rassurant si le serveur met du temps à répondre */}
        {slowHint && (
          <p
            style={{
              color: "#94a3b8",
              fontSize: 12,
              textAlign: "center",
              margin: "14px 0 0",
              lineHeight: 1.5,
            }}
          >
            ⏳ Le serveur se réveille (hébergement gratuit).
            <br />
            Cela peut prendre jusqu'à une minute la première fois…
          </p>
        )}
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "14px",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#0f172a",
  color: "white",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#3b82f6",
  color: "white",
  fontWeight: 600,
  fontSize: 15,
};
