/* The board priced and drawn off the main thread (board-view.ts): a slow board never holds a tap, a keystroke or a scroll. */
import { boardReply, type BossPricing, type TollPart } from "./board-view.ts";
import { localeReady } from "@/lib/i18n.ts";

export type BoardRequest = BossPricing & {
  /** Which pricing this is, handed back with it so the page knows which edit it answers. */
  key: string;
  /** One pricing of the Theo / Actual difference rather than the board. */
  toll?: TollPart;
};

// reported, a throw reaches the page's worker.onerror; left in the promise it would only reject unseen
self.onmessage = (e: MessageEvent<BoardRequest>) =>
  void localeReady.then(() => self.postMessage(boardReply(e.data))).catch(reportError);
