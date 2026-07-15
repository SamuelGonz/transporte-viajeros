import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test Transporte de Viajeros",
  description: "Practica el examen tipo test de competencia profesional de transporte de viajeros.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
