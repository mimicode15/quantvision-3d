# Performance and profiling

Goal: stay at 60 fps (a frame every 16.7 ms) while the camera, the hand tracker and the 3D scene all run.

## What the app already does
- **Draws only when something moves.** If the needle, the ghost arrow and the orbit controls are all still, the frame is skipped (`RenderGate`). That leaves the GPU free for the hand tracker.
- **Lowers resolution if frames stay slow.** Under 40 fps for 2 seconds drops the canvas pixel ratio one step (2 → 1.5 → 1 → 0.75). It never goes back up on its own, so it can't flicker (`QualityGovernor`).
- **Slows hand detection if it gets expensive.** Detection runs on the main thread. If one call averages over 16 ms, detections are spaced out (up to 10 per second) so the page keeps drawing (`DetectBudget`).
- **Caps the pixel ratio at 2**, even on 3x phone screens.
- **Loads MediaPipe and KaTeX lazily**, so the home page doesn't pay for them.

## See the numbers in the app
Open the playground with `?perf`:

    http://localhost:5173/?perf#/play

or press **Shift+P** in the playground. A small card at the top shows:
- `draw`: frames per second, average frame time and the worst recent frame
- `pixel ratio`: current canvas resolution (drops if the governor kicked in)
- `hand`: tracker frames per second and how long one detection takes (only while the camera is on)

## Profile it in Chrome DevTools
1. Build and preview, so you measure the real thing: `npm run build && npm run preview`. Dev mode is slower.
2. Open `http://localhost:4173/?perf#/play` in Chrome. Close other tabs and extensions (or use an Incognito window).
3. Press F12, open the **Performance** tab, and tick **Screenshots**.
4. Turn the camera on and show your hand. Wait for the `hand` line to show numbers.
5. Click Record (the circle), steer the arrow with a pinch for about 6 seconds, then Stop.
6. Read the result:
   - **Frames** row: green bars are good. Red marks or bars taller than 16.7 ms are dropped frames.
   - **Timings** row: our marks `qv:update`, `qv:render` and `qv:detect` (only recorded with `?perf`). Click one to see its duration.
   - **Main** row: long yellow blocks are JavaScript, purple is layout and style. Any block over 50 ms is a "long task" (red corner).
   - **GPU** row: busy all the time means the 3D scene is too heavy for this machine.
7. Optional: **More tools → Rendering → Frame Rendering Stats** shows a live fps meter.
8. To test a weak laptop, Performance → gear icon → **CPU: 4x slowdown** and record again.

## Budgets (what "good" means)
| Measure | Target | Where to read it |
| --- | --- | --- |
| Draw fps while steering | 55 or more | overlay `draw` |
| Worst frame | under 50 ms | overlay `worst` |
| One hand detection | under 16 ms | overlay `detect` |
| `qv:render` | under 4 ms | DevTools Timings |
| `qv:update` | under 1 ms | DevTools Timings |
| Long tasks (over 50 ms) during use | none | DevTools Main row |
| Idle (nothing moving) | no `qv:render` marks | DevTools Timings |

## Record your results
Fill these in after you test on real hardware.

| Device | Browser | Camera on | draw fps | detect ms | pixel ratio | Notes |
| --- | --- | --- | --- | --- | --- | --- |
|  |  | no |  | n/a |  |  |
|  |  | yes |  |  |  |  |

## If a budget is missed
- `detect` is high: the GPU delegate may have fallen back to CPU. Check the console for MediaPipe warnings. Lower the camera size in `CameraManager.ts` (ideal 640x480 → 480x360).
- `render` is high: turn off antialiasing in `BlochScene.ts` (`antialias: false`) or lower the pixel ratio cap from 2 to 1.5.
- Long tasks while the sliders move: look for work in `app.ts` `show()`, which runs on every slider input.
- Everything is slow only in dev: that's normal, measure the preview build.
