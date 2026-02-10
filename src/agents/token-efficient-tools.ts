import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agent/token-efficient-tools");

/**
 * The Anthropic beta header that enables token-efficient tool use encoding.
 * Reduces tool definition token usage by 5-15%. Safe to include on all Claude
 * versions (no-op on Claude 4+).
 *
 * Reference: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 */
export const TOKEN_EFFICIENT_TOOLS_BETA = "token-efficient-tools-2025-02-19";

function isAnthropicProvider(model: Model<Api> | undefined): boolean {
  if (!model) {
    return false;
  }
  return (model as { api?: unknown }).api === "anthropic-messages";
}

type ContextLike = {
  tools?: unknown[];
  [key: string]: unknown;
};

/**
 * Create a streamFn wrapper that adds the token-efficient-tools beta header
 * to all Anthropic API requests that include tool definitions.
 *
 * The header is safe to include unconditionally (no-op on Claude 4+) and
 * reduces token usage by 5-15% for tool definitions.
 */
export function createTokenEfficientToolsWrapper(streamFn: StreamFn): StreamFn {
  return (model, context, options) => {
    if (!isAnthropicProvider(model)) {
      return streamFn(model, context, options);
    }

    const ctx = context as ContextLike;
    const hasTools = Array.isArray(ctx.tools) && ctx.tools.length > 0;

    if (!hasTools) {
      return streamFn(model, context, options);
    }

    // Merge beta header with any existing betas
    const existingBetas = (options as { betas?: string[] } | undefined)?.betas ?? [];
    const betas = [...existingBetas, TOKEN_EFFICIENT_TOOLS_BETA];

    log.debug("adding token-efficient-tools beta header");

    return streamFn(model, context, {
      ...options,
      betas,
    });
  };
}
