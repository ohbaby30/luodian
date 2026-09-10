"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="shell">
      <div className="shell-inner">
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark">落</span>
            <span><span className="brand-word">落点</span><span className="brand-note ml-3">把想法推进到可验证的结果</span></span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="主导航">
            <Link className={`nav-link ${pathname === "/" ? "active" : ""}`} href="/">想法</Link>
            <Link className={`nav-link ${pathname.startsWith("/settings") ? "active" : ""}`} href="/settings">规则</Link>
            <button className="nav-link" onClick={logout}>退出</button>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
