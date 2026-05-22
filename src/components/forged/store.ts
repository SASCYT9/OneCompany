"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { LEGAL_VERSION_TAG, makeDefaultConfig, type ForgedConfig } from "@/lib/forged/configSchema";

/**
 * Configurator state. Persisted to localStorage so a customer can walk
 * away and resume — high-ticket configurators where users return after
 * checking with a partner are the norm; losing state is a sale killer.
 *
 * The persisted shape is a subset of the store (just `config`); the
 * `step`, `submitting`, and other ephemerals are derived per session.
 */

export type WizardStep = 0 | 1 | 2 | 3 | 4;

type ForgedStore = {
  /** Active configuration. */
  config: ForgedConfig;
  /** Wizard step on mobile. Desktop ignores this and shows everything. */
  step: WizardStep;
  /** True once the user has set a designSlug. */
  designChosen: boolean;
  /** Customer contact, populated only at submit time. */
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Submit lifecycle. */
  submitting: boolean;
  submitError: string | null;
  submittedQuoteToken: string | null;

  /** Actions — set partial config (merges). */
  setConfig: (patch: Partial<ForgedConfig>) => void;
  setDesign: (designSlug: string) => void;
  setStep: (step: WizardStep) => void;
  setCustomer: (patch: { name?: string; email?: string; phone?: string }) => void;
  acceptReplicaConsent: () => void;
  clearReplicaConsent: () => void;
  setSubmitting: (submitting: boolean) => void;
  setSubmitError: (error: string | null) => void;
  setSubmittedQuoteToken: (token: string | null) => void;
  reset: (designSlug: string) => void;
};

const STORAGE_KEY = "forgedConfigDraftV1";

export const useForgedConfig = create<ForgedStore>()(
  persist(
    (set) => ({
      config: makeDefaultConfig("oc-p101sc"),
      step: 0,
      designChosen: false,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      submitting: false,
      submitError: null,
      submittedQuoteToken: null,

      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      setDesign: (designSlug) =>
        set((s) => ({
          config: { ...s.config, designSlug },
          designChosen: true,
        })),

      setStep: (step) => set({ step }),

      setCustomer: ({ name, email, phone }) =>
        set((s) => ({
          customerName: name ?? s.customerName,
          customerEmail: email ?? s.customerEmail,
          customerPhone: phone ?? s.customerPhone,
        })),

      acceptReplicaConsent: () =>
        set((s) => ({
          config: {
            ...s.config,
            replicaConsent: {
              acceptedAt: new Date().toISOString(),
              legalVersionTag: LEGAL_VERSION_TAG,
            },
          },
        })),

      clearReplicaConsent: () =>
        set((s) => {
          const { replicaConsent: _omit, ...rest } = s.config;
          return { config: rest as ForgedConfig };
        }),

      setSubmitting: (submitting) => set({ submitting, submitError: null }),
      setSubmitError: (error) => set({ submitError: error, submitting: false }),
      setSubmittedQuoteToken: (token) => set({ submittedQuoteToken: token }),

      reset: (designSlug) =>
        set({
          config: makeDefaultConfig(designSlug),
          step: 0,
          designChosen: false,
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          submitting: false,
          submitError: null,
          submittedQuoteToken: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the configuration itself — don't restore submit
      // state, errors, or step across sessions.
      partialize: (s) =>
        ({
          config: s.config,
          designChosen: s.designChosen,
          customerName: s.customerName,
          customerEmail: s.customerEmail,
          customerPhone: s.customerPhone,
        }) as Partial<ForgedStore>,
    }
  )
);
