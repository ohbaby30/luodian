import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { SourceLink } from "@/components/Ui";

export default function LoginPage() {
  return <main className="shell page-enter"><div className="mx-auto max-w-sm pt-16 sm:pt-24"><div className="door-header"><Link href="/" className="brand"><span className="brand-mark">落</span><span className="brand-word">落点</span></Link><SourceLink /></div><p className="eyebrow mt-12 mb-3">欢迎回来</p><h1 className="display-title text-4xl sm:text-5xl">继续把事情想清楚。</h1><p className="muted mt-3">输入访问密码，回到你的想法工作台。</p><div className="mt-8"><LoginForm /></div></div></main>;
}
