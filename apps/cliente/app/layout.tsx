import "./globals.css";

export const metadata = {
  title: "Reservas",
  description: "Agendamento simples de serviços",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
