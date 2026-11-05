// Only an invalidation marker crosses windows. Each view reads its own authorized data.
export const personWriteEvent = "geneai:person-write";
export const personWriteKey = (userId: string) => `geneai:person-write:${userId}`;

export function announcePersonWrite(userId: string) {
  window.dispatchEvent(new CustomEvent(personWriteEvent, { detail: userId }));
  try {
    localStorage.setItem(personWriteKey(userId), crypto.randomUUID());
  } catch { /* Realtime still reaches other devices when storage is unavailable. */ }
}
