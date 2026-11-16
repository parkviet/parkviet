import { Button, Card, SectionTitle } from '@spree/dashboard-ui'
import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// The frame of a home widget: a card filling its grid cell, its title with an
// icon tile at the top (and an optional action at its end) and the body
// below. The section is named by the title.
export function WidgetCard({
  titleId,
  title,
  icon,
  action,
  children,
}: {
  titleId: string
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="@container/card h-full overflow-hidden">
      <section
        aria-labelledby={titleId}
        className="flex h-full min-h-0 flex-col gap-3 p-4 group-data-[editing]/widget:pt-7"
      >
        <div className="flex flex-none items-center gap-2">
          <SectionTitle id={titleId}>
            {icon}
            <span className="truncate">{title}</span>
          </SectionTitle>
          {action}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      </section>
    </Card>
  )
}

function WidgetFailure({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <Card className="h-full justify-center gap-3 p-4" role="alert">
      <p className="text-sm text-destructive">{t('homeWidgets.failed')}</p>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onRetry}>
        {t('retry')}
      </Button>
    </Card>
  )
}

// A widget that throws while rendering shows a failure in its own cell; the
// rest of the page keeps working.
export class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Home widget failed to render', error)
  }

  render() {
    if (this.state.failed) return <WidgetFailure onRetry={() => this.setState({ failed: false })} />
    return this.props.children
  }
}
