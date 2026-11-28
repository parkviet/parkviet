import { adminClient, useAuth } from '@spree/dashboard-core'
import { Button, Input, Label } from '@spree/dashboard-ui'
import {
  BanknoteIcon,
  Building2Icon,
  ChartColumnIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  EyeOffIcon,
  LayersIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@spree/dashboard-ui/icons'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import posAppIcon from '../assets/brand/parkviet-pos-app-icon.svg'
import { safeRedirect } from '../lib/safe-redirect'

function usePublicRegistrationEnabled() {
  return useQuery({
    queryKey: ['pos', 'public-registration'],
    queryFn: async () => {
      try {
        const res = await adminClient.request<{ data?: { enabled?: boolean } }>(
          'GET',
          '/pos/registration',
        )
        return Boolean(res?.data?.enabled)
      } catch {
        return false
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

// What an administrator does in this app, shown beside the sign-in form.
// Each task gets its own soft tint so the panel reads at a glance.
const ADMIN_TASKS = [
  { key: 'branches', icon: Building2Icon, tint: 'bg-sky-100 text-sky-700' },
  { key: 'catalog', icon: LayersIcon, tint: 'bg-amber-100 text-amber-700' },
  { key: 'staff', icon: UsersIcon, tint: 'bg-violet-100 text-violet-700' },
  { key: 'sales', icon: ReceiptTextIcon, tint: 'bg-rose-100 text-rose-700' },
  { key: 'money', icon: BanknoteIcon, tint: 'bg-emerald-100 text-emerald-700' },
  { key: 'reports', icon: ChartColumnIcon, tint: 'bg-indigo-100 text-indigo-700' },
] as const

function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="pos-login-headline"
        className="relative hidden overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 text-sky-900 opacity-[0.05] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-sky-200/50 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-[28rem] rounded-full bg-emerald-200/50 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <img src={posAppIcon} alt="" className="size-10 drop-shadow-md" />
          <span className="text-lg font-semibold tracking-tight">{t('posDashboard.title')}</span>
        </div>

        <div className="relative max-w-xl space-y-8">
          <div className="space-y-3">
            <h1
              id="pos-login-headline"
              className="text-4xl font-semibold leading-tight tracking-tight"
            >
              {t('posDashboard.loginHeadline')}
            </h1>
            <p className="text-base text-slate-600">{t('posDashboard.loginIntro')}</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {ADMIN_TASKS.map(({ key, icon: Icon, tint }) => (
              <li
                key={key}
                className="flex gap-3 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tint}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold">
                    {t(`posDashboard.loginTasks.${key}.title`)}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {t(`posDashboard.loginTasks.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheckIcon className="size-4 text-emerald-600" />
          {t('posDashboard.loginSecurity')}
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <img src={posAppIcon} alt="" className="size-10" />
            <span className="text-lg font-semibold tracking-tight">{t('posDashboard.title')}</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4">
      {children}
    </span>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const error = tone === 'error'
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={
        error
          ? 'flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          : 'flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400'
      }
    >
      {error ? (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </p>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  const router = useRouter()
  // Validated again here: the route already sanitizes it, but this is the
  // last step before the target becomes a navigation.
  const target = safeRedirect(useSearch({ from: '/login' }).redirect) ?? '/'
  const [error, setError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const registration = usePublicRegistrationEnabled()
  // One path for both cases: an already signed-in visit and a fresh sign-in.
  // `href` keeps the remembered search string intact.
  useEffect(() => {
    if (auth.isAuthenticated) void router.navigate({ href: target, replace: true })
  }, [auth.isAuthenticated, router, target])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(false)
    try {
      await auth.login(String(form.get('email')), String(form.get('password')))
    } catch {
      setError(true)
    }
  }
  if (auth.isAuthenticated) return null
  const busy = auth.isLoading || auth.isInitializing
  return (
    <AuthShell>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('posDashboard.welcomeBack')}</h2>
        <p className="text-sm text-muted-foreground">{t('posDashboard.signInHint')}</p>
      </div>
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('posDashboard.email')}</Label>
          <div className="relative">
            <FieldIcon>
              <MailIcon />
            </FieldIcon>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@company.vn"
              className="h-11 pl-9"
              required
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('posDashboard.password')}</Label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('posDashboard.forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <FieldIcon>
              <LockIcon />
            </FieldIcon>
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="h-11 px-9"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={t(
                showPassword ? 'posDashboard.hidePassword' : 'posDashboard.showPassword',
              )}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        {error && <Notice tone="error">{t('posDashboard.loginFailed')}</Notice>}
        <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
          {busy && <Loader2Icon className="size-4 animate-spin" />}
          {t('posDashboard.signIn')}
        </Button>
      </form>
      {registration.data && (
        <p className="text-center text-sm text-muted-foreground">
          {t('posDashboard.noAccountYet')}{' '}
          <Link
            to="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('posDashboard.createAccountLink')}
          </Link>
        </p>
      )}
    </AuthShell>
  )
}

function registrationErrorMessage(err: unknown, t: (key: string) => string): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
      ? err.code
      : undefined
  if (code === 'email_taken') return t('posDashboard.registerEmailTaken')
  if (code === 'registration_disabled') return t('posDashboard.registerDisabled')
  if (code === 'registration_rate_limited') return t('posDashboard.registerRateLimited')
  return t('posDashboard.registerFailed')
}

export function RegisterPage() {
  const { t } = useTranslation()
  const auth = useAuth()
  const router = useRouter()
  const registration = usePublicRegistrationEnabled()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (auth.isAuthenticated) void router.navigate({ to: '/', replace: true })
  }, [auth.isAuthenticated, router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const storeName = String(form.get('store_name') ?? '').trim()
    const fullName = String(form.get('full_name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (password.length < 6) {
      setError(t('posDashboard.registerPasswordTooShort'))
      return
    }

    setError(null)
    setPending(true)
    try {
      await adminClient.request('POST', '/pos/registration', {
        body: {
          store_name: storeName,
          full_name: fullName,
          email,
          password,
          country_code: 'VN',
        },
      })
      await auth.login(email, password)
    } catch (err) {
      setError(registrationErrorMessage(err, t))
      setPending(false)
    }
  }

  if (auth.isAuthenticated) return null
  const busy = pending || auth.isLoading || auth.isInitializing

  return (
    <AuthShell>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('posDashboard.registerTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('posDashboard.registerIntro')}</p>
      </div>
      {registration.isLoading ? (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      ) : !registration.data ? (
        <div className="space-y-5">
          <Notice tone="error">{t('posDashboard.registerDisabled')}</Notice>
          <Link
            to="/login"
            className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('posDashboard.backToLogin')}
          </Link>
        </div>
      ) : (
        <>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="store_name">{t('posDashboard.storeName')}</Label>
              <div className="relative">
                <FieldIcon>
                  <Building2Icon />
                </FieldIcon>
                <Input
                  id="store_name"
                  name="store_name"
                  type="text"
                  autoComplete="organization"
                  placeholder={t('posDashboard.storeNamePlaceholder')}
                  className="h-11 pl-9"
                  maxLength={120}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">{t('posDashboard.fullName')}</Label>
              <div className="relative">
                <FieldIcon>
                  <UsersIcon />
                </FieldIcon>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  placeholder={t('posDashboard.fullNamePlaceholder')}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('posDashboard.email')}</Label>
              <div className="relative">
                <FieldIcon>
                  <MailIcon />
                </FieldIcon>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.vn"
                  className="h-11 pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('posDashboard.password')}</Label>
                <span className="text-xs text-muted-foreground">
                  {t('posDashboard.passwordHint')}
                </span>
              </div>
              <div className="relative">
                <FieldIcon>
                  <LockIcon />
                </FieldIcon>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={6}
                  className="h-11 px-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={t(
                    showPassword ? 'posDashboard.hidePassword' : 'posDashboard.showPassword',
                  )}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
              {busy && <Loader2Icon className="size-4 animate-spin" />}
              {t('posDashboard.registerSubmit')}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {t('posDashboard.alreadyHaveAccount')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('posDashboard.signIn')}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'pending' | 'sent' | 'error'>('idle')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email'))
    setState('pending')
    try {
      await adminClient.auth.requestPasswordReset({ email })
      setState('sent')
    } catch {
      setState('error')
    }
  }
  return (
    <AuthShell>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('posDashboard.forgotPasswordTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('posDashboard.forgotPasswordIntro')}</p>
      </div>
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('posDashboard.email')}</Label>
          <div className="relative">
            <FieldIcon>
              <MailIcon />
            </FieldIcon>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.vn"
              className="h-11 pl-9"
              required
              autoFocus
            />
          </div>
        </div>
        {state === 'sent' && <Notice tone="success">{t('posDashboard.resetSent')}</Notice>}
        {state === 'error' && <Notice tone="error">{t('posDashboard.error')}</Notice>}
        <Button type="submit" className="h-11 w-full text-base" disabled={state === 'pending'}>
          {state === 'pending' && <Loader2Icon className="size-4 animate-spin" />}
          {t('posDashboard.resetPassword')}
        </Button>
      </form>
      <Link
        to="/login"
        className="block text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t('posDashboard.backToLogin')}
      </Link>
    </AuthShell>
  )
}
