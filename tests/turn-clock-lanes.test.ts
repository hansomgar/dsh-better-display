import assert from 'node:assert/strict'
import { test } from 'vitest'
import { ClockLanes, IDLE_CLOCK } from '../src/client/turn-clock-lane.js'

/** A snapshot with the row visible at a given start. */
function running(startTime: number) {
  return { visible: true, startTime, fallbackStart: null }
}

test('two sessions keep separate rows', () => {
  // The lane used to be one plugin-wide channel, so whichever Reader published last set
  // what the composer dock showed — including for a session it did not belong to.
  const lanes = new ClockLanes()
  const a = lanes.get('session-a')
  const b = lanes.get('session-b')
  // Distinct identities are what make the rows independent; a shared lane would fail here.
  assert.notEqual(a, b, 'each session gets its own lane object')
  a.publish(running(1000))
  b.publish(IDLE_CLOCK)
  assert.equal(a.read().visible, true, 'A keeps its row')
  assert.equal(b.read().visible, false, 'B is unaffected by A')
})

test('a session id resolves to the same lane every time', () => {
  const lanes = new ClockLanes()
  assert.equal(lanes.get('s1'), lanes.get('s1'), 'same object, so publishes accumulate')
  assert.notEqual(lanes.get('s1'), lanes.get('s2'), 'different sessions differ')
})

test('publishing reaches only the subscribers of that session', () => {
  const lanes = new ClockLanes()
  let a = 0
  let b = 0
  const heldA = lanes.hold('a', () => { a += 1 })
  const heldB = lanes.hold('b', () => { b += 1 })
  lanes.get('a').publish(running(5000))
  assert.equal(a, 1, 'A was told')
  assert.equal(b, 0, 'B was not')
  heldA.release()
  heldB.release()
})

test('a lane is released when its last holder leaves', () => {
  // Without this, one lane per session ever opened would accumulate for the page's life.
  const lanes = new ClockLanes()
  const first = lanes.hold('s', () => {})
  assert.equal(lanes.size, 1)
  const second = lanes.hold('s', () => {})
  assert.equal(lanes.size, 1, 'a second holder reuses the entry')
  first.release()
  assert.equal(lanes.size, 1, 'still held by the second')
  second.release()
  assert.equal(lanes.size, 0, 'the last release frees it')
})

test('releasing twice is harmless', () => {
  const lanes = new ClockLanes()
  const held = lanes.hold('s', () => {})
  held.release()
  held.release()
  assert.equal(lanes.size, 0, 'the counter is not pushed negative')
})

test('a re-created lane starts idle', () => {
  // A session that closes and reopens must not inherit the old row; the counter would be
  // wrong otherwise.
  const lanes = new ClockLanes()
  const held = lanes.hold('s', () => {})
  lanes.get('s').publish(running(9))
  held.release()
  assert.equal(lanes.get('s').read().visible, false, 'the new lane is fresh')
})
