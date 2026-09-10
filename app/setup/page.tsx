import Link from "next/link";
import SetupForm from "@/components/SetupForm";

export default function SetupPage() {
  return <main className="shell"><div className="mx-auto max-w-lg pt-10 sm:pt-20"><div className="mb-8"><Link href="/" className="brand"><span className="brand-mark">落</span><span className="brand-word">落点</span></Link><p className="eyebrow mt-12 mb-3">First landing</p><h1 className="text-4xl font-semibold tracking-tight">先把落点安顿好。</h1><p className="muted mt-3">设置一次访问密码和 AI 接口，之后只需要通过网页使用。</p></div><SetupForm /></div></main>;
}

