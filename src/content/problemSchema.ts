import { z } from "zod";

/** JSON-serializable value (test case args / expected values). */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

/**
 * Parameter / return types the harness generators understand.
 * ListNode is encoded in JSON as int[]; TreeNode as (int|null)[] in level order.
 */
export const typeSpec = z.enum([
  "int",
  "float",
  "bool",
  "string",
  "int[]",
  "int[][]",
  "float[]",
  "bool[]",
  "string[]",
  "ListNode",
  "TreeNode",
]);
export type TypeSpec = z.infer<typeof typeSpec>;

export const testCase = z.object({
  id: z.string().min(1),
  args: z.array(jsonValue),
  expected: jsonValue,
  kind: z.enum(["example", "typical", "edge"]).default("typical"),
  note: z.string().optional(),
});
export type TestCase = z.infer<typeof testCase>;

export const LANGUAGES = ["python", "javascript"] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

export const comparisonSpec = z
  .object({
    mode: z.enum(["exact", "unordered", "float-tolerance"]).default("exact"),
    floatTolerance: z.number().positive().optional(),
  })
  .default({ mode: "exact" });

export const codingProblem = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  statement: z.object({
    markdown: z.string().min(1),
    constraints: z.array(z.string()),
    examples: z.array(
      z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string().optional(),
      }),
    ),
  }),
  signature: z.object({
    /** snake_case; generators adapt casing per language. */
    functionName: z.string().regex(/^[a-z][a-z0-9_]*$/),
    params: z.array(z.object({ name: z.string(), type: typeSpec })),
    returns: typeSpec,
  }),
  comparison: comparisonSpec,
  tests: z.array(testCase).min(8),
  starters: z.record(languageSchema, z.string()),
  hints: z.array(z.string()).min(2).max(4),
  solution: z.record(languageSchema, z.string()),
  solutionExplanation: z.string().min(1),
  relatedLessonSlug: z.string().optional(),
});
export type CodingProblem = z.infer<typeof codingProblem>;
