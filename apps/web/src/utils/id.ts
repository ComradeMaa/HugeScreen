let counter = 0;

/** 生成简短唯一 ID */
export function generateId(): string {
  counter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  const count = counter.toString(36);
  return `${timestamp}-${random}-${count}`;
}
