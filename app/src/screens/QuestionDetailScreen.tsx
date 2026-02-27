import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useQuestions } from '../state/useQuestions';
import { formatDate } from '../lib/date';

export function QuestionDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, questions } = useQuestions();

  const question = id ? getById(id) : undefined;

  if (!question) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', border: 'none', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <p style={{ color: 'var(--muted-foreground)' }}>Question not found.</p>
      </div>
    );
  }

  const related = questions.filter((q) => question.relatedQuestionIds.includes(q.id));

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          color: 'var(--primary-40)',
          background: 'none',
          border: 'none',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: 0,
        }}
      >
        <ArrowLeft size={20} /> Back
      </button>

      {/* Question */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '8px' }}>{question.content}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={14} /> {formatDate(question.createdAt)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Tag size={14} /> {question.reviewSchedule.reviewCount} reviews
          </span>
        </div>
      </div>

      {/* Keywords */}
      {question.keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {question.keywords.map((kw) => (
            <Badge key={kw} color="green">{kw}</Badge>
          ))}
        </div>
      )}

      {/* Answer */}
      <Card style={{ marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '12px', color: 'var(--muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Answer
        </h4>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '1rem', lineHeight: 1.7, color: 'var(--foreground)', margin: 0 }}>
          {question.answer}
        </pre>
      </Card>

      {/* Related Questions */}
      {related.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '12px' }}>Related Questions</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {related.map((q) => (
              <Card
                key={q.id}
                onClick={() => navigate(`/ask/${q.id}`)}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <p style={{ fontWeight: 500, marginBottom: '4px' }}>{q.content}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{q.summary}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
