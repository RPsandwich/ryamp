export const pickRandomIndex = (queueLength: number, excludeIndex: number): number => {
  if (queueLength <= 1) return excludeIndex;
  let idx = Math.floor(Math.random() * queueLength);
  while (idx === excludeIndex) {
    idx = Math.floor(Math.random() * queueLength);
  }
  return idx;
};

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
