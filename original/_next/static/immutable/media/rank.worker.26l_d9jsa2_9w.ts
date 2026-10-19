/*
 * One Optimize candidate at a time. A Boss Sim one: its own match before the fight where the page plays one, then the
 * board priced at the banks it arrives at — by its theoretical DPS, and by the fight's actual DPS where the fight has
 * one. A Wall Sim one (`wall`): wave 90, by both measures, after its own Full run where the page plays one. A DPS Compare one (`compare`):
 * one demon, or the full game run.
 */
import { localeReady } from "@/lib/i18n.ts";
import { rankReply, type RankJob } from "./rankJob.ts";

// reported, a throw reaches the page's worker.onerror; left in the promise it would only reject unseen
self.onmessage = (e: MessageEvent<RankJob>) =>
  void localeReady.then(() => self.postMessage(rankReply(e.data))).catch(reportError);
