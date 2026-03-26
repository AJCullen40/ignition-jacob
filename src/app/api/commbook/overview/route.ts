import { NextRequest, NextResponse } from "next/server";
import { computeCommBookData } from "@/lib/commbook-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    const data = await computeCommBookData(start, end);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[CommBook API]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
