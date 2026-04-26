import { Resend } from 'resend';

import { prisma } from '@/lib/prisma';

/**
 * Email Automation Engine — fire triggers, evaluate rules, render templates, dispatch via Resend.
 *
 * Flow:
 *   1. Application code calls fireEmailTrigger(trigger, context)
 *   2. Engine loads matching active rules with template
 *   3. Each rule's conditions are evaluated against the context
 *   4. Matching rule → render template (variable interpolation) → send via Resend
 *   5. Every attempt is recorded in ShopEmailSendLog
 *
 * Templates use {{variable}} interpolation. Variables come from the trigger context.
 *
 * Rules can short-circuit: if no active rule matches a trigger, no email is sent.
 */

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const FROM_EMAIL = process.env.EMAIL_FROM || 'info@onecompany.global';

export type EmailTrigger =
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_STUCK_PENDING_PAYMENT_3D'
  | 'ORDER_STUCK_PROCESSING_5D'
  | 'CART_ABANDONED_24H'
  | 'B2B_APPLICATION_SUBMITTED'
  | 'B2B_APPROVED'
  | 'B2B_REJECTED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REFUNDED'
  | 'QUOTE_SENT'
  | 'QUOTE_EXPIRING_24H'
  | 'CUSTOMER_REGISTERED'
  | 'PASSWORD_RESET';

export type TriggerContext = {
  recipient: string;
  customerGroup?: string;
  currency?: string;
  orderTotal?: number;
  entityType?: string;
  entityId?: string;
  variables: Record<string, string | number | null | undefined>;
};

type RuleConditions = {
  customerGroup?: string[];
  minOrderValue?: number;
  currency?: string[];
};

type RuleRow = {
  id: string;
  name: string;
  trigger: EmailTrigger;
  conditions: RuleConditions | null;
  isActive: boolean;
  template: {
    id: string;
    key: string;
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
    locale: string;
  };
};

/**
 * Render a template with variable interpolation.
 * Replaces {{key}} with context.variables[key]. Missing keys render as empty string.
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = variables[key];
    if (v == null) return '';
    return String(v);
  });
}

function matchesConditions(conditions: RuleConditions | null, ctx: TriggerContext): boolean {
  if (!conditions) return true;

  if (conditions.customerGroup && conditions.customerGroup.length > 0) {
    if (!ctx.customerGroup || !conditions.customerGroup.includes(ctx.customerGroup)) return false;
  }

  if (conditions.minOrderValue != null) {
    if (ctx.orderTotal == null || ctx.orderTotal < conditions.minOrderValue) return false;
  }

  if (conditions.currency && conditions.currency.length > 0) {
    if (!ctx.currency || !conditions.currency.includes(ctx.currency)) return false;
  }

  return true;
}

/**
 * Fire a trigger. Loads active rules, evaluates conditions, dispatches matching emails.
 * Returns count of dispatched emails (0 if no rule matched or all skipped).
 */
export async function fireEmailTrigger(trigger: EmailTrigger, ctx: TriggerContext): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = (await (prisma as any).shopEmailRule.findMany({
    where: { trigger, isActive: true },
    include: { template: true },
  })) as RuleRow[];

  if (rules.length === 0) return 0;

  let dispatched = 0;
  for (const rule of rules) {
    if (!matchesConditions(rule.conditions, ctx)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopEmailSendLog.create({
        data: {
          ruleId: rule.id,
          trigger,
          recipient: ctx.recipient,
          subject: rule.template.subject,
          templateKey: rule.template.key,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          status: 'SKIPPED',
          metadata: { reason: 'Conditions not met' },
        },
      });
      continue;
    }

    const subject = renderTemplate(rule.template.subject, ctx.variables);
    const html = renderTemplate(rule.template.bodyHtml, ctx.variables);
    const text = rule.template.bodyText ? renderTemplate(rule.template.bodyText, ctx.variables) : undefined;

    if (!resend) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopEmailSendLog.create({
        data: {
          ruleId: rule.id,
          trigger,
          recipient: ctx.recipient,
          subject,
          templateKey: rule.template.key,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          status: 'FAILED',
          errorMessage: 'Resend not configured',
        },
      });
      continue;
    }

    try {
      const response = await resend.emails.send({
        from: FROM_EMAIL,
        to: [ctx.recipient],
        subject,
        html,
        ...(text ? { text } : {}),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopEmailSendLog.create({
        data: {
          ruleId: rule.id,
          trigger,
          recipient: ctx.recipient,
          subject,
          templateKey: rule.template.key,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          status: response.error ? 'FAILED' : 'SENT',
          errorMessage: response.error ? String(response.error) : null,
          sentAt: response.error ? null : new Date(),
          metadata: { resendId: response.data?.id },
        },
      });
      if (!response.error) dispatched++;
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopEmailSendLog.create({
        data: {
          ruleId: rule.id,
          trigger,
          recipient: ctx.recipient,
          subject,
          templateKey: rule.template.key,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          status: 'FAILED',
          errorMessage: (e as Error).message || String(e),
        },
      });
    }
  }

  return dispatched;
}

/**
 * Find all orders that have been PENDING_PAYMENT for >= N days and fire trigger.
 * Designed to be called from a Vercel cron route once per day.
 */
export async function fireStuckOrderTriggers(): Promise<{ stuckPayment: number; stuckProcessing: number }> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const stuckPayments = await prisma.shopOrder.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      createdAt: { lte: threeDaysAgo },
    },
    take: 500,
  });

  let stuckPaymentCount = 0;
  for (const order of stuckPayments) {
    // Avoid duplicate sends within the last 24h
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastLog = await (prisma as any).shopEmailSendLog.findFirst({
      where: {
        trigger: 'ORDER_STUCK_PENDING_PAYMENT_3D',
        entityId: order.id,
        sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (lastLog) continue;

    const sent = await fireEmailTrigger('ORDER_STUCK_PENDING_PAYMENT_3D', {
      recipient: order.email,
      customerGroup: order.customerGroupSnapshot,
      currency: order.currency,
      orderTotal: Number(order.total),
      entityType: 'shop.order',
      entityId: order.id,
      variables: {
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        total: Number(order.total).toFixed(2),
        currency: order.currency,
        daysStuck: '3',
      },
    });
    if (sent > 0) stuckPaymentCount++;
  }

  const stuckProcessing = await prisma.shopOrder.findMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lte: fiveDaysAgo },
    },
    take: 500,
  });

  let stuckProcessingCount = 0;
  for (const order of stuckProcessing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastLog = await (prisma as any).shopEmailSendLog.findFirst({
      where: {
        trigger: 'ORDER_STUCK_PROCESSING_5D',
        entityId: order.id,
        sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (lastLog) continue;

    const sent = await fireEmailTrigger('ORDER_STUCK_PROCESSING_5D', {
      recipient: order.email,
      customerGroup: order.customerGroupSnapshot,
      currency: order.currency,
      orderTotal: Number(order.total),
      entityType: 'shop.order',
      entityId: order.id,
      variables: {
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        total: Number(order.total).toFixed(2),
        currency: order.currency,
        daysStuck: '5',
      },
    });
    if (sent > 0) stuckProcessingCount++;
  }

  return { stuckPayment: stuckPaymentCount, stuckProcessing: stuckProcessingCount };
}
