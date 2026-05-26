export type AiRuntimeErrorCode = "connection" | "model_missing" | "invalid_response" | "validation_failed" | "timeout";

export class AiRuntimeError extends Error {
  code: AiRuntimeErrorCode;

  constructor(code: AiRuntimeErrorCode, message: string) {
    super(message);
    this.name = "AiRuntimeError";
    this.code = code;
  }
}
