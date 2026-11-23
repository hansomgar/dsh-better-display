import { useEffect, useLayoutEffect, useState } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { ConversationStore } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { PropsRuntime, PropsStore, StoreDecl } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import { ReaderEntryPolicy, readerEntryRequested } from './entry-policy.js';
import { TurnClock } from './TurnClock.js';
import {
  ClockLanes,
  IDLE_CLOCK,
  type ClockSnapshot
} from './turn-clock-lane.js';
import css from './Reader.module.css';

function isConversationStore(store: StoreDecl | undefined): store is ConversationStore {
  return (
    typeof store === 'object' &&
    store !== null &&
    store.spec.persist === 'dsh.conversation' &&
    typeof store.spec.actions.setView === 'function'
  );
}

type EntryProps = PropsRuntime<'conversation.input.dock'> &
  PropsStore<ConversationStore> & { policy: ReaderEntryPolicy };

function ReaderEntry({ useStore, actions, policy }: EntryProps) {
  const view = useStore(state => state.view);
  useLayoutEffect(() => {
    const next = policy.select(view);
    if (next) actions.setView(next);
  }, [view, actions, policy]);
  return null;
}

/** The runtime face the Host hands a `conversation.input.dock` entry. */
type ClockProps = PropsRuntime<'conversation.input.dock'> & { lanes: ClockLanes };

/**
 * The running row, drawn in the Host's composer dock.
 *
 * This is the same mount the built-in 任务 row uses (`id: "todo"`), and that is
 * what makes it immune to scrolling: the dock lives inside
 * `[data-composer-seat]`, which the Host positions over the scrollport instead
 * of leaving it in the transcript's scroll flow. A `sticky` row inside the
 * transcript is re-laid-out on every scroll frame, which reads as shaking.
 *
 * The lane carries only what the row needs to draw; the Reader owns the turn
 * facts and publishes them.
 */
function PinnedClock({ sessionId, lanes }: ClockProps) {
  const [snapshot, setSnapshot] = useState<ClockSnapshot>(IDLE_CLOCK)
  useEffect(() => {
    // Hold this session's lane for as long as the dock is mounted, so two open sessions do
    // not overwrite each other's row and the lane is released when this one closes.
    const held = lanes.hold(sessionId, () => setSnapshot(held.lane.read()))
    setSnapshot(held.lane.read())
    return held.release
  }, [lanes, sessionId])
  if (!snapshot.visible) return null;
  return (
    <div className={css.turnClockPin} data-reader-turn-clock-pin>
      <TurnClock
        phase="running"
        startTime={snapshot.startTime}
        endTime={null}
        fallbackStart={snapshot.fallbackStart}
      />
    </div>
  );
}

/** Reuse the native store handle; its framework-owned instance preserves drafts. */
export function installReaderEntry(ctx: Context): () => void {
  const native = ctx.slots.entriesOfSlot('conversation.session')[0]?.store;
  if (!isConversationStore(native))
    throw new Error('DSH Reader cannot bind the native conversation view store.');
  const policy = new ReaderEntryPolicy(readerEntryRequested(location.search), () => {
    const url = new URL(location.href);
    url.searchParams.delete('reader');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  });
  const lanes = new ClockLanes()
  ctx.provide('betterDisplayClockLanes', lanes)
  // The dock stack is a flex column sorted by ascending order. The built-in 任务 row is
  // `order: 0`, `ui-goal` also sits at `order: 10`, and the queue dock is `order: 20`.
  // 15 lands the clock below the goal row and above the queue without sharing a rank with
  // either — two entries at the same order sort by registration, which is not ours to
  // rely on. `locale` is what gives a dock entry its `t`.
  const disposeClock = ctx.slots.register(
    {
      name: 'conversation.input.dock',
      id: 'dsh-better-display-turn-clock',
      order: 15,
      locale: 'chat',
      inject: () => ({ lanes })
    },
    PinnedClock
  );
  const disposeEntry = ctx.slots.register(
    {
      name: 'conversation.input.dock',
      id: 'dsh-better-display-entry',
      store: native,
      inject: () => ({ policy })
    },
    ReaderEntry
  );
  return () => {
    disposeEntry();
    disposeClock();
  };
}
