import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  CLOSER_NAMES,
  PLACEHOLDER_CLOSER_SCRIPT,
  closersLeaderboardPlaceholder,
} from "@/lib/jacob/closers-scoring";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    closers: CLOSER_NAMES,
    leaderboard: closersLeaderboardPlaceholder(),
    promptPlaceholder: PLACEHOLDER_CLOSER_SCRIPT,
    note:
      "Wire this to the Closers Scoring tab + GHL once closers are on GHL and Melina’s script is final.",
  });
}
