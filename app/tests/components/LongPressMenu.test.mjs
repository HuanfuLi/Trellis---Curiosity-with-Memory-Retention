// Wave-0 scaffold — assertions filled in by Phase 43 Plan 43-03
// (longpress-menu-and-masonry-integration).
//
// TODO from 43-03:
// - opens on 480ms hold via useLongPress hook (timer + didLongPress ref)
// - dismisses on backdrop tap (BottomSheet onClose called)
// - calls engagementService.savePost / likePost / dismissAnchor on respective row tap
// - row labels flip Save→Unsave / Like→Unlike when isSaved/isLiked is true (LP-04)
// - row icons flip fill="none" → fill="currentColor" with appropriate color
//   token (var(--primary-40) for saved, var(--node-salmon) for liked)
// - dismiss row uses var(--muted-foreground) icon + label (NOT var(--danger);
//   per UI-SPEC §Color rules: dismiss is conservational not punitive)
//
// NEGATIVE invariant (anti-wire per CONTEXT canonical_refs §Source-reading test pattern):
// - grep -c "CONCEPT_EXPLORED" app/src/components/LongPressMenu.tsx returns 0
//   (the engagement service emits ANCHOR_DISMISSED + ENGAGEMENT_CHANGED;
//   LongPressMenu MUST NOT emit CONCEPT_EXPLORED directly)
//
// Reference: app/src/components/ChatMessage.tsx:119-140 (long-press pattern source),
// app/src/services/engagement.service.ts (Phase 39 consumer surface).

import test from 'node:test';
import assert from 'node:assert/strict';

test('Phase 43 LongPressMenu — pending implementation in 43-03', { skip: 'Wave 0 stub; implementation lands in 43-03' }, () => {
  assert.ok(true);
});
