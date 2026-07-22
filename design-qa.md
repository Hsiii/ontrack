# Widget design QA

- Source visual truth: `assets/screenshots/ontrack-in-app-train-card-source.png`
- Implementation capture: `assets/screenshots/ontrack-widget-medium-implementation.png`
- Full-view comparison: `assets/screenshots/ontrack-widget-medium-comparison.png`
- Viewport: iOS medium home-screen widget on the iPhone 17 Pro simulator, 350 × 165 points at 3×
- Source pixels: 1085 × 300; implementation pixels: 1050 × 495
- Density normalization: both captures are 3× simulator crops; the comparison preserves each component's native aspect ratio and presents them at nearly equal widths
- State: 臺北 → 新竹, 區間 2253 · 山線, two-minute delay

## Fidelity surfaces

- Fonts and typography: the system font and monospaced time numerals match the in-app train card. The widget uses 26 points for times, 16 points for the route and bottom train/status row, and 12 points for duration.
- Spacing and layout rhythm: the widget uses 16-point horizontal padding and matching 20-point top and bottom padding. The route-to-time gap is 8 points, while the base vertical row gap remains 4 points. A flexible spacer anchors the bottom action row, and its visible content is bottom-aligned inside the 44-point tap frame.
- Colors and visual tokens: text, secondary text, divider, primary blue, and semantic delay colors continue to use the widget's adaptive palette.
- Image quality and asset fidelity: the header uses OnTrack's supplied transparent launch mark at native 1×, 2×, and 3× densities. It is loaded from the widget bundle and is not redrawn or approximated.
- Copy and content: the route reads origin, directional arrow, destination; times remain the primary data; train identity, line, and live status remain grouped in the bottom row.

## Comparison history

1. The earlier design adapted the in-app time rail but placed station names beneath the times, leaving the upper and lower bands visually uneven.
2. The route moved into a dedicated top row and the OnTrack mark was added at the far-right edge. The center became a single uninterrupted time rail and the larger bottom row was preserved.
3. The first asset pass found one P2 issue: SwiftUI's named-image lookup did not render the raw bundled logo in the simulator.
4. The logo loader was changed to resolve the supplied PNG directly from the widget bundle. The post-fix capture shows the correct mark, fixed at 20 points and protected from compression.
5. A padding refinement found that the bottom row's tap frame was correctly inset but its visible content was still vertically centered, making the optical bottom padding look larger than the top padding.
6. The visible bottom-row content was bottom-aligned inside the unchanged 44-point tap frame. The post-fix capture shows matching optical top and bottom insets without reducing the touch target.
7. The top and bottom insets were increased together from 16 to 24 points. Vertical row gaps moved from 8 to 4 points so all three rows and the full tap target fit without clipping.
8. The final spacing refinement set both vertical insets to 20 points and increased only the route-to-time gap by 4 points, from 4 to 8. The post-fix capture confirms balanced outer padding, clearer separation between the first two rows, and no clipping with a visible delay state.
9. The final comparison found no remaining P0, P1, or P2 issues. The widget retains the source card's typography, rail, and train identity while adding route context and actions in balanced bands.

## Interaction and state checks

- The share icon retains its 44-point tap target and opens `ontrack://copy`.
- The widget body deep-links to OnTrack.
- Missing delay data hides the status rather than implying freshness.
- The signed simulator build rendered App Group data, the bundled OnTrack mark, and the refreshed widget timeline without clipping or layout warnings.
- A focused-region comparison was unnecessary because the saved implementation capture is already a pixel-readable crop of the entire component.

final result: passed
