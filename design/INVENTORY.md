# Lutra_Hug.pen — Frame inventory

Source: `design/Lutra_Hug.pen`, read via pencil MCP on 2026-10-07. Screen IDs from
`docs/SCREEN_DESIGN.md` and slice spec `docs/superpowers/specs/2026-09-09-care-cost-local-sync-design.md`.
Canvas coordinates are absolute (x, y); size is w × h.

## Top-level frames (before this pass)

| Id | Name | x, y | w × h | Kind |
| --- | --- | --- | --- | --- |
| gpOve | LUTRA HUG · Design system & handoff | 0, 0 | 2300 × 256 | Board |
| NePTf | Component · Primary button | 0, 330 | 374 × 52 | Component |
| gyjx4 | Component · Form field | 434, 330 | 374 × 77 | Component |
| GrArD | Component · Bottom navigation | 868, 330 | 374 × 66 | Component |
| V2hIJ | HOME · Chào bạn, hôm nay | 0, 520 | 414 × 1332 | Screen |
| uWuj3 | EXPENSES · Chi phí chăm sóc | 474, 520 | 414 × 918 | Screen |
| m1a8H | EXPENSE_FORM · Thêm chi phí | 948, 520 | 414 × 1013 | Screen |
| oxprG | BUDGET · Ngân sách tháng | 1422, 520 | 414 × 970 | Screen |
| RQVXV | REPORTS · Báo cáo chi phí | 1896, 520 | 414 × 2201 | Screen |
| y344ZD | COMMUNITY · Có nhau, dễ hơn | 0, 2520 | 414 × 1281 | Screen |
| KxkQY | POST · Cùng nhau chia sẻ | 474, 2520 | 414 × 888 | Screen |
| J6U4M | POST_FORM · Viết bài chia sẻ | 948, 2520 | 414 × 727 | Screen |
| W2F9o0 | RESOURCE_LIST · Thư viện tài liệu | 1422, 2520 | 414 × 982 | Screen |
| ve8wA | RESOURCE_DETAIL · Chi tiết tài liệu | 1896, 2520 | 414 × 794 | Screen |
| d82yxA | MENTORS · Người đồng hành | 0, 4120 | 414 × 846 | Screen |
| z7Ozp5 | MENTOR_DETAIL · Hồ sơ người hỗ trợ | 474, 4120 | 414 × 830 | Screen |
| IK8bP | CONNECTION_FORM · Gửi lời kết nối | 948, 4120 | 414 × 834 | Screen |
| I8Hrya | CONNECTIONS · Yêu cầu kết nối | 1422, 4120 | 414 × 616 | Screen |
| TmBXB | ASSISTANT · Tôi có thể giúp gì? | 1896, 4120 | 414 × 1012 | Screen |
| cankI | CONVERSATION · Trò chuyện với Lutra | 0, 5720 | 414 × 907 | Screen |
| vu29F | SERVICE_LIST · Dịch vụ hỗ trợ | 474, 5720 | 414 × 781 | Screen |
| I0OSPK | SERVICE_DETAIL · Thông tin dịch vụ | 948, 5720 | 414 × 768 | Screen |
| rjJiR | URGENT · Hỗ trợ khẩn cấp | 1422, 5720 | 414 × 750 | Screen |
| Y7Icxi | SETTINGS · Hồ sơ và cài đặt | 1896, 5720 | 414 × 1057 | Screen |
| uYpli | PRIVACY · Dữ liệu của bạn | 0, 7320 | 414 × 956 | Screen |
| MZ86q | BLOCKED_USERS · Tài khoản đã chặn | 474, 7320 | 414 × 571 | Screen |
| PUWar | REPORT_CONTENT · Báo cáo nội dung | 948, 7320 | 414 × 899 | Screen |
| Ecy4j | MOD_QUEUE · Kiểm duyệt nội dung | 1422, 7320 | 414 × 831 | Screen |
| hWvOK | MOD_DETAIL · Xử lý báo cáo | 1896, 7320 | 414 × 915 | Screen |
| CfFB5 | CURATION · Quản lý nguồn | 0, 8920 | 414 × 1226 | Screen |
| QI47d | BENCHMARK · So sánh cộng đồng | 474, 8920 | 414 × 731 | Screen |
| xzTS5 | ONBOARD · Chăm sóc con, có người đồng hành | 948, 8920 | 414 × 1180 | Screen |
| w4mLZk | ACCESS · Chào bạn đến với Lutra Hug | 1422, 8920 | 414 × 856 | Screen |
| mnfw3 | WALKTHROUGH · Rõ hơn về chi phí | 948, 10164 | 414 × 900 | Screen |
| i8n4h | WALKTHROUGH · Có nhau, dễ hơn | 948, 11128 | 414 × 900 | Screen |
| P0vli | WALKTHROUGH · Tìm thông tin phù hợp | 948, 12092 | 414 × 900 | Screen |

Mobile screen width is 414 (height grows with content). Every screen: status bar (62) + "Screen content"
(vertical, padding 0/20/24/20, gap 24) + optional "Bottom safe area" holding a Bottom navigation instance.

## Slice-1 screens

| Screen | Status | Frame | Notes |
| --- | --- | --- | --- |
| ONBOARD | Designed | xzTS5 | Copy still pitches community + AI; lacks the slice message "data stays on this device, no cloud backup". |
| Walkthrough | Designed (3) | mnfw3, i8n4h, P0vli | Confirmed. Only `mnfw3` (expenses) is in slice scope; `i8n4h` (community) and `P0vli` (information/AI) cover out-of-scope features. |
| FAMILY_SETUP | Missing | — | |
| CHILD_FORM | Missing | — | |
| HOME | Designed | V2hIJ | No family/child filter; quick access + highlight show Community/AI (out of slice); 4-tab nav. |
| EXPENSES | Designed | uWuj3 | No child filter; 4-tab nav. |
| EXPENSE_FORM | Partial | m1a8H | No child selection / allocation split (required by slice). |
| BUDGET | Designed | oxprG | Family monthly budget — matches slice. |
| REPORTS | Designed | RQVXV | No family/child filter; 4-tab nav. |
| CHILDREN | Missing | — | |
| SYNC_DEVICES | Missing | — | |
| SYNC_CONFLICTS | Missing | — | |
| Tabs Home / Cost | Partial | GrArD | Component has 4 tabs (Trang chủ, Chi phí, Cộng đồng, Trợ lý AI); slice needs 2. |

Count: 7 designed or partial (ONBOARD, walkthrough, HOME, EXPENSES, EXPENSE_FORM, BUDGET, REPORTS),
5 missing (FAMILY_SETUP, CHILD_FORM, CHILDREN, SYNC_DEVICES, SYNC_CONFLICTS).

## Other screens (SCREEN_DESIGN.md, outside slice 1)

Designed: ACCESS, COMMUNITY, POST, POST_FORM, RESOURCE_LIST, RESOURCE_DETAIL, MENTORS, MENTOR_DETAIL,
CONNECTION_FORM, CONNECTIONS, ASSISTANT, CONVERSATION, SERVICE_LIST, SERVICE_DETAIL, URGENT, SETTINGS,
PRIVACY, BLOCKED_USERS, REPORT_CONTENT, MOD_QUEUE, MOD_DETAIL, CURATION, BENCHMARK (23 IDs; all in
SCREEN_DESIGN.md have a frame). Missing: none.

## Components and variables

Components (reusable): `NePTf` Primary button (374 × 52, `$lh-primary`, radius 16, label `Z2Qfuv`);
`gyjx4` Form field (label `n9o2e1`, surface `yA0SJ`, value `Sth9Q`); `GrArD` Bottom navigation (tabs
`bBnZ5` Trang chủ, `O57GmU` Chi phí, `V406L0` Cộng đồng, `RHtLz` Trợ lý AI).

Variables: `lh-primary` #296474, `lh-ink` #183B45, `lh-bg` #F4F8F9, `lh-muted` #5D7379,
`lh-body` "Inter", `lh-display` "Funnel Sans". Existing frames mostly use raw hex equal to these values,
plus un-tokenized tints: #E5F1F3 (accent surface), #E7EFF1 (segment track), #DFE9EB (stroke/divider),
#D6E5E9 (progress track), category colors #568DCF / #9785BB / #D29A65 / #65A695 / #9AA9AF.

## States

No dedicated empty, loading or error frames exist for slice-1 screens. Only inline hints elsewhere
(e.g. `tIiDN` "Empty blocked list" in BLOCKED_USERS, empty-source copy in CONVERSATION/SERVICE_LIST/URGENT,
"Gửi lỗi sẽ giữ nội dung" note in POST_FORM). Slice spec requires empty states for HOME/EXPENSES and
sync searching / transferring / success / error states.

## Added in this pass (2026-10-07)

All frames are 414 wide and use the existing shell: status bar, `Screen content`, `NePTf` button, `gyjx4`
field, and `GrArD` nav. Lucide icons, Funnel Sans and Inter. Bounds check: no clipped nodes and no overlaps with
other frames.

Row A (y = 520):

| Id | Name | x | Content / states |
| --- | --- | --- | --- |
| muJxs | FAMILY_SETUP · Tạo gia đình trên máy này | 2474 | Step 1/2, device name, VND / vi / max 2 devices, no-cloud warning, "Tạo gia đình", join-via-nearby link |
| myIYB | CHILD_FORM · Thêm trẻ đầu tiên | 2948 | Step 2/2, first child (add mode) |
| P1Wpt | CHILD_FORM · Sửa thông tin trẻ | 3422 | Rename, inline error example (empty name), stop-tracking block |
| bnCOs | CHILDREN · Hồ sơ trẻ | 3896 | Active (Bin, Na) and stopped (Tý, "Theo dõi lại") |
| vhxmq | HOME · Trạng thái trống | 4370 | Empty state: 0 đ, budget not set, family/child filter, actions (expense, budget, children, sync), 2-tab nav |
| WCnPi | EXPENSES · Trạng thái trống | 4844 | Empty month plus a "no search results" example, child filter, 2-tab nav |
| iWHm3 | EXPENSE_FORM · Chia cho nhiều trẻ | 5318 | Copy of m1a8H with child picker, Chia đều / Tự nhập, per-child shares, total check, remainder rule |

Row B (y = 2520):

| Id | Name | x | State |
| --- | --- | --- | --- |
| XsVbD | SYNC_DEVICES · Đồng bộ gần | 2474 | Paired idle + last sync; unpaired first-pairing options (invite / join) shown as a labelled state block |
| szQWx | SYNC_DEVICES · Đang tìm máy gần | 2948 | Searching + found device |
| hGUyB | SYNC_DEVICES · Xác minh mã | 3422 | Verification code, match / mismatch |
| E3ad0B | SYNC_DEVICES · Đang truyền | 3896 | Transferring, determinate 18/42 |
| R8LJLY | SYNC_DEVICES · Hoàn tất | 4370 | Success: N changes applied, 2 conflicts left → SYNC_CONFLICTS |
| qro6d | SYNC_DEVICES · Bị gián đoạn | 4844 | Error / interrupted, rolled back, retry |
| HvULc | SYNC_CONFLICTS · Xung đột cần chọn | 5318 | Edit/edit and edit/delete conflicts. Choices: this device, other device, or re-enter |

Two-tab nav: `GrArD` instances with `V406L0` (Cộng đồng) and `RHtLz` (Trợ lý AI) set to `enabled: false`.
The component itself is unchanged.

New un-tokenized colors (no variable exists): error #B5563F / #F6E7E3; conflict accent #A8703B / #FBF3EA / #E9D3BA.

Still open (not changed, existing frames left untouched): ONBOARD copy and walkthrough 2–3 cover features
outside the slice. HOME, EXPENSES and REPORTS use 4 tabs and have no child filter. Pre-existing canvas overlap:
RQVXV (y 520–2721) overlaps ve8wA (y 2520).

## Drift fixes (2026-10-07)

No frames were deleted, and the `GrArD` component is unchanged. Two-tab nav uses the same instance override as
the new frames: `V406L0` and `RHtLz` are set to `enabled: false`.

| Frame | Change |
| --- | --- |
| V2hIJ HOME | Added `pzYdO` Child filter (copy of `P2ptdM`: Cả gia đình / Bin / Na) under the page heading. Nav `qq1LP` now has 2 tabs. |
| uWuj3 EXPENSES | Added `nodtw` Child filter above the existing Filters row. Nav `Xsl56` now has 2 tabs. |
| RQVXV REPORTS | Added `wTHk9` Child filter under the segment control. Nav `WtCx4` now has 2 tabs. The frame grew to bottom y 2774. |
| oxprG BUDGET | No change (no nav). |
| m1a8H EXPENSE_FORM | Added `Q3njH` Child allocation after Category: "Chi cho trẻ nào?", picker (Bin selected, Na unselected) and link `ZvxER` "Chia cho nhiều trẻ →" that opens the `iWHm3` split state. The frame grows to 1128. |
| xzTS5 ONBOARD | Renamed to "Chăm sóc con, rõ từng khoản chi". Intro copy now says data stays on the phone with no cloud backup. The 3 rows are now: Chi phí theo từng con (wallet), Ngân sách và báo cáo (chart-pie), Dữ liệu ở trên máy bạn (smartphone). |
| mnfw3 Walkthrough 1 | "Chi phí theo từng con": per-child expenses and the split. Illustration kept. |
| i8n4h Walkthrough 2 | "Ngân sách cả nhà": family monthly budget plus reports. Icon changed from users to chart-pie. Photo kept. |
| P0vli Walkthrough 3 | "Dữ liệu ở trên máy bạn": no cloud, two nearby phones sync directly. Icon changed from book-open to smartphone. Photo kept. |
| ve8wA RESOURCE_DETAIL | Moved only, from y 2520 to y 2856. No top-level frames overlap now (50 checked). |
| Variables | Added `lh-danger` #B5563F and `lh-warning` #A8703B. Rebound 7 fill/stroke uses in the new frames, plus the `igF8N` instance override (`yA0SJ` stroke). |

Still open:
- HOME `V2hIJ` Quick access still shows the Cộng đồng and Trợ lý AI tiles, and the healthcare highlight still links to the resource library. Both are outside the slice.
- `OworN` stroke `#B5563F55` (alpha) stays raw hex.
- The chip label is "Cả gia đình", matching the new frames, not "Cả nhà".
