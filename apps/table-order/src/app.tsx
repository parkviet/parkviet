import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toggleLanguage } from './i18n';
import { GuestApiError, guestApi, SESSION_ENDED } from './lib/api';
import { addLine, type CartLine, itemCount, orderBody, setQuantity } from './lib/cart';
import { applyTheme, isOrderQrActive, isValidPrepayMethod, remainingSeconds } from './lib/emenu';
import { errorKey, keepsKey } from './lib/errors';
import { forgetCode, readCode, readToken, saveToken, takeCodeFromAddress } from './lib/session';
import type {
  GuestMenu,
  GuestRequest,
  GuestSession,
  GuestTable,
  MenuItem,
  PaymentQr,
} from './lib/types';
import { CartScreen } from './screens/cart-screen';
import { ItemScreen } from './screens/item-screen';
import { MenuScreen } from './screens/menu-screen';
import { TableScreen } from './screens/table-screen';

// The guest polls instead of joining the branch stream.
export const POLL_MS = 5_000;

type Tab = 'menu' | 'cart' | 'table';
type Phase =
  | { kind: 'loading' }
  | { kind: 'no_code' }
  | { kind: 'invalid' }
  | { kind: 'ended' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; session: GuestSession };

// Opens a session from the code on the table, or resumes this tab's one.
async function startSession(code: string | null): Promise<GuestSession> {
  if (code) {
    const opened = await guestApi.openSession(code);
    saveToken(opened.token);
    const { token: _token, ...session } = opened;
    return session;
  }
  if (!readToken()) throw new GuestApiError(401, 'session_invalid', 'no session');
  return guestApi.session();
}

export function App() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [menu, setMenu] = useState<GuestMenu | null>(null);
  const [table, setTable] = useState<GuestTable | null>(null);
  const [tab, setTab] = useState<Tab>('menu');
  const [item, setItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [savedPrepay, setSavedPrepay] = useState<{ orderId: string; lines: CartLine[] } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
  const [payMethod, setPayMethod] = useState<'vietqr' | 'counter' | null>(null);
  const [bill, setBill] = useState<PaymentQr | null>(null);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // One key per cart: a retry after a lost answer replays the same order.
  const orderKey = useRef<string | null>(null);
  // Starts once per page load, also under StrictMode's second effect run.
  const started = useRef(false);
  // This tab held a session, so an ended one reads "scan again".
  const hadSession = useRef(false);
  const menuRef = useRef<GuestMenu | null>(null);
  const tableRef = useRef<GuestTable | null>(null);

  const updateMenu = useCallback((next: GuestMenu | null) => {
    menuRef.current = next;
    setMenu(next);
  }, []);

  const markPaused = useCallback(() => {
    updateMenu(null);
    setItem(null);
    setBill(null);
    setPhase((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', session: { ...current.session, paused: true } }
        : current,
    );
  }, [updateMenu]);

  const begin = useCallback(
    async (code: string | null) => {
      try {
        const session = await startSession(code);
        // An ordering session ends with the table's order; the code is kept
        // only to try again at a table that is not open yet.
        if (session.status === 'open') forgetCode();
        hadSession.current = true;
        if (session.paused) {
          updateMenu(null);
          setItem(null);
          setPhase({ kind: 'ready', session });
          return;
        }
        setPhase({ kind: 'ready', session });
        try {
          updateMenu(await guestApi.menu());
        } catch (menuError) {
          if (menuError instanceof GuestApiError && menuError.code === 'emenu_paused') {
            updateMenu(null);
            setItem(null);
            setPhase({ kind: 'ready', session: { ...session, paused: true } });
            return;
          }
          throw menuError;
        }
      } catch (error) {
        if (error instanceof GuestApiError && error.code === 'table_code_invalid') {
          forgetCode();
          setPhase({ kind: 'invalid' });
        } else if (error instanceof GuestApiError && SESSION_ENDED.includes(error.code)) {
          // A menu-only session tries the table's code again; one that
          // ordered asks for a new scan.
          saveToken(null);
          const saved = readCode();
          if (saved && !code) return begin(saved);
          setPhase(code || hadSession.current ? { kind: 'ended' } : { kind: 'no_code' });
        } else {
          setPhase({ kind: 'failed', message: t(errorKey(error)) });
        }
      }
    },
    [t, updateMenu],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    hadSession.current = Boolean(readToken());
    void begin(takeCodeFromAddress(window.location, window.history));
  }, [begin]);

  const session = phase.kind === 'ready' ? phase.session : null;
  const sessionId = session?.id ?? null;

  // The table and this phone's orders, every few seconds while visible.
  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    let inFlight = false;
    const read = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const [next, live] = await Promise.all([guestApi.table(), guestApi.session()]);
        if (stopped) return;
        tableRef.current = next;
        setTable(next);
        if (live.paused) {
          updateMenu(null);
          setItem(null);
          setBill(null);
          setPhase({ kind: 'ready', session: live });
        } else if (!menuRef.current) {
          try {
            const loaded = await guestApi.menu();
            if (stopped) return;
            updateMenu(loaded);
            setPhase({ kind: 'ready', session: live });
          } catch (menuError) {
            if (stopped) return;
            if (menuError instanceof GuestApiError && menuError.code === 'emenu_paused') {
              updateMenu(null);
              setPhase({ kind: 'ready', session: { ...live, paused: true } });
            } else if (
              menuError instanceof GuestApiError &&
              SESSION_ENDED.includes(menuError.code)
            ) {
              void begin(null);
            } else {
              setPhase({ kind: 'ready', session: live });
            }
          }
        } else {
          setPhase({ kind: 'ready', session: live });
        }
      } catch (error) {
        if (!stopped && error instanceof GuestApiError && SESSION_ENDED.includes(error.code))
          void begin(null);
      } finally {
        inFlight = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void read();
    };
    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sessionId, begin, updateMenu]);

  useEffect(() => {
    applyTheme(document.documentElement, menu?.theme);
  }, [menu]);

  useEffect(() => {
    if (waitUntil === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= waitUntil) setWaitUntil(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const hasExpiringPrepay = Boolean(
    table?.orders.some(
      (order) =>
        order.status === 'awaiting_payment' &&
        Boolean(order.payment?.expires_at) &&
        isOrderQrActive(order.payment?.expires_at, now),
    ),
  );

  useEffect(() => {
    if (!hasExpiringPrepay) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasExpiringPrepay]);

  useEffect(() => {
    if (!savedPrepay || !table) return;
    const tracked = table.orders.find((row) => row.id === savedPrepay.orderId);
    if (tracked?.status === 'accepted') {
      setSavedPrepay(null);
      setNotice({ text: t('sent'), failed: false });
    }
  }, [savedPrepay, table, t]);

  useEffect(() => {
    if (!bill || !table) return;
    const due = Number(table.due ?? 0);
    if (due <= 0) {
      setBill(null);
      setNotice({ text: t('billPaid'), failed: false });
      return;
    }
    const qrDue = Number(bill.due ?? bill.amount);
    if (Number.isFinite(qrDue) && due !== qrDue) {
      setBill(null);
      void guestApi
        .billPayment()
        .then((fresh) => {
          const latestDue = Number(tableRef.current?.due ?? 0);
          if (latestDue > 0 && Number(fresh.due ?? fresh.amount) === latestDue) {
            setBill(fresh);
          }
        })
        .catch(() => {});
    }
  }, [bill, table, t]);

  const changeCart = (next: CartLine[]) => {
    orderKey.current = null;
    setCart(next);
  };

  const send = async () => {
    if (busy || cart.length === 0 || !menu) return;
    const prepay = menu.payment?.timing === 'pay_before';
    if (prepay && !isValidPrepayMethod(menu.payment, payMethod)) return;
    const submittedLines = cart;
    setBusy(true);
    setNotice(null);
    orderKey.current ??= crypto.randomUUID();
    try {
      const order = await guestApi.submitOrder(
        { ...orderBody(cart), ...(prepay && payMethod ? { payment: payMethod } : {}) },
        orderKey.current,
      );
      orderKey.current = null;
      setWaitUntil(null);
      setCart([]);
      if (order.status === 'awaiting_payment') {
        setSavedPrepay({ orderId: order.id, lines: submittedLines });
        setNow(Date.now());
      } else {
        setSavedPrepay(null);
      }
      setNotice({
        text: t(order.status === 'awaiting_payment' ? 'awaitingPayment' : 'sent'),
        failed: false,
      });
      setTab('table');
      const nextTable = await guestApi.table();
      tableRef.current = nextTable;
      setTable(nextTable);
    } catch (error) {
      if (!keepsKey(error)) orderKey.current = null;
      if (error instanceof GuestApiError && error.code === 'emenu_paused') {
        markPaused();
        return;
      }
      if (error instanceof GuestApiError && error.code === 'order_too_soon') {
        const seconds = Number(error.details.retry_after_seconds);
        const retrySeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
        const ts = Date.now();
        setNow(ts);
        setWaitUntil(ts + retrySeconds * 1000);
        return;
      }
      if (error instanceof GuestApiError && SESSION_ENDED.includes(error.code)) {
        void begin(null);
        return;
      }
      setNotice({ text: t(errorKey(error)), failed: true });
      if (error instanceof GuestApiError && error.code === 'item_sold_out')
        updateMenu(await guestApi.menu().catch(() => menuRef.current));
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const canceled = await guestApi.cancelOrder(orderId);
      if (savedPrepay?.orderId === orderId && canceled.status === 'canceled') {
        setCart((current) => (current.length > 0 ? current : savedPrepay.lines));
        orderKey.current = null;
        setSavedPrepay(null);
      }
      const nextTable = await guestApi.table();
      tableRef.current = nextTable;
      setTable(nextTable);
    } catch (error) {
      if (error instanceof GuestApiError && SESSION_ENDED.includes(error.code)) {
        void begin(null);
      } else {
        setNotice({ text: t(errorKey(error)), failed: true });
        const nextTable = await guestApi.table().catch(() => null);
        if (nextTable) {
          tableRef.current = nextTable;
          setTable(nextTable);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const restorePrepay = () => {
    if (!savedPrepay) return;
    changeCart(savedPrepay.lines);
    setSavedPrepay(null);
    setTab('cart');
  };

  const payBill = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      setBill(await guestApi.billPayment());
    } catch (error) {
      if (error instanceof GuestApiError && error.code === 'emenu_paused') {
        markPaused();
      } else if (error instanceof GuestApiError && SESSION_ENDED.includes(error.code)) {
        void begin(null);
      } else {
        setNotice({ text: t(errorKey(error)), failed: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const request = async (kind: GuestRequest['kind']) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await guestApi.request(kind);
      const nextTable = await guestApi.table();
      tableRef.current = nextTable;
      setTable(nextTable);
    } catch (error) {
      if (error instanceof GuestApiError && SESSION_ENDED.includes(error.code)) {
        void begin(null);
      } else {
        setNotice({ text: t(errorKey(error)), failed: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const storeName = session ? menu?.theme?.store_name || session.branch.store_name : null;
  const logoUrl = menu?.theme?.logo_url ?? null;

  const header = (
    <header className="bar">
      <div className="brand-head">
        {logoUrl ? (
          <img
            className="logo"
            src={logoUrl}
            alt={storeName ?? ''}
            referrerPolicy="no-referrer"
            data-testid="store-logo"
          />
        ) : null}
        <div className="brand-titles">
          {storeName ? (
            <span className="store-name" data-testid="store-name">
              {storeName}
            </span>
          ) : null}
          <h1>
            {session
              ? t('tableTitle', { name: session.table.name, branch: session.branch.name })
              : t('title')}
          </h1>
        </div>
      </div>
      <button type="button" className="link" onClick={toggleLanguage}>
        {t('language')}
      </button>
    </header>
  );

  if (phase.kind !== 'ready' || !session) {
    const text =
      phase.kind === 'loading'
        ? t('loading')
        : phase.kind === 'no_code'
          ? t('noCode')
          : phase.kind === 'invalid'
            ? t('codeInvalid')
            : phase.kind === 'ended'
              ? t('sessionEnded')
              : phase.kind === 'failed'
                ? phase.message
                : '';
    return (
      <div className="page">
        {header}
        <main>
          <p role={phase.kind === 'loading' ? 'status' : 'alert'} data-testid="phase">
            {text}
          </p>
          {phase.kind === 'failed' ? (
            <button type="button" onClick={() => void begin(readCode())}>
              {t('retry')}
            </button>
          ) : null}
        </main>
      </div>
    );
  }

  const ordering = session.status === 'open' && !session.paused;
  const count = itemCount(cart);
  const waitSeconds = remainingSeconds(waitUntil, now);

  return (
    <div className="page">
      {header}
      {session.paused ? (
        tab === 'table' ? (
          <p className="banner warning" role="status" data-testid="paused">
            {t('paused')}
          </p>
        ) : null
      ) : ordering ? (
        <p className="muted banner">
          {t(session.approval === 'direct_to_kitchen' ? 'approvalDirect' : 'approvalStaff')}
        </p>
      ) : (
        <div className="banner warning" role="status" data-testid="table-closed">
          <p>{t('tableClosed')}</p>
          <button type="button" disabled={busy} onClick={() => void begin(readCode())}>
            {t('tableClosedRetry')}
          </button>
        </div>
      )}
      {waitSeconds > 0 ? (
        <p className="error" role="status" data-testid="order-wait">
          {t('error_order_too_soon', { seconds: waitSeconds })}
        </p>
      ) : null}
      {notice ? (
        <p className={notice.failed ? 'error' : 'notice'} role={notice.failed ? 'alert' : 'status'}>
          {notice.text}
        </p>
      ) : null}
      <main>
        {session.paused ? (
          tab === 'table' ? (
            <TableScreen
              session={session}
              table={table}
              payment={menu?.payment}
              now={now}
              busy={busy}
              bill={bill}
              restorableOrderId={cart.length === 0 ? (savedPrepay?.orderId ?? null) : null}
              onPayVietqr={() => void payBill()}
              onCancelOrder={(orderId) => void cancelOrder(orderId)}
              onRestoreOrder={restorePrepay}
              onRequest={(kind) => void request(kind)}
            />
          ) : (
            <div className="paused-card" role="status" data-testid="paused">
              <p>{t('paused')}</p>
            </div>
          )
        ) : !menu ? (
          <p role="status">{t('loading')}</p>
        ) : item ? (
          <ItemScreen
            menu={menu}
            item={item}
            onBack={() => setItem(null)}
            onAdd={(picked) => {
              changeCart(addLine(cart, picked));
              setItem(null);
            }}
          />
        ) : tab === 'menu' ? (
          <MenuScreen menu={menu} onPick={setItem} />
        ) : tab === 'cart' ? (
          <CartScreen
            cart={cart}
            currency={menu.currency}
            canSend={ordering && waitSeconds === 0}
            waitSeconds={waitSeconds}
            sending={busy}
            payment={menu.payment}
            method={payMethod}
            onMethod={setPayMethod}
            onQuantity={(key, quantity) => changeCart(setQuantity(cart, key, quantity))}
            onSend={() => void send()}
          />
        ) : (
          <TableScreen
            session={session}
            table={table}
            payment={menu.payment}
            now={now}
            busy={busy}
            bill={bill}
            restorableOrderId={cart.length === 0 ? (savedPrepay?.orderId ?? null) : null}
            onPayVietqr={() => void payBill()}
            onCancelOrder={(orderId) => void cancelOrder(orderId)}
            onRestoreOrder={restorePrepay}
            onRequest={(kind) => void request(kind)}
          />
        )}
      </main>
      <nav className="tabs" aria-label={t('title')}>
        {(['menu', 'cart', 'table'] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-current={tab === name && !item ? 'page' : undefined}
            data-testid={`tab-${name}`}
            onClick={() => {
              setItem(null);
              setTab(name);
            }}
          >
            {t(name === 'menu' ? 'tabMenu' : name === 'cart' ? 'tabCart' : 'tabTable')}
            {name === 'cart' && count > 0 ? <span className="count"> ({count})</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
