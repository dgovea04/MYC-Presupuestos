import type { z } from "zod";

import type { KhipuAssembledContext } from "@/lib/ai/context/assembled-context";
import type { AiProviderRequest, KhipuAiTask } from "@/lib/ai/gateway/types";
import type { AiMessage } from "@/lib/ai/types";

export type KhipuSkillId =
  | "skill-apu"
  | "skill-budget"
  | "skill-metrados"
  | "skill-formula-polinomica"
  | "skill-risk"
  | "skill-pdf-import"
  | "skill-catalog"
  | "skill-chat"
  | "skill-autocomplete";

export type SkillMessageInput = {
  task: KhipuAiTask;
  payload: Record<string, unknown>;
  assembledContext: KhipuAssembledContext;
};

export type KhipuSkill = {
  id: KhipuSkillId;
  tasks: KhipuAiTask[];
  schemaName?: string;
  schema?: z.ZodType<unknown>;
  buildMessages(input: SkillMessageInput): AiMessage[];
};

export type BuildSkillProviderRequestInput = SkillMessageInput & {
  userId: string;
};

export type BuildSkillProviderRequestResult = AiProviderRequest;
