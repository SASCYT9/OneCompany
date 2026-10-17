import "server-only";

import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type FunctionCall,
  type GenerateContentResponseUsageMetadata,
  type Part,
} from "@google/genai";

import { resolveShopAiProviderApiKey } from "@/lib/shopAiProviderPolicy";
import { formatShopMoney } from "@/lib/shopMoneyFormat";

import { oneAiPriceAmount } from "./catalogQuery";
import {
  ONE_AI_TOOL_DECLARATIONS,
  executeOneAiTool,
  isOneAiPresentationTool,
  type OneAiToolSession,
} from "./catalogTools";
import { stripOneAiRefs } from "./presentation";
import { ONE_AI_SHOWN_MARKER, buildOneAiSystemPrompt } from "./systemPrompt";
import type { OneAiContext, OneAiConversationState, OneAiEvent, OneAiUsage } from "./types";

export const ONE_AI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
/** Model steps that may search; parallel searches inside one step count once. */
const MAX_RESEARCH_ROUNDS = 2;
const MAX_MODEL_CALLS = MAX_RESEARCH_ROUNDS + 2;
const MAX_CALLS_PER_RESPONSE = 6;
const MAX_OUTPUT_TOKENS = 1_600;
const MODEL_CALL_TIMEOUT_MS = 25_000;

/** USD per 1M tokens (list prices, so estimates never under-count). */
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 1.5, output: 7.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
};
const CACHED_INPUT_SHARE = 0.25;

export function resolveOneAiModel() {
  return process.env.SHOP_AI_AGENT_MODEL?.trim() || ONE_AI_DEFAULT_MODEL;
}

/** LOW by default; gemini-3.8-flash rejects MINIMAL with a 400. */
/** Optional sampling temperature (SHOP_AI_AGENT_TEMPERATURE); the model default otherwise. */
function resolveOneAiTemperature() {
  const raw = process.env.SHOP_AI_AGENT_TEMPERATURE?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : undefined;
}

function resolveOneAiThinkingLevel() {
  const value = process.env.SHOP_AI_AGENT_THINKING?.trim().toLowerCase();
  if (value === "medium") return ThinkingLevel.MEDIUM;
  if (value === "high") return ThinkingLevel.HIGH;
  return ThinkingLevel.LOW;
}

export function estimateOneAiCostUsd(
  model: string,
  usage: Pick<OneAiUsage, "inputTokens" | "cachedTokens" | "outputTokens" | "thoughtTokens">
) {
  const rates = MODEL_RATES[model] ?? { input: 1.5, output: 9 };
  const freshInput = Math.max(0, usage.inputTokens - usage.cachedTokens);
  const cost =
    (freshInput * rates.input +
      usage.cachedTokens * rates.input * CACHED_INPUT_SHARE +
      (usage.outputTokens + usage.thoughtTokens) * rates.output) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Earlier turns as plain text; shown cards ride along as a marker line the model can reuse. */
export function buildOneAiHistoryContents(
  state: OneAiConversationState,
  context: Pick<OneAiContext, "locale" | "currency">
): Content[] {
  return state.history.map((entry) => {
    if (entry.role === "user") return { role: "user", parts: [{ text: entry.text }] };
    const shown = entry.shownRefs
      .map((ref) => state.products[ref])
      .filter(Boolean)
      .map((product) => {
        const price = oneAiPriceAmount(product.priceSet, context.currency);
        return `${product.ref} ${product.brand} ${product.sku} "${product.name}" ${
          price ? formatShopMoney(context.locale, price, context.currency) : "price on request"
        } ${product.availability}`;
      });
    const text = [entry.text, shown.length ? `${ONE_AI_SHOWN_MARKER} ${shown.join("; ")}` : ""]
      .filter(Boolean)
      .join("\n\n");
    return { role: "model", parts: [{ text: text || "…" }] };
  });
}

function addUsage(total: OneAiUsage, metadata: GenerateContentResponseUsageMetadata | undefined) {
  if (!metadata) return;
  total.inputTokens += metadata.promptTokenCount ?? 0;
  total.cachedTokens += metadata.cachedContentTokenCount ?? 0;
  total.outputTokens += metadata.candidatesTokenCount ?? 0;
  total.thoughtTokens += metadata.thoughtsTokenCount ?? 0;
}

/** Drops the stray marker line if the model ever copies it into its own answer. */
function stripMarker(text: string) {
  return text.includes(ONE_AI_SHOWN_MARKER)
    ? text
        .split("\n")
        .filter((line) => !line.includes(ONE_AI_SHOWN_MARKER))
        .join("\n")
    : text;
}

async function runTool(name: string, args: unknown, session: OneAiToolSession) {
  const startedAt = performance.now();
  try {
    const result = await executeOneAiTool(name, args, session);
    if (process.env.SHOP_AI_AGENT_DEBUG === "1") {
      const summary = result as Record<string, unknown>;
      console.info(
        JSON.stringify({
          event: "one_ai_tool",
          tool: name,
          ms: Math.round(performance.now() - startedAt),
          args,
          found: summary?.found,
          relaxed: summary?.relaxed,
          error: summary?.error,
          titles: Array.isArray(summary?.products)
            ? (summary.products as Array<{ title?: string }>).slice(0, 3).map((item) => item.title)
            : undefined,
        })
      );
    }
    return result;
  } catch (error) {
    console.error("One AI tool failed", {
      tool: name,
      message: error instanceof Error ? error.message : String(error),
    });
    return { error: "The catalog is temporarily unavailable for this request." };
  }
}

const ENGLISH_WORDS =
  /\b(?:the|a|an|for|my|on|to|is|are|what|which|do|does|you|have|need|want|how|best|under|with|and|or|of|in|this|these|it|can|show|any|me|i)\b/i;

export type OneAiReplyLanguage = "uk" | "en";

/**
 * The owner's rule: Ukrainian for Ukrainian or Russian, English for English.
 * Car names and part numbers ("BMW M2 G87, 2024") carry no language, so they
 * keep the language of the conversation, or the storefront's.
 */
export function resolveOneAiReplyLanguage(
  message: string,
  previousUserMessages: string[],
  locale: OneAiContext["locale"]
): OneAiReplyLanguage {
  const decide = (text: string): OneAiReplyLanguage | null => {
    if (/[\u0400-\u04ff]/u.test(text)) return "uk";
    if (ENGLISH_WORDS.test(text)) return "en";
    return null;
  };
  const own = decide(message);
  if (own) return own;
  for (const previous of [...previousUserMessages].reverse()) {
    const earlier = decide(previous);
    if (earlier) return earlier;
  }
  return locale === "en" ? "en" : "uk";
}

/** Smaller models drift between languages; a short note next to each message keeps them on it. */
export function oneAiLanguageNote(language: OneAiReplyLanguage) {
  return language === "uk"
    ? "[system] Відповідай українською мовою, навіть якщо клієнт пише російською."
    : "[system] Answer in English.";
}

export class OneAiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneAiConfigurationError";
  }
}

export async function runOneAiTurn(input: {
  message: string;
  context: OneAiContext;
  state: OneAiConversationState;
  emit: (event: OneAiEvent) => void;
  signal?: AbortSignal;
}): Promise<{
  answer: string;
  shownRefs: string[];
  catalogHref: string | null;
  usage: OneAiUsage;
}> {
  const apiKey = resolveShopAiProviderApiKey();
  if (!apiKey) throw new OneAiConfigurationError("No Gemini API key configured");
  const model = resolveOneAiModel();
  const client = new GoogleGenAI({ apiKey });
  const startedAt = performance.now();
  const usage: OneAiUsage = {
    model,
    modelCalls: 0,
    inputTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    firstTextMs: null,
    tools: [],
  };
  const session: OneAiToolSession = {
    context: input.context,
    state: input.state,
    emit: input.emit,
    shownRefs: [],
    turnRefs: [],
    unconfirmedRefs: new Set<string>(),
    repliesShown: false,
    catalogHref: null,
  };
  const contents: Content[] = [
    ...buildOneAiHistoryContents(input.state, input.context),
    {
      role: "user",
      parts: [
        { text: input.message },
        {
          text: oneAiLanguageNote(
            resolveOneAiReplyLanguage(
              input.message,
              input.state.history.flatMap((entry) => (entry.role === "user" ? [entry.text] : [])),
              input.context.locale
            )
          ),
        },
      ],
    },
  ];
  const systemInstruction = buildOneAiSystemPrompt(input.context);
  const allTools = [{ functionDeclarations: [...ONE_AI_TOOL_DECLARATIONS] }];
  const presentationTools = [
    {
      functionDeclarations: ONE_AI_TOOL_DECLARATIONS.filter((tool) =>
        isOneAiPresentationTool(tool.name)
      ),
    },
  ];
  let answer = "";
  let researchRounds = 0;

  for (let call = 0; call < MAX_MODEL_CALLS; call += 1) {
    if (input.signal?.aborted) break;
    // Research first, then the model must answer with what it found: only the
    // presentation tools stay available, and the very last call may not call
    // tools at all, so a turn can never end without text.
    const answerOnly = researchRounds >= MAX_RESEARCH_ROUNDS;
    const finalCall = call === MAX_MODEL_CALLS - 1;
    usage.modelCalls += 1;
    const callStartedAt = performance.now();
    const stream = await client.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        tools: answerOnly && !finalCall ? presentationTools : allTools,
        // VALIDATED keeps tool arguments on the declared schema.
        toolConfig: {
          functionCallingConfig: {
            mode: finalCall ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.VALIDATED,
          },
        },
        thinkingConfig: { thinkingLevel: resolveOneAiThinkingLevel() },
        temperature: resolveOneAiTemperature(),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: input.signal,
        httpOptions: { timeout: MODEL_CALL_TIMEOUT_MS },
      },
    });

    const modelParts: Part[] = [];
    const functionCalls: FunctionCall[] = [];
    let callText = "";
    let lastUsage: GenerateContentResponseUsageMetadata | undefined;
    for await (const chunk of stream) {
      lastUsage = chunk.usageMetadata ?? lastUsage;
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.thought) continue;
        if (part.text || part.functionCall || part.thoughtSignature) modelParts.push(part);
        if (part.functionCall) functionCalls.push(part.functionCall);
        if (part.text) {
          const text = stripMarker(part.text);
          if (!text) continue;
          if (usage.firstTextMs === null) {
            usage.firstTextMs = Math.round(performance.now() - startedAt);
          }
          // A later model call continues the same bubble as a new paragraph.
          if (!callText && answer) input.emit({ type: "text", text: "\n\n" });
          callText += text;
          input.emit({ type: "text", text });
        }
      }
    }
    addUsage(usage, lastUsage);
    if (process.env.SHOP_AI_AGENT_DEBUG === "1") {
      console.info(
        JSON.stringify({
          event: "one_ai_model_call",
          call,
          ms: Math.round(performance.now() - callStartedAt),
          inputTokens: lastUsage?.promptTokenCount,
          outputTokens: lastUsage?.candidatesTokenCount,
          thoughtTokens: lastUsage?.thoughtsTokenCount,
          functionCalls: functionCalls.map((item) => item.name),
        })
      );
    }
    if (callText.trim()) answer = answer ? `${answer}\n\n${callText}` : callText;

    if (!functionCalls.length) break;
    // Guard against degenerate responses that repeat the same call many times:
    // one card set and one reply set per response, at most six calls in all.
    const seenPresentation = new Set<string>();
    const accepted = functionCalls.slice(0, MAX_CALLS_PER_RESPONSE).filter((functionCall) => {
      const name = functionCall.name ?? "";
      if (!isOneAiPresentationTool(name)) return true;
      if (seenPresentation.has(name)) return false;
      seenPresentation.add(name);
      return true;
    });
    contents.push({
      role: "model",
      parts: modelParts.filter(
        (part) => !part.functionCall || accepted.includes(part.functionCall)
      ),
    });
    const research = accepted.some(
      (functionCall) => !isOneAiPresentationTool(functionCall.name ?? "")
    );
    // Searches requested together run together; cards and replies render after them.
    const results = await Promise.all(
      accepted.map(async (functionCall) => {
        const name = functionCall.name ?? "";
        usage.tools.push(name);
        if (answerOnly && !isOneAiPresentationTool(name)) {
          return {
            error:
              "Search budget for this answer is used up. Answer now with the products you already have and offer more via quick replies.",
          };
        }
        if (isOneAiPresentationTool(name)) return null;
        return runTool(name, functionCall.args ?? {}, session);
      })
    );
    for (const [index, functionCall] of accepted.entries()) {
      const name = functionCall.name ?? "";
      if (isOneAiPresentationTool(name)) {
        results[index] = await runTool(name, functionCall.args ?? {}, session);
      }
    }
    contents.push({
      role: "user",
      parts: accepted.map((functionCall, index) => ({
        functionResponse: {
          id: functionCall.id,
          name: functionCall.name ?? "",
          response: { result: results[index] } as Record<string, unknown>,
        },
      })),
    });
    if (research) researchRounds += 1;
    // Cards and quick replies only render; the answer is complete once the
    // model has written its text alongside them.
    if (!research && answer.trim()) break;
  }

  // Smaller models often answer in text and skip the presentation tools. One
  // short forced step lets the model attach cards and quick replies to its own
  // answer; validation still limits cards to this turn's search results.
  const previousShown =
    [...input.state.history].reverse().find((entry) => entry.role === "assistant")?.shownRefs ?? [];
  const needsCards =
    !session.shownRefs.length && (session.turnRefs.length > 0 || previousShown.length > 0);
  if (answer.trim() && (needsCards || !session.repliesShown) && !input.signal?.aborted) {
    const wanted = [
      ...(needsCards ? ["show_products"] : []),
      ...(session.repliesShown ? [] : ["suggest_replies"]),
    ];
    try {
      usage.modelCalls += 1;
      const finishing = await client.models.generateContent({
        model,
        contents: [
          ...contents,
          { role: "model", parts: [{ text: answer }] },
          {
            role: "user",
            parts: [
              {
                text:
                  "[system] Finish the answer you just wrote. " +
                  (needsCards
                    ? "Call show_products with the refs of the products your answer is about (up to 6, best first; " +
                      "layout compare with rows when you compared them), " +
                      "each with a one-line reason in the customer's language; if none of the products found fits " +
                      "your answer, call it with an empty items list. "
                    : "") +
                  (session.repliesShown
                    ? ""
                    : "Call suggest_replies with 2–4 short next steps in the customer's words."),
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          tools: [
            {
              functionDeclarations: ONE_AI_TOOL_DECLARATIONS.filter((tool) =>
                wanted.includes(tool.name)
              ),
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: wanted,
            },
          },
          thinkingConfig: { thinkingLevel: resolveOneAiThinkingLevel() },
          temperature: resolveOneAiTemperature(),
          maxOutputTokens: 600,
          abortSignal: input.signal,
          httpOptions: { timeout: MODEL_CALL_TIMEOUT_MS },
        },
      });
      addUsage(usage, finishing.usageMetadata);
      const seen = new Set<string>();
      for (const call of finishing.functionCalls ?? []) {
        const name = call.name ?? "";
        if (!wanted.includes(name) || seen.has(name)) continue;
        seen.add(name);
        usage.tools.push(name);
        await runTool(name, call.args ?? {}, session);
      }
    } catch (error) {
      console.warn("One AI finishing step failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // The model can end on tool calls alone; one plain call writes the answer.
  if (!answer.trim() && !input.signal?.aborted) {
    try {
      usage.modelCalls += 1;
      const written = await client.models.generateContent({
        model,
        contents: [
          ...contents,
          {
            role: "user",
            parts: [
              {
                text:
                  "[system] Write your answer to the customer now: 2–5 sentences about the products you found, " +
                  "without calling tools.",
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          tools: allTools,
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } },
          thinkingConfig: { thinkingLevel: resolveOneAiThinkingLevel() },
          temperature: resolveOneAiTemperature(),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          abortSignal: input.signal,
          httpOptions: { timeout: MODEL_CALL_TIMEOUT_MS },
        },
      });
      addUsage(usage, written.usageMetadata);
      const text = stripMarker(written.text ?? "").trim();
      if (text) {
        if (usage.firstTextMs === null)
          usage.firstTextMs = Math.round(performance.now() - startedAt);
        answer = text;
        input.emit({ type: "text", text });
      }
    } catch (error) {
      console.warn("One AI answer recovery failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  usage.latencyMs = Math.round(performance.now() - startedAt);
  usage.costUsd = estimateOneAiCostUsd(model, usage);
  return {
    answer: stripOneAiRefs(answer).trim(),
    shownRefs: session.shownRefs,
    catalogHref: session.catalogHref,
    usage,
  };
}
