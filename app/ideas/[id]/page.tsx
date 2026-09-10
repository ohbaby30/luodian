import AppShell from "@/components/AppShell";
import IdeaWorkspace from "@/components/IdeaWorkspace";

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><IdeaWorkspace id={id} /></AppShell>;
}

