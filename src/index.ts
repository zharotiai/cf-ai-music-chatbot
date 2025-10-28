/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

// Music recommender system prompt (used when client requests persona: 'music')
const MUSIC_SYSTEM_PROMPT = `You are an expert music recommender assistant. When the user asks for music suggestions, prioritize understanding their mood, genres, artists, tempo, and use-cases (e.g. workout, study, chill, party). Offer short curated recommendations (3-7 items) with a 1-2 sentence reason for each. When appropriate, include metadata for each suggestion such as artist, genres, tempo (bpm), and an energy descriptor (low/medium/high). Ask a single clarifying question if the user's input is ambiguous. Prefer concise, list-style responses and, when asked, return machine-readable JSON if the client requests it.`;

export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }

      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse JSON request body
    // Parse body and support optional persona or custom system prompt
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      persona?: string; // e.g. 'music'
      system?: string; // optional custom system prompt
    };

    const incoming = body.messages ?? [];

    // Determine which system prompt to inject (if no system message supplied)
    let systemToUse = SYSTEM_PROMPT;
    if (body.persona === "music") systemToUse = MUSIC_SYSTEM_PROMPT;
    if (body.system && typeof body.system === "string") systemToUse = body.system;

    // Add system prompt if not already present in messages
    if (!incoming.some((msg) => msg.role === "system")) {
      incoming.unshift({ role: "system", content: systemToUse });
    }

    const messages = incoming;

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
        // Uncomment to use AI Gateway
        // gateway: {
        //   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
        //   skipCache: false,      // Set to true to bypass cache
        //   cacheTtl: 3600,        // Cache time-to-live in seconds
        // },
      },
    );

    // Return streaming response
    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
