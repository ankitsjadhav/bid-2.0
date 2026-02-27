import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: 'Bid 2.0 MVP',
  description: 'Contractor to Supplier Marketplace MVP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-900 bg-white">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
