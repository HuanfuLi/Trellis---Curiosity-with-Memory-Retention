import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import { normalizeMarkdownText } from '../lib/text-normalization';

// Allow <sup> for citation tags while blocking dangerous elements.
// Extend the default GitHub schema with our citation attributes.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'sup'],
  attributes: {
    ...defaultSchema.attributes,
    sup: ['dataCite', 'style'],
    // KaTeX injects spans/divs with class and style — allow those through
    span: [...(defaultSchema.attributes?.['span'] ?? []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.['div'] ?? []), 'className', 'style'],
  },
};

interface MarkdownProps {
  children: string;
}

/**
 * Renders markdown content with scoped prose styles.
 * Used in AI chat bubbles and script preview text.
 */
export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
      >
        {normalizeMarkdownText(children)}
      </ReactMarkdown>
    </div>
  );
}
