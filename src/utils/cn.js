export function cn(...parts) {
  return parts
    .flatMap((part) => {
      if (!part) return [];
      if (Array.isArray(part)) return part;
      return [part];
    })
    .filter(Boolean)
    .join(' ');
}

