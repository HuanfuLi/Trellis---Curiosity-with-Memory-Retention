import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { postHistoryService } from '../services/post-history.service';
import type { DailyPost } from '../types';
import { today } from '../lib/date';

export default function PostHistoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Map<string, DailyPost[]>>(new Map());
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const data = postHistoryService.getPostsByDay();
      setGroups(data);
    } catch {
      setError(true);
    }
  }, []);

  const reload = () => {
    setError(false);
    try {
      setGroups(postHistoryService.getPostsByDay());
    } catch {
      setError(true);
    }
  };

  const formatDayHeading = (dateStr: string): string => {
    const d = new Date(dateStr);
    const todayStr = today();
    if (dateStr === todayStr) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getThumb = (post: DailyPost): string | null => {
    if (post.videoMeta?.thumbnailUrl) return post.videoMeta.thumbnailUrl;
    if (post.newsMeta?.imageUrl) return post.newsMeta.imageUrl;
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Header backTo="/home" title={t('home.history.title')} />

      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px',
        paddingTop: `${HEADER_HEIGHT + 16}px`,
      }}>
        {error ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px',
          }}>
            <AlertCircle size={32} style={{ color: 'var(--muted-foreground)', marginBottom: '8px' }} />
            <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>
              {t('home.history.errorTitle')}
            </span>
            <button
              onClick={reload}
              style={{
                fontSize: '14px', fontWeight: 600,
                color: 'var(--primary-40)',
                background: 'none', border: 'none', cursor: 'pointer',
                marginTop: '12px',
              }}
            >
              {t('home.history.errorRetry')}
            </button>
          </div>
        ) : groups.size === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--muted-foreground)' }}>
              {t('home.history.emptyTitle')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              {t('home.history.emptyBody')}
            </span>
          </div>
        ) : (
          Array.from(groups.entries()).map(([day, posts]) => (
            <div key={day} style={{ marginBottom: '24px' }}>
              {/* Sticky day heading */}
              <div style={{
                position: 'sticky', top: 0,
                fontSize: '14px', fontWeight: 600,
                color: 'var(--foreground)',
                background: 'var(--background)',
                padding: '8px 0',
                zIndex: 1,
              }}>
                {formatDayHeading(day)}
              </div>

              {/* Post items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/posts/${post.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: 'var(--card)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow-1)',
                      padding: '12px',
                      border: 'none', cursor: 'pointer',
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    {/* Thumbnail */}
                    {getThumb(post) ? (
                      <img
                        src={getThumb(post)!}
                        alt=""
                        style={{
                          width: '48px', height: '48px',
                          borderRadius: '8px', objectFit: 'cover', flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '8px',
                        background: 'var(--surface-variant)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px',
                      }}>
                        {post.presentationStyle === 'text-art' ? '\u270E' : '\uD83D\uDCC4'}
                      </div>
                    )}

                    {/* Title + concept label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px', fontWeight: 400,
                        color: 'var(--foreground)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {post.title}
                      </div>
                      <div style={{
                        fontSize: '12px', color: 'var(--muted-foreground)',
                        marginTop: '2px',
                      }}>
                        {post.contextLabel}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
