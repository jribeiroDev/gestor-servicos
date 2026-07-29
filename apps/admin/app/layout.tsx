import "./globals.css";

export const metadata = {
  title: "Admin · Reservas",
  description: "Painel de gestao de agendamentos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
