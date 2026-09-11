import Link from "next/link";
import SetupForm from "@/components/SetupForm";
import { SourceLink } from "@/components/Ui";

export default function SetupPage() {
  return <main className="shell page-enter"><div className="mx-auto max-w-lg pt-8 sm:pt-16"><div className="mb-8"><div className="door-header"><Link href="/" className="brand"><span className="brand-mark">落</span><span className="brand-word">落点</span></Link><SourceLink /></div><p className="eyebrow mt-12 mb-3">初次落点</p><h1 className="display-title text-4xl sm:text-5xl">先把落点安顿好。</h1><p className="muted mt-3">设置一次访问密码和 AI 接口，之后只需要通过网页使用。</p></div><SetupForm /></div></main>;
}
