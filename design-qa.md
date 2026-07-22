# Design QA — Operations task board, variant 3

## Evidence

- Source visual truth: `C:\Users\sascy\.codex\generated_images\019f7b8b-495b-7a02-9824-3b723fe063be\exec-f0b83314-a2eb-4584-886c-c969043565e8.png`
- Rendered implementation: `D:\One Company\OneCompany\artifacts\design-qa\task-board-no-team-rail.png`
- Side-by-side comparison: `D:\One Company\OneCompany\artifacts\design-qa\task-board-no-team-rail-comparison.png`
- Local route: `http://127.0.0.1:3000/admin/operations/tasks`
- Source pixels: 1486 × 1058.
- Implementation capture: 1465 × 1272, CSS viewport 1465 × 1272, device density 1.
- Responsive check: 390 × 844 CSS px.
- Latest desktop detail evidence: `D:\One Company\OneCompany\artifacts\design-qa\task-board-detail-fixed.png`.
- Latest mobile detail evidence: `D:\One Company\OneCompany\artifacts\design-qa\task-detail-mobile-390-fixed.png`.
- State: authenticated owner, Tasks → Board, real local task data, selected task detail visible.
- Density normalization: both images reviewed at their native 1× density. The in-app browser window is smaller than the generated source, so comparison focuses on layout proportions and responsive behavior rather than literal pixel alignment.

## Full-view comparison evidence

The implementation preserves the selected design's defining structure: existing dark global navigation, four focused Kanban lanes, persistent task detail panel, blue active accents, and compact light workspace. Following the latest user direction, the participant rail is removed from Board view and its filtering remains available in the toolbar. The freed width is split between the Kanban lanes and a wider task-detail panel.

## Focused region comparison evidence

- Board cards: compared title density, priority marker, assignee color, deadline, next-action excerpt, borders, and drag affordance.
- Task detail: compared persistent right-panel placement, title hierarchy, edit action, task metadata, and scroll behavior.
- Participant filtering: verified the toolbar select retains all participant filters without occupying a permanent board column.
- Mobile: verified the board is replaced by the existing task list/detail flow; no global horizontal overflow and no promo image at 390 px.

## Findings

No actionable P0, P1, or P2 mismatch remains.

- [P3] Real task titles are longer than the mock data and wrap more often in narrow lanes. This is expected dynamic-content behavior; the lane itself scrolls horizontally and the selected task remains readable in the persistent detail panel.
- [P3] The source mock shows more populated lanes than the local database. This is data-state variance, not a missing UI state; empty lanes are rendered deliberately and drag targets remain available.

## Required fidelity surfaces

- Fonts and typography: existing One Company display/body typography retained; compact detail title reduced for narrow desktop panels; no clipped controls.
- Spacing and layout rhythm: squared cards and dividers match the selected direction; board and detail remain separate regions without body overflow. The task detail is 500 px wide at the captured desktop viewport.
- Colors and visual tokens: existing blue, slate, amber, violet, and member identity accents retained with adequate contrast.
- Image quality and asset fidelity: the requested car promo asset and the obsolete handcrafted car SVG were removed; no replacement image or fake decorative asset was introduced.
- Copy and content: Russian operations labels are concise and preserve existing task terminology.

## Interaction and runtime verification

- Board view switch: passed.
- Selecting a Kanban task and updating the persistent detail panel: passed.
- Participant filter renders from current server data while the Board participant rail stays absent: passed.
- Drag-and-drop implementation and keyboard sensor remain wired to server-validated transitions.
- Mobile 390 px body overflow: none.
- Browser console errors during verification: none.
- TypeScript: passed.
- Ops tests: 137/137 passed.

## Comparison history

1. Initial implementation finding: global `--radius` mapped `rounded-md` cards to a 997 px pill radius (P2). Fix: board cards and their compact actions now use `rounded-none`. Post-fix computed radius: 0 px.
2. Initial implementation finding: a fixed 720 px board track pushed the persistent detail pane beyond a 1280 px viewport (P2). Fix: outer board track changed to `minmax(0,1fr)` and horizontal overflow is isolated to the Kanban region. Post-fix evidence: body width equals viewport width (1280 px) and the detail pane remains visible.
3. Requested sidebar cleanup: removed the rendered car promo block and unused custom car SVG. Post-fix desktop and 390 px checks both report no promo image.
4. Follow-up finding: the compact right panel inherited a viewport-based four-column metadata layout, leaving roughly 90 px per field on wide screens and truncating assignee/deadline values (P1). Fix: compact details now always use a stable two-column grid; the full mobile task page uses one metadata column. Post-fix evidence shows complete assignee text, readable controls, 390 px body width equal to viewport width, and no horizontal overflow.
5. The fourth focus lane was renamed from `На проверке` to `Готово` and now maps to the terminal `DONE` status instead of `REVIEW`.
6. Latest density finding: the permanent participant rail left insufficient horizontal space for both Kanban copy and the assignee control (P1). Fix: removed the rail from Board view, retained the participant select in the toolbar, widened the detail panel to 500 px at the captured viewport, hid the redundant compact avatar, and preserved the full assignee name in the select and tooltip. Post-fix evidence: no `Участники` rail heading in Board view, selected assignee `Olexandr Tsompel` is fully visible, and document horizontal overflow is false.

## Follow-up polish

- At a later data-rich canary, re-check card density with 20+ simultaneous tasks and several urgent/blocked states.

## Final result

final result: passed
