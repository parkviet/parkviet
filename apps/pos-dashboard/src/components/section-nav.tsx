import { useEffect, useState } from 'react'

// Sticky section list for a long settings page. Hidden below the `lg` breakpoint.
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [current, setCurrent] = useState(sections[0]?.id ?? '')
  useEffect(() => {
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node !== null)
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setCurrent(visible.target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.5] },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [sections])
  return (
    <nav className="sticky top-16 hidden w-44 shrink-0 lg:block" aria-label={sections[0]?.label}>
      <ul className="space-y-1">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={current === section.id ? 'true' : undefined}
              className={
                current === section.id
                  ? 'block rounded-md border-l-2 border-primary py-2 pl-3 text-sm font-semibold'
                  : 'block rounded-md py-2 pl-3 text-sm text-muted-foreground'
              }
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
