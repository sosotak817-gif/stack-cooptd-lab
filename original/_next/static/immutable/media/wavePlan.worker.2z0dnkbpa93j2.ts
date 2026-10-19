/* One wave plan's Full run, for Optimize placements (wave-plan-price.ts). */
import { planReply, type PlanJob } from "./wave-plan-price.ts";
import { localeReady } from "@/lib/i18n.ts";

// reported, a throw reaches the page's worker.onerror; left in the promise it would only reject unseen
self.onmessage = (e: MessageEvent<PlanJob>) =>
  void localeReady.then(() => self.postMessage(planReply(e.data))).catch(reportError);
