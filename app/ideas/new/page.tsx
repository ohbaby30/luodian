import AppShell from "@/components/AppShell";
import NewIdeaForm from "@/components/NewIdeaForm";

export default function NewIdeaPage() {
  return <AppShell><div className="mx-auto max-w-3xl"><div className="mb-8"><p className="eyebrow mb-3">新想法</p><h1 className="display-title text-4xl sm:text-5xl">先写原始版本。</h1><p className="muted mt-3">不要替自己完成。越接近你真实脑中的样子，落点越容易发现真正的缺口。</p></div><NewIdeaForm /></div></AppShell>;
}
