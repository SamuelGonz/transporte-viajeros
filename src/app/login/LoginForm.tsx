"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
   const router = useRouter();
   const params = useSearchParams();
   const from = params.get("from") || "/";

   const [username, setUsername] = useState("");
   const [password, setPassword] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(false);

   const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
         const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
         });
         if (res.ok) {
            // Recarga completa para que el middleware vea la nueva cookie.
            window.location.assign(from);
         } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error || "No se pudo iniciar sesión.");
         }
      } catch {
         setError("Error de conexión.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="login-card">
         <h1 className="title" style={{ marginBottom: 4 }}>
            Test app
         </h1>
         <p className="subtitle" style={{ marginBottom: 24 }}>
            Introduce tus credenciales para acceder
         </p>

         <form onSubmit={submit}>
            <div className="field" style={{ marginBottom: 14 }}>
               <label htmlFor="username">Usuario</label>
               <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
               />
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
               <label htmlFor="password">Contraseña</label>
               <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
               />
            </div>

            {error && (
               <div className="feedback ko" style={{ marginBottom: 16 }}>
                  {error}
               </div>
            )}

            <button type="submit" className="btn" style={{ width: "100%" }} disabled={loading}>
               {loading ? "Entrando…" : "Entrar"}
            </button>
         </form>
      </div>
   );
}
