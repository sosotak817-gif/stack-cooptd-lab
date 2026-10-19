/* A replay of the match and its fight is a second or more of work; it lives off the main thread so the page stays responsive. */
import { bossPlayReply, type BossPlay, type BossRunInput, type BossTally } from "@/lib/boss/fullRun.ts";
import { localeReady } from "@/lib/i18n.ts";

export interface RunRequest extends BossRunInput {
  /** What the replay reads, handed back with it so the page knows which edit it answers. */
  key: string;
  replay?: number;
  /** Answer the replay's tally (Runs to average), not the replay whole. */
  tally?: boolean;
}
export interface RunReply {
  key: string;
  run: BossPlay | BossTally | null;
}

/** Only the newest request is played: edits that arrive while a replay is being played replace each other. */
let next: RunRequest | null = null;
let busy = false;
const play = () => {
  busy = true;
  while (next) {
    const req = next;
    next = null;
    self.postMessage(bossPlayReply(req) satisfies RunReply);
  }
  busy = false;
};
self.onmessage = (e: MessageEvent<RunRequest>) => {
  next = e.data;
  // yield first, so every message already queued behind this one lands before the replay is played
  if (!busy) void localeReady.then(() => setTimeout(play, 0));
};
