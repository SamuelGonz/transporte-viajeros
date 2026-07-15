"use client";

export default function LogoutButton() {
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.assign("/login");
  };

  return (
    <button type="button" className="logout-btn" onClick={logout}>
      Cerrar sesión
    </button>
  );
}
