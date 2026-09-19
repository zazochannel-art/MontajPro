import { AppProvider } from "@/lib/app-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
