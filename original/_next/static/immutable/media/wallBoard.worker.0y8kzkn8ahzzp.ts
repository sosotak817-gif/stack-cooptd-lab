/* Wave 90 priced off the main thread (wall-view.ts), as the Boss Sim's board is. */
import { wallBoardReply, type WallPricing } from "./wall-view.ts";
import { localeReady } from "@/lib/i18n.ts";

export type WallBoardRequest = WallPricing & {
  /** Which pricing this is, handed back with it so the page knows which edit it answers. */
  key: string;
  /** The Theo / Actual difference's lines rather than the wall. */
  toll?: boolean;
};

// reported, a throw reaches the page's worker.onerror; left in the promise it would only reject unseen
self.onmessage = (e: MessageEvent<WallBoardRequest>) =>
  void localeReady.then(() => self.postMessage(wallBoardReply(e.data))).catch(reportError);
