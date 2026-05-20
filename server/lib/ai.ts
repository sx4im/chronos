import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import { z } from "zod";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct";
const RECIPE_MODEL = "deepseek-ai/deepseek-v4-flash";

const ingredientExtractionSchema = z.object({
  ingredients: z.array(z.string().trim().min(1)).min(1).max(50),
  confidence: z.number().min(0).max(1),
});

export type IngredientExtraction = z.infer<typeof ingredientExtractionSchema>;

interface RecipeRecommendationOptions {
  signal?: AbortSignal;
}

type NvidiaStreamingParams = ChatCompletionCreateParamsStreaming & {
  extra_body: {
    chat_template_kwargs: {
      thinking: true;
      reasoning_effort: "high";
    };
  };
};

let client: OpenAI | null = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is required");
  }

  client = new OpenAI({
    apiKey,
    baseURL: NVIDIA_BASE_URL,
  });

  return client;
}

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Vision model returned malformed JSON");
  }
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function extractIngredientsFromImage(imageUrlOrBase64: string): Promise<IngredientExtraction> {
  const params: ChatCompletionCreateParamsNonStreaming = {
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrlOrBase64 },
          },
          {
            type: "text",
            text:
              "Extract the visible edible ingredients from this image. Return only JSON matching this exact shape: {\"ingredients\":[\"ingredient name\"],\"confidence\":0.0}. The confidence must be a number from 0 to 1 for the overall extraction.",
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 512,
  };

  const response = await getClient().chat.completions.create(params);
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("Vision model returned an empty response");
  }

  return ingredientExtractionSchema.parse(parseJsonContent(content));
}

export async function* recommendRecipes(
  ingredients: string[],
  opts: RecipeRecommendationOptions = {},
): AsyncIterable<string> {
  const params: NvidiaStreamingParams = {
    model: RECIPE_MODEL,
    stream: true,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content:
          "You are Ingredo's recipe recommendation engine. Recommend practical recipes from the user's ingredients. Keep the response user-facing only: names, ingredient usage, substitutions when useful, and concise steps.",
      },
      {
        role: "user",
        content: `Available ingredients: ${ingredients.join(", ")}. Generate recipe recommendations that prioritize these ingredients.`,
      },
    ],
    extra_body: {
      chat_template_kwargs: {
        thinking: true,
        reasoning_effort: "high",
      },
    },
  };

  const stream = await getClient().chat.completions.create(params, {
    signal: opts.signal,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    const deltaRecord = delta as Record<string, unknown>;
    const reasoning = optionalString(deltaRecord, "reasoning") ?? optionalString(deltaRecord, "reasoning_content");
    if (reasoning && process.env.NODE_ENV !== "production") {
      console.debug("NVIDIA reasoning chunk:", reasoning);
    }

    if (typeof delta.content === "string" && delta.content.length > 0) {
      yield delta.content;
    }
  }
}
