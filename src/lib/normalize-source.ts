export function normalizeSource(raw: string): string {
  const s = (raw ?? "").trim();
  const sl = s.toLowerCase();

  // Empty / unknown
  if (!sl || sl === "unknown" || sl === "null" || sl === "na" || sl === "n/a" || sl === "conversation" || sl === "csv_import" || sl === "manual") return "Other";

  // DM variants — classify by platform prefix
  if (sl === "conversation dms" || sl === "other dms" || sl === "manual dms") return "DM";

  // Instagram
  if (sl.includes("instagram") || sl === "instagram dms" || sl.includes("instagram.com") || sl.includes("l.instagram.com")) return "Instagram";
  if (sl.includes("http://instagram.com") || sl.includes("https://instagram.com") || sl.includes("https://www.instagram.com")) return "Instagram";
  if (sl.includes("sparbernsteinlaw") && sl.includes("instagram")) return "Instagram";
  if (sl.includes("bradbernsteinlaw") && sl.includes("instagram")) return "Instagram";

  // Facebook (including shows)
  if (sl.includes("brad show live")) return "Brad Show Live";
  if (sl.includes("brad & squeeze") || sl.includes("brad &amp; squeeze") || sl.includes("squeeze show")) return "Brad & Squeeze Show";
  if (sl.includes("real brad bernstein") && sl.includes("facebook")) return "Facebook";
  if (sl.includes("facebook") || sl.includes("fb") || sl.includes("faceook") || sl.includes("m.facebook.com") || sl.includes("l.facebook.com") || sl.includes("lm.facebook.com") || sl.includes("meta.com") || sl === "meta") return "Facebook";

  // TikTok
  if (sl.includes("tiktok") || sl.includes("tik tok") || sl.includes("tiktok.com")) return "TikTok";

  // YouTube
  if (sl.includes("youtube") || sl.includes("yt") || sl.includes("youtube.com") || sl.includes("m.youtube.com")) return "YouTube";

  // Website / Forms
  if (sl.includes("lawsb.com") || sl.includes("website") || sl.includes("web") || sl === "chat widget" || sl === "website widget" || sl.includes("website form")) return "Website";
  if (sl.includes("linktree") || sl.includes("linktr.ee") || sl.includes("l.wl.co")) return "Website";
  if (sl === "api" || sl.includes("api v1") || sl.includes("api ")) return "WhatsApp";

  // WhatsApp
  if (sl.includes("whatsapp") || sl.includes("wati") || sl === "whatsapp dms" || sl === "chat_widget dms") return "WhatsApp";

  // Google / Paid / Search
  if (sl.includes("google") || sl.includes("ppc") || sl.includes("syndicatedsearch.goog")) return "Google/Paid";
  if (sl.includes("bing.com")) return "Google/Paid";
  if (sl.includes("duckduckgo") || sl.includes("search.yahoo") || sl.includes("search.brave") || sl.includes("au.search.yahoo")) return "Google/Paid";

  // Referral
  if (sl.includes("referral") || sl.includes("refer")) return "Referral";

  // Returning Client
  if (sl.includes("returning client")) return "Returning Client";

  // Kennect
  if (sl === "kennect") return "Kennect";

  // Pearl Diver
  if (sl.includes("pearl diver")) return "Pearl Diver";

  // Call In
  if (sl === "call in") return "Call In";

  // Newsletter
  if (sl.includes("newsletter")) return "Newsletter";

  // Social (Twitter, LinkedIn, Reddit, Threads)
  if (sl.includes("twitter") || sl.includes("t.co/")) return "Twitter";
  if (sl.includes("linkedin")) return "LinkedIn";
  if (sl.includes("reddit")) return "Reddit";
  if (sl.includes("threads.com")) return "Threads";

  // ChatGPT / AI
  if (sl.includes("chatgpt") || sl.includes("perplexity") || sl.includes("iask.ai")) return "AI Search";

  // Review / Directory sites
  if (sl.includes("yelp") || sl.includes("superpages") || sl.includes("yellowpages") || sl.includes("birdeye") || sl.includes("superlawyers")) return "Directory/Review";

  // Facebook Ad
  if (sl.includes("ad") && sl.includes("facebook")) return "Facebook";

  // URL fallbacks
  if (sl.includes("http")) {
    if (sl.includes("instagram")) return "Instagram";
    if (sl.includes("facebook") || sl.includes("fb")) return "Facebook";
    if (sl.includes("google")) return "Google/Paid";
    if (sl.includes("youtube")) return "YouTube";
    if (sl.includes("tiktok")) return "TikTok";
    return "Website";
  }

  // National / International phone origin values
  if (sl === "national" || sl === "international") return "Other";

  // Anything with "dms" suffix
  if (sl.endsWith(" dms") || sl.endsWith("dms")) return "DM";

  // Explicit "other" / "Other"
  if (sl === "other") return "Other";

  // Paid keywords
  if (sl.includes("paid")) return "Google/Paid";

  // Organic
  if (sl.includes("organic")) return "Website";

  return "Other";
}

/**
 * Normalize comment lead source to clean channel name.
 * Used for comments tab "by Lead Source" breakdown.
 */
export function normalizeCommentSource(raw: string): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (s.includes("bradbernsteinlaw") && s.includes("instagram")) return "bradbernsteinlaw_ (IG)";
  if (s.includes("sparbernsteinlaw") && s.includes("instagram")) return "sparbernsteinlaw (IG)";
  if (s.includes("brad bernstein") && s.includes("facebook") && !s.includes("show")) return "Brad Bernstein, Esq (FB)";
  if (s.includes("brad show live") && s.includes("facebook")) return "Brad Show Live (FB)";
  if (s.includes("bradbernsteinlaw") && s.includes("youtube")) return "BradBernsteinLaw (YT)";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("instagram")) return "Instagram";
  if (s.includes("facebook")) return "Facebook";
  if (s.includes("tiktok")) return "TikTok";
  if (!s) return "Unknown";
  return raw.trim();
}
