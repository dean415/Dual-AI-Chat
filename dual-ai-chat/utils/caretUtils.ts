/**
 * Measure the caret position at the visual end of rendered rich text inside a container.
 * Returns coordinates relative to the container (for absolute positioning),
 * or null when no measurable rect is available.
 */
export function measureCaretPositionAtEnd(container: HTMLElement): { left: number; top: number; height: number } | null {
  if (!container || !(container instanceof HTMLElement)) return null;

  const isSkippableElement = (el: Element | null): boolean => {
    if (!el) return false;
    const cls = (el as HTMLElement).classList;
    if (cls && cls.contains('typing-caret')) return true; // skip our own caret
    const ariaHidden = el.getAttribute('aria-hidden');
    if (ariaHidden === 'true') return true; // skip hidden service nodes
    return false;
  };

  const isWithinSkippable = (node: Node): boolean => {
    let p: Node | null = node.parentNode;
    while (p) {
      if (p.nodeType === Node.ELEMENT_NODE && isSkippableElement(p as Element)) return true;
      p = p.parentNode;
    }
    return false;
  };

  // Helper: depth-first find the last descendant node
  const getDeepLastNode = (node: Node): Node => {
    const children = (node as HTMLElement).childNodes;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      // Skip comment nodes
      if (child.nodeType === Node.COMMENT_NODE) continue;
      // Prefer element/text nodes
      if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE) {
        // Skip skippable elements and their content
        if (child.nodeType === Node.ELEMENT_NODE && isSkippableElement(child as Element)) continue;
        if (isWithinSkippable(child)) continue;
        // If element has children, dive in; else return element
        if ((child as HTMLElement).childNodes && (child as HTMLElement).childNodes.length > 0) {
          return getDeepLastNode(child);
        }
        return child;
      }
    }
    return node;
  };

  // Helper: find the last text node with non-whitespace content within container
  const findLastTextNodeWithContent = (root: Node): { node: Text; offset: number } | null => {
    const stack: Node[] = [root];
    let lastText: { node: Text; offset: number } | null = null;
    while (stack.length) {
      const cur = stack.pop()!;
      // Skip skippable containers entirely
      if (cur.nodeType === Node.ELEMENT_NODE && isSkippableElement(cur as Element)) continue;
      if (isWithinSkippable(cur)) continue;
      const cn = (cur as HTMLElement).childNodes;
      if (cn && cn.length) {
        for (let i = cn.length - 1; i >= 0; i--) stack.push(cn[i]);
      }
      if (cur.nodeType === Node.TEXT_NODE) {
        const txt = (cur as Text).data || '';
        const trimmed = txt.replace(/\s+$/g, '');
        if (trimmed.length > 0) {
          lastText = { node: cur as Text, offset: trimmed.length };
          break;
        }
      }
    }
    return lastText;
  };

  try {
    const parentRect = container.getBoundingClientRect();
    // Try text-end precise measurement first
    const lastText = findLastTextNodeWithContent(container);
    if (lastText) {
      const range = document.createRange();
      const { node, offset } = lastText;
      range.setStart(node, offset);
      range.setEnd(node, offset);
      const rects = range.getClientRects();
      const rect = rects && rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
      if (rect) {
        return {
          left: rect.right - parentRect.left + (container.scrollLeft || 0),
          top: rect.top - parentRect.top + (container.scrollTop || 0),
          height: rect.height || parseFloat(getComputedStyle(container).lineHeight || '16'),
        };
      }
    }

    // Fallback: try the last element's content-end rect via Range (ignore caret nodes)
    let lastElement: Element | null = null;
    {
      const cn = container.childNodes;
      for (let i = cn.length - 1; i >= 0; i--) {
        const n = cn[i];
        if (n.nodeType === Node.ELEMENT_NODE && !isSkippableElement(n as Element)) { lastElement = n as Element; break; }
      }
      if (!lastElement) {
        // Walk deep to find last non-skippable
        const deep = getDeepLastNode(container);
        if (deep.nodeType === Node.ELEMENT_NODE && !isSkippableElement(deep as Element)) lastElement = deep as Element;
        else if (deep.parentElement && !isSkippableElement(deep.parentElement)) lastElement = deep.parentElement;
      }
    }
    if (lastElement) {
      try {
        const range = document.createRange();
        range.selectNodeContents(lastElement);
        range.collapse(false); // to end
        const rects = range.getClientRects();
        const rect = rects && rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
        if (rect) {
          return {
            left: rect.right - parentRect.left + (container.scrollLeft || 0),
            top: rect.top - parentRect.top + (container.scrollTop || 0),
            height: rect.height || parseFloat(getComputedStyle(container).lineHeight || '16'),
          };
        }
      } catch {}
      // As a looser fallback, use element bbox
      try {
        const rect = lastElement.getBoundingClientRect();
        return {
          left: rect.right - parentRect.left + (container.scrollLeft || 0),
          top: rect.bottom - parentRect.top + (container.scrollTop || 0) - rect.height,
          height: rect.height || parseFloat(getComputedStyle(container).lineHeight || '16'),
        };
      } catch {}
    }

    // As a last resort, use container bottom-right
    return {
      left: parentRect.width,
      top: Math.max(0, parentRect.height - parseFloat(getComputedStyle(container).lineHeight || '16')),
      height: parseFloat(getComputedStyle(container).lineHeight || '16'),
    };
  } catch {
    return null;
  }
}

export default measureCaretPositionAtEnd;
