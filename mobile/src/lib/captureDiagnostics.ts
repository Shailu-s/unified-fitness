export function captureDiagnostic(stage: string, error: unknown) {
  const failure = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof failure?.message === 'string' ? failure.message : 'Native capture failed';
  const detail = message.replace(/(?:file|https?):\/\/[^\s'"\])]+/g, '[resource]')
    .replace(/\/(?:private\/var|var|Users|data|storage)\/[^\s'"\])]+/g, '[path]').slice(0, 240);
  return { stage, name: typeof failure?.name === 'string' ? failure.name : 'Error',
    code: typeof failure?.code === 'string' || typeof failure?.code === 'number' ? String(failure.code) : null, detail };
}
