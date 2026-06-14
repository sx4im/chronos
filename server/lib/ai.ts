import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";
import { z } from "zod";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct";
const RECIPE_MODEL = "openai/gpt-oss-120b";

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
  const cleaned = content.trim();
  // Direct parse first.
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to recovery.
  }
  // Strip ```json ... ``` fences if present.
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* keep trying */
    }
  }
  // Extract the outermost {...} object (handles reasoning preambles).
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* give up below */
    }
  }
  throw new Error("AI model returned malformed JSON");
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

const recipeRecommendationResponseSchema = z.object({
  recipes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      cookTime: z.number(),
      prepTime: z.number(),
      servings: z.number(),
      difficulty: z.enum(["Easy", "Medium", "Hard"]),
      rating: z.number().min(0).max(5),
      reviewCount: z.number(),
      tags: z.array(z.string()),
      diet: z.string().optional(),
      cuisine: z.string().optional(),
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.number(),
          unit: z.string().optional(),
        })
      ),
      instructions: z.array(
        z.object({
          step: z.number(),
          description: z.string(),
          time_min: z.number(),
        })
      ),
      nutrition: z.object({
        calories: z.number().optional(),
        protein: z.string().optional(),
        carbs: z.string().optional(),
        fat: z.string().optional(),
      }).optional(),
    })
  ),
});

export type RecipeRecommendationResponse = z.infer<typeof recipeRecommendationResponseSchema>;

export async function recommendRecipes(
  ingredients: string[],
  opts: RecipeRecommendationOptions = {},
): Promise<RecipeRecommendationResponse> {
  const params = {
    model: RECIPE_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are Ingredo's recipe recommendation engine. Recommend 3 practical recipes that prioritize the user's available ingredients. Write all text in plain prose with normal punctuation; never use em-dashes or en-dashes (use commas or periods instead). You must respond with a JSON object matching this exact schema: {\"recipes\":[{\"id\":\"string (kebab-case)\",\"title\":\"string\",\"description\":\"string\",\"cookTime\":number,\"prepTime\":number,\"servings\":number,\"difficulty\":\"Easy\"|\"Medium\"|\"Hard\",\"rating\":number (between 4.0 and 5.0),\"reviewCount\":number,\"tags\":[\"string\"],\"diet\":\"string\",\"cuisine\":\"string\",\"ingredients\":[{\"name\":\"string\",\"amount\":number,\"unit\":\"string\"}],\"instructions\":[{\"step\":number,\"description\":\"string\",\"time_min\":number}],\"nutrition\":{\"calories\":number,\"protein\":\"string\",\"carbs\":\"string\",\"fat\":\"string\"}}]}",
      },
      {
        role: "user",
        content: `Available ingredients: ${ingredients.join(", ")}. Generate 3 recipe recommendations.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 4096,
  };

  const response = await getClient().chat.completions.create(params as any, {
    signal: opts.signal,
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("AI recipe service returned an empty response");
  }

  return recipeRecommendationResponseSchema.parse(parseJsonContent(content));
}
