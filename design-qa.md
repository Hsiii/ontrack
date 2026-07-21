# Widget design QA

- Source visual truth: `/Users/hsi/.codex/generated_images/019f8594-eff9-7ea3-b485-07cc871e57d3/exec-46b8f064-94d2-43ff-80c0-b79aa030ebb0.png`
- Implementation capture: `assets/screenshots/ontrack-widget-medium-implementation.png`
- Full-view comparison: `assets/screenshots/ontrack-widget-medium-comparison.png`
- Viewport: iOS medium widget, 338 × 158 points (1014 × 474 pixels at 3×)
- State: light appearance, predicted train with a four-minute delay

## Typography audit

The widget authors exactly two font sizes: 26 points for train identity and times, and 12 points for stations, direction, status, and the share icon. Weight, color, and monospaced numerals provide hierarchy without adding sizes.

## Comparison history

1. Pass 1 found one P2 alignment issue: a second flexible spacer pushed the arrival block too close to the trailing edge.
2. The post-arrow spacer was removed so the route reads as one compact sequence while preserving the departure-first priority.
3. Pass 2 found no remaining P0, P1, or P2 issues. The implementation intentionally uses the system medium-widget aspect ratio and corner treatment, and enforces the requested two-size typography constraint more strictly than the generated reference.

## Interaction and state checks

- The share icon opens `ontrack://copy` and copies the formatted train message after the simulator's one-time custom-scheme approval.
- The widget body deep-links to OnTrack.
- The empty snapshot state is represented without introducing another font size.
- Light and dark appearances were rendered and inspected.
- Native build and launch logs showed no runtime crash or layout warning.

final result: passed
