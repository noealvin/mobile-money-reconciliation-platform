import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {

  // ✅ On utilise sessionStorage : le token est effacé quand l'utilisateur
  //    ferme le navigateur → il repasse toujours par la page de login
  //    à la ré-ouverture (comportement demandé).
  const [token, setToken] = useState(
    sessionStorage.getItem("token")
  );

  // ✅ on garde aussi le nom d'utilisateur pour le message de bienvenue
  const [username, setUsername] = useState(
    sessionStorage.getItem("username") || ""
  );

  const login = (newToken, newUsername) => {
    sessionStorage.setItem("token", newToken);
    setToken(newToken);

    if (newUsername) {
      sessionStorage.setItem("username", newUsername);
      setUsername(newUsername);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    setToken(null);
    setUsername("");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
