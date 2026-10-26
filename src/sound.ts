type Sound = "move" | "capture" | "check";
const sounds = new Map<Sound, HTMLAudioElement>();
export function playSound(kind: Sound): void {
  let sound = sounds.get(kind);
  if (!sound) {
    sound = new Audio(`/sounds/${kind}.wav`);
    sounds.set(kind, sound);
  }
  sound.currentTime = 0;
  // Browser audio policy or an unavailable device must never interrupt a move.
  void sound.play().catch(() => {});
}
