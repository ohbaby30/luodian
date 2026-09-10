import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return <main className="shell"><div className="mx-auto max-w-sm pt-20 sm:pt-32"><Link href="/" className="brand"><span className="brand-mark">落</span><span className="brand-word">落点</span></Link><p className="eyebrow mt-12 mb-3">Welcome back</p><h1 className="text-4xl font-semibold tracking-tight">继续把事情想清楚。</h1><p className="muted mt-3">输入访问密码，回到你的想法工作台。</p><div className="mt-8"><LoginForm /></div></div></main>;
}

