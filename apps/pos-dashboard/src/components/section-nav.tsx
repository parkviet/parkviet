import { useEffect, useRef, useState } from 'react'

// Sticky section list for a long settings page. Vertical sidebars hide below `lg`;
// horizontal bars sit above a configuration column at every width.
export function SectionNav({
  sections,
  className,
  label,
  orientation = 'vertical',
  onSelect,
  onScrollActive,
}: {
  sections: { id: string; label: string }[]
  className?: string
  label?: string
  orientation?: 'vertical' | 'horizontal'
  onSelect?: (id: string) => void
  onScrollActive?: (id: string) => void
}) {
  const [current, setCurrent] = useState(sections[0]?.id ?? '')
  const onScrollRef = useRef(onScrollActive)
  onScrollRef.current = onScrollActive

  useEffect(() => {
    const map = new Map<Element, string>()
    for (const section of sections) {
      const node = document.getElementById(section.id)
      if (!node) continue
      map.set(node.closest('section') ?? node, section.id)
    }
    if (map.size === 0) return
    let scrolled = false
    const markScroll = () => {
      scrolled = true
    }
    window.addEventListener('scroll', markScroll, { passive: true })
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const nextId = visible ? map.get(visible.target) : undefined
        if (nextId) {
          setCurrent(nextId)
          if (scrolled) onScrollRef.current?.(nextId)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.5] },
    )
    for (const element of map.keys()) observer.observe(element)
    return () => {
      window.removeEventListener('scroll', markScroll)
      observer.disconnect()
    }
  }, [sections])

  const horizontal = orientation === 'horizontal'
  return (
    <nav
      className={
        className ??
        (horizontal
          ? 'sticky top-[var(--spacing-header-height,4rem)] z-10 border-b bg-background/95 py-2 backdrop-blur'
          : 'sticky top-[var(--spacing-header-height,4rem)] z-10 hidden w-44 shrink-0 bg-background lg:block')
      }
      aria-label={label ?? sections[0]?.label}
    >
      <ul className={horizontal ? 'flex flex-wrap gap-1.5' : 'space-y-1'}>
        {sections.map((section) => {
          const active = current === section.id
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  setCurrent(section.id)
                  onSelect?.(section.id)
                }}
                className={
                  horizontal
                    ? active
                      ? 'inline-flex rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                      : 'inline-flex rounded-full px-3.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'
                    : active
                      ? 'block rounded-md border-l-2 border-primary py-2 pl-3 text-sm font-semibold'
                      : 'block rounded-md py-2 pl-3 text-sm text-muted-foreground'
                }
              >
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
