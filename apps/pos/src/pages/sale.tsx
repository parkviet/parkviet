import { sellingLayoutOf } from '@parkviet/pos-shared/pos-modules';
import { useRef } from 'react';
import { usePosSelection } from '../components/pos-selection';
import { PrintQueueAlert } from '../components/print-queue-panel';
import { QuickCounterScreen } from '../components/quick-counter/quick-counter-screen';
import { TableServiceScreen } from '../components/table-service/table-service-screen';
import { WorkspaceTabs } from '../components/workspace-tabs';
import { useSellingLayout } from '../hooks/use-selling-layout';

export function SalePage() {
  const { context } = usePosSelection();
  // What the device lays out: its own choice, else the branch's default, else
  // what the modules point at. It only decides how the panels of the screen
  // sit; the screen itself (and so every rule of selling) comes from the
  // modules below.
  const control = useSellingLayout();
  // The layout is known once the context is: nothing is drawn before the
  // first one arrives, and a reload of the context (another branch) keeps
  // the layout already shown until the new one says otherwise.
  const shown = useRef<ReturnType<typeof sellingLayoutOf> | null>(null);
  if (context.data) shown.current = sellingLayoutOf(context.data);
  const layout = shown.current ?? (context.isLoading ? null : sellingLayoutOf(context.data));
  return (
    <>
      {layout === 'table_service' ? (
        <TableServiceScreen control={control} />
      ) : layout === 'quick_counter' ? (
        <QuickCounterScreen control={control} />
      ) : layout === 'counter' ? (
        <WorkspaceTabs control={control} />
      ) : null}
      <PrintQueueAlert />
    </>
  );
}
