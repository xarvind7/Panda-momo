import { estimateEta, tableNumsOf, tableStatus, type State } from './data';

export interface LandingLiveSummary {
  totalTables: number;
  freeTables: number;
  busyTables: number;
  availableDishes: number;
  liveEtaMin: number;
  openHelpCalls: number;
  activeKitchenOrders: number;
  tables: Array<{
    num: number;
    isFree: boolean;
    status: ReturnType<typeof tableStatus>;
  }>;
}

/**
 * Computes pure live cafe summary metrics for the Main Page
 * (Single QR showcase + Workspace Bento live indicators).
 */
export function computeLandingSummary(state: State): LandingLiveSummary {
  const nums = tableNumsOf(state);
  const tables = nums.map((num) => {
    const status = tableStatus(state, num);
    return {
      num,
      isFree: status === 'free',
      status,
    };
  });

  const freeTables = tables.filter((t) => t.isFree).length;
  const availableDishes = state.menu.filter((m) => m.available).length;
  const openHelpCalls = state.calls.filter((c) => !c.done).length;
  const activeKitchenOrders = state.orders.filter(
    (o) => !o.paid && (o.status === 'new' || o.status === 'cooking')
  ).length;

  return {
    totalTables: nums.length,
    freeTables,
    busyTables: nums.length - freeTables,
    availableDishes,
    liveEtaMin: estimateEta(state, []),
    openHelpCalls,
    activeKitchenOrders,
    tables,
  };
}

/**
 * Builds the single universal Guest Menu + Table Picker QR URL (#/m).
 */
export function buildMasterQrUrl(origin: string, pathname: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${cleanOrigin}${cleanPath}#/m`;
}
