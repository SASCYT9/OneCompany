export const DASHBOARD_WINDOW_DAYS = 30;

export const DASHBOARD_ORDER_STATUS: Record<string, string> = {
  PENDING_REVIEW: "На перевірці",
  PENDING_PAYMENT: "Очікує оплату",
  CONFIRMED: "Підтверджено",
  PROCESSING: "В обробці",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено",
};

export type DashboardOverview = {
  updatedAt: string;
  windowStart: string;
  windowDays: number;
  orders: {
    counts: Record<string, number>;
    olderOpen: number;
    recent: Array<{
      id: string;
      number: string;
      customer: string;
      status: string;
      total: number;
      currency: string;
      createdAt: string;
      itemCount: number;
    }>;
  };
  customers: {
    pendingCount: number;
    pending: Array<{ id: string; name: string; company: string | null; createdAt: string }>;
  };
  catalog: {
    published: number;
    unpublished: number;
    recent: Array<{
      id: string;
      title: string;
      brand: string | null;
      updatedAt: string;
      published: boolean;
    }>;
  };
};
