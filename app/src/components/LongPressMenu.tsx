import { useTranslation } from 'react-i18next';
import { Heart, Bookmark, EyeOff } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { engagementService } from '../services/engagement.service';
import { toast } from '../lib/toast';

interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
}

/**
 * Phase 43 LP-01..LP-04: Bottom-sheet contextual menu for feed-tile engagement
 * actions (Like / Save / Not interested).
 *
 * State is read SYNCHRONOUSLY at render time via engagementService.isSaved /
 * isLiked — the menu is opened fresh each time the user long-presses a tile,
 * so a subscription is unnecessary. HomeScreen (43-06 host) owns the
 * { open, postId, anchorId } state and bumps it on each long-press.
 *
 * Anti-wire invariant (CONTEXT canonical_refs + RESEARCH Pitfall 8):
 *   - This component MUST NEVER emit any explored-anchor / vine-progress signal.
 *   - All emits go THROUGH the engagement service, which fires
 *     ANCHOR_DISMISSED (dismiss) or ENGAGEMENT_CHANGED (save/like/unsave/unlike)
 *     per Phase 39 D-05.
 *   - Source-reading tests in tests/components/LongPressMenu.test.mjs enforce
 *     zero occurrences of the explored-anchor event name OR any direct
 *     event-bus emit OR any direct dailyRead service call.
 *
 * Visual contract (UI-SPEC §1):
 *   - 3 stacked button rows, top-to-bottom: Like → Save → Not interested
 *   - Row min-height 56px (exceeds 44px WCAG floor)
 *   - Icons Heart / Bookmark / EyeOff at size 22
 *   - Active state flips label + icon fill ("Save" ↔ "Unsave", filled vs outline)
 *   - Inline styles + CSS variables only (NO Tailwind per project convention)
 *
 * Toast variants (LP-03 / UI-SPEC §3):
 *   - savePost / likePost  → 'success'
 *   - removeSavedPost / unlikePost / dismissAnchor → 'info'
 */
export function LongPressMenu({ open, onClose, postId, anchorId }: LongPressMenuProps) {
  const { t } = useTranslation();

  // Defensive: if the host opens the menu without a post/anchor context we
  // render a closed sheet shell so the BottomSheet portal still mounts cleanly.
  if (!postId || !anchorId) {
    return (
      <BottomSheet open={false} onClose={onClose} compact>
        <></>
      </BottomSheet>
    );
  }

  const isSaved = engagementService.isSaved(postId);
  const isLiked = engagementService.isLiked(postId);

  const handleSave = () => {
    if (isSaved) {
      engagementService.removeSavedPost(postId);
      toast(t('engagement.toast.unsaved'), 'info');
    } else {
      engagementService.savePost(postId);
      toast(t('engagement.toast.saved'), 'success');
    }
    onClose();
  };

  const handleLike = () => {
    if (isLiked) {
      engagementService.unlikePost(postId);
      toast(t('engagement.toast.unliked'), 'info');
    } else {
      engagementService.likePost(postId);
      toast(t('engagement.toast.liked'), 'success');
    }
    onClose();
  };

  const handleDismiss = () => {
    engagementService.dismissAnchor(anchorId);
    toast(t('engagement.toast.dismissed'), 'info');
    onClose();
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: '56px',
    padding: '0 16px',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--foreground)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return (
    <BottomSheet open={open} onClose={onClose} compact>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Row 1: Like / Unlike — LP-04 state flip */}
        <button type="button" style={rowStyle} onClick={handleLike}>
          <Heart
            size={22}
            fill={isLiked ? 'currentColor' : 'none'}
            color={isLiked ? 'var(--node-salmon)' : 'var(--foreground)'}
          />
          <span>{isLiked ? t('engagement.menu.unlike') : t('engagement.menu.like')}</span>
        </button>

        {/* Row 2: Save / Unsave — LP-04 state flip */}
        <button type="button" style={rowStyle} onClick={handleSave}>
          <Bookmark
            size={22}
            fill={isSaved ? 'currentColor' : 'none'}
            color={isSaved ? 'var(--primary-40)' : 'var(--foreground)'}
          />
          <span>{isSaved ? t('engagement.menu.unsave') : t('engagement.menu.save')}</span>
        </button>

        {/* Row 3: Not interested — single state, muted (conservational not punitive
            per UI-SPEC §Color rules — never var(--danger)). */}
        <button
          type="button"
          style={{ ...rowStyle, color: 'var(--muted-foreground)' }}
          onClick={handleDismiss}
        >
          <EyeOff size={22} color="var(--muted-foreground)" fill="none" />
          <span>{t('engagement.menu.dismiss')}</span>
        </button>
      </div>
    </BottomSheet>
  );
}
