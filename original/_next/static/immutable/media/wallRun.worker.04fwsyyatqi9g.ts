/* The whole run is a few hundred milliseconds of work; it lives off the main thread so the page stays responsive. */
import { wallReply, type WallRun, type WallRunInput, type WallTally } from "@/lib/wall/run.ts";
import { localeReady } from "@/lib/i18n.ts";

export interface WallRunRequest extends WallRunInput {
  /** What the run reads, handed back with it so the page knows which edit it answers. */
  key: string;
  /** Answer the replay's tally (Runs to average), not the run. */
  tally?: boolean;
}
export interface WallRunReply {
  key: string;
  run: WallRun | WallTally;
}

/** Only the newest request is played: edits that arrive while a run is being played replace each other. */
let next: WallRunRequest | null = null;
let busy = false;
const play = () => {
  busy = true;
  while (next) {
    const req = next;
    next = null;
    self.postMessage(wallReply(req) satisfies WallRunReply);
  }
  busy = false;
};
self.onmessage = (e: MessageEvent<WallRunRequest>) => {
  next = e.data;
  if (!busy) void localeReady.then(() => setTimeout(play, 0));
};
