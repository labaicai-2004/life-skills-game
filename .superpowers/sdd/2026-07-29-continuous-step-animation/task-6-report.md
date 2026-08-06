# Task 6: Research-condition and data-integrity verification report

## Status

Implemented and verified with automated VM-harness coverage. The sole defect found by the required data-contract check was repaired with the explicitly authorized one-line addition of `taskId: level.id` to the existing step-level `researchRecords` object. No new storage key, write path, event type, or game interaction behavior was added.

## RED evidence

Command: `node --test tests/continuous-animation.test.js`

Result before the production fix: 24 passed, 1 failed. The failing test completed a real brushing step through the final `handleStepSuccess` wrapper and verified the exact `researchRecords` key set. Its expected and reproducible failure showed that the stored record lacked `taskId`; all preceding assertions passed: exactly one new `step_success` event, exactly one new record, and `responseTimeMs === 1650` milliseconds.

Root cause: `UnifiedDataManager.onStepComplete()` set `this.taskId` for event entries but did not copy `level.id` into the step-level record object. The minimal authorized fix adds only `taskId: level.id` in that object.

## GREEN evidence

Command: `node --test tests/continuous-animation.test.js`

Result after the fix: 25 passed, 0 failed.

Command: `node --check <(sed -n '/<script>/,/<\\/script>/p' index.html | sed '1d;$d') && git diff --check`

Result: extracted inline JavaScript syntax check and whitespace-diff check both exited successfully.

## Research-condition matrix

| Research state | Phase | Training mode | Expected | Automated result |
| --- | --- | --- | --- | --- |
| Inactive | — | Teaching, Practice, Assessment | Enabled | Enabled for all three |
| Active | Intervention | Teaching | Enabled | Enabled |
| Active | Intervention | Practice | Disabled | Disabled |
| Active | Intervention | Assessment | Disabled | Disabled |
| Active | Baseline | Teaching, Practice, Assessment | Disabled | Disabled for all three |
| Active | Maintenance | Teaching, Practice, Assessment | Disabled | Disabled for all three |

The same VM-harness suite also verifies the Task 1 deferred coverage: first `mousedown` pauses the active demonstration, and starting another level clears the stale demonstration before a new stage is scheduled.

## Data-delta evidence

| Scenario | `UnifiedDataManager.events` | `researchRecords` | Result |
| --- | --- | --- | --- |
| Two passive demonstration cycles after normal level initialization | 3 before, 3 after | 0 before, 0 after | No data delta |
| One genuine brushing-step completion after a paused demonstration | 3 before, 4 after | 1 before, 2 after | Exactly one `step_success` and one step record |

The passive-cycle test follows the real `startLevel → loadStep` route. It takes its snapshot only after the normal `session_start`, `step_start`, and `ltm_chain_start` initialization events have been recorded, advances the fake clock through the 2000 ms animation start, then dispatches two `animationiteration` events on the representative `demo-element` through the VM DOM event system. `promptState.enabled` is intentionally set to `false` so unrelated Least-to-Most escalation events are disabled while `AnimationPolicy` remains enabled for ordinary play.

The genuine-completion test follows the real `startLevel → loadStep → mousedown → mouseup` route. It confirms that `mousedown` begins while the stage is `demo-running`, pauses the stage, and completes the tap through the production mouse listener rather than calling `handleStepSuccess` directly. The deterministic elapsed response time is 3650 ms. The new record has exactly this unchanged key set:

```text
participantID, skill, phase, sessionNumber, stepNumber, stepName,
taskId, completionStatus, promptLevel, trainingMode,
responseTimeMs, errors, timestamp
```

It confirms `taskId === 'brush'` and that both the record and the sole new `step_success` event store `responseTimeMs === 3650`.

## Self-review

- The production change is one field assignment inside the existing step record object: `taskId: level.id`.
- It does not add a localStorage write, a storage key, an event, a timer, an animation rule, a prompt behavior, or a game interaction branch.
- The test harness uses the real `AnimationPolicy`, `AnimationController`, final `handleStepSuccess`, `UnifiedDataManager`, and in-memory browser-compatible `localStorage` behavior, rather than replacing production classes with mock assertions.
- Existing animation, continuity-state, drag-geometry, and real-completion regression tests remain green.

## Fix Round 1: Integration-strengthening tests

### Status

Implemented without a production change. The strengthened end-to-end paths did not reveal a new defect.

### Coverage

- The passive data-integrity case starts a real level, snapshots after the ordinary initialization events, keeps `AnimationPolicy` enabled, and disables only unrelated prompt escalation before advancing through the delayed start plus two maximum-duration CSS-cycle equivalents.
- The genuine completion case starts a real level, waits for `demo-running`, dispatches the real `mousedown → mouseup` tap sequence on the interaction area, and verifies one `step_success`, one stored record, the exact field set, `taskId`, and millisecond response times.
- The deferred `mousedown` check now proves the stage was actively demonstrating before the first desktop press. The `startLevel` check records the actual order and proves that clearing precedes both new-stage installation and animation scheduling.

### Mutation evidence

The suite's Fix Round 2 source variant registers an `animation_iteration_write_mutation` listener on the real representative demo element. The unchanged-data assertion then throws after dispatched `animationiteration` events, proving that the passive-integrity check detects a data-writing animation regression. The checked-in `index.html` is never altered by this mutation.

### GREEN evidence

Command: `node --test tests/continuous-animation.test.js`

Result: 26 passed, 0 failed.

### Concerns

No browser instance was available for visual browser verification. The new coverage is VM-based but exercises the production start-level, load-step, controller, data-manager, and desktop input listener integration path.

## Concerns

No browser instance was available in the browser-control environment (`agent.browsers.list()` returned an empty list), so desktop and iPad manual visual checks could not be performed. Automated evidence covers all requested policy branches, controller pause/clear behavior, data deltas, exact field keys, and millisecond timing; a manual iPad Safari pass remains recommended when a browser is available.

## Fix Round 2: Iteration events and start-level source contract

### Status

Implemented without a production change. The strengthened iteration and source-order regressions did not reveal a new defect.

### Coverage and mutation evidence

- The VM element stub now stores multiple listeners per event and dispatches browser-like event objects. The passive test starts a real level, waits for `demo-running`, and dispatches two real `animationiteration` events on the representative stage `demo-element`; both event and record counts remain unchanged from the post-initialization snapshot.
- The required test-only source mutation registers an `animationiteration` listener that calls `UnifiedDataManager.logEvent`. After the same two dispatched iteration events, the no-delta assertion throws, proving that the integration test detects a write caused by animation iteration rather than only by initial animation start.
- A direct source-contract test extracts the original `function startLevel(idx)` and verifies its first `AnimationController.clear()` appears before both `state.currentLevel=idx` and `loadStep(0)`. The test removes that first clear from the extracted function and confirms the assertion fails, so `loadStep`'s later cleanup cannot mask a regression.

### GREEN evidence

Command: `node --test tests/continuous-animation.test.js`

Result: 27 passed, 0 failed.

### Concerns

No browser instance was available for visual browser verification. The iteration test exercises the production start-level, load-step, controller, VM DOM-event, and data-manager path, but a browser-based visual pass remains recommended.
