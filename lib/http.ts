import { NextResponse } from "next/server";
import { ProviderError } from "./llm";
import { ProviderSelectionRequiredError } from "./provider";

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ProviderSelectionRequiredError) {
    return NextResponse.json({
      error: error.message,
      code: error.code,
      providerKinds: error.availableProviderKinds,
    }, { status: error.status });
  }
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: "发生了无法识别的错误。" }, { status: 500 });
}
