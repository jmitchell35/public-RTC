type WithIdAndDate = { id: string; created_at: string };

export function mergeMessages<T extends WithIdAndDate>(
    existing: T[],
    incoming: T[],
): T[] {
    const map = new Map(existing.map((message) => [message.id, message]));
    for (const message of incoming) {
        map.set(message.id, message);
    }
    return Array.from(map.values()).sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
}
