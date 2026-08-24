'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PostSearchHighlight() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');

  useEffect(() => {
    const root = document.getElementById('post-content');
    if (!root) return;

    // Clear previous highlights
    root.querySelectorAll('mark[data-search-highlight]').forEach(el => {
      const parent = el.parentNode!;
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
      parent.normalize();
    });

    // Traverse text nodes, wrap matches in <mark>
    const words = query?.trim().split(/\s+/).filter(Boolean) || [];
    if (words.length === 0) return;
    const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.parentElement?.closest('script,style,mark[data-search-highlight],pre,code')) {
          return NodeFilter.FILTER_REJECT;
        }
        regex.lastIndex = 0;
        return regex.test(node.textContent || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const toReplace: { node: Text; frag: DocumentFragment }[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const frag = document.createDocumentFragment();
      let text = node.textContent || '';
      let match: RegExpExecArray | null;
      let last = 0;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        const mark = document.createElement('mark');
        mark.setAttribute('data-search-highlight', '');
        mark.textContent = match[0];
        frag.appendChild(mark);
        last = regex.lastIndex;
        if (match[0] === '') regex.lastIndex++;
      }
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      toReplace.push({ node, frag });
    }

    toReplace.forEach(({ node, frag }) => node.parentNode?.replaceChild(frag, node));

    // Scroll to first highlight
    const first = root.querySelector('mark[data-search-highlight]') as HTMLElement | null;
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [query]);

  return null;
}
