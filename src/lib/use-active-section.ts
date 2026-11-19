"use client";

import { useEffect, useState } from "react";

// Which of the page's sections (by element id) is being read: the first one,
// in page order, whose top half sits below the sticky header. `select` marks
// one straight away, for a click on its link before the scroll catches up.
// Without IntersectionObserver (old browsers, tests) only clicks change it.
export function useActiveSection(
  ids: readonly string[],
): [string | null, (id: string) => void] {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (typeof IntersectionObserver === "undefined" || list.length === 0)
      return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = list.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    for (const id of list) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);

  const current = active && ids.includes(active) ? active : (ids[0] ?? null);
  return [current, setActive];
}
