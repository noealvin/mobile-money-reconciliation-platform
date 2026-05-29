import { useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      // ✅ URL relative (passe par le client `api` configuré avec
      //    VITE_API_URL).  Plus de host hardcodé "127.0.0.1:8000" qui
      //    ne marchait pas dans Docker.
      const response = await api.post("/auth/login", {
        username,
        password,
      });

      // ✅ on passe aussi le username pour le message de bienvenue
      login(response.data.access_token, username);

    } catch (err) {
      console.error(err);
      setError("Identifiants invalides");
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
        fontFamily: "sans-serif",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: 350,
          background: "#1e293b",
          padding: 30,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2
          style={{
            color: "white",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Connexion MM-Recon
        </h2>

        <input
          type="text"
          placeholder="Nom utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: 14 }}>
            {error}
          </p>
        )}

        <button type="submit" style={buttonStyle}>
          Se connecter
        </button>
      </form>
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
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#3b82f6",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
