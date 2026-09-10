import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ideaExport } from "@/lib/repository";
import { ideaToMarkdown } from "@/lib/export";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const data = ideaExport((await params).id);
  if (!data) return new Response("找不到这个想法。", { status: 404 });
  return new Response(ideaToMarkdown(data), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="luodian-${data.idea.id}.md"`,
    },
  });
}

