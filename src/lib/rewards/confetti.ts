/**
 * Fire a level-up confetti animation.
 * Uses dynamic import to avoid bundling canvas-confetti in the initial load.
 */
export async function fireLevelUpConfetti(): Promise<void> {
  try {
    const confetti = (await import("canvas-confetti")).default;

    // First burst - left side
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#FFD700", "#FFA500", "#FF6347", "#7B68EE", "#00CED1"],
    });

    // Second burst - right side
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#FFD700", "#FFA500", "#FF6347", "#7B68EE", "#00CED1"],
    });

    // Delayed center burst
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors: ["#FFD700", "#FFA500", "#FF6347", "#7B68EE", "#00CED1"],
      });
    }, 250);
  } catch {
    // Silently fail — confetti is not critical
  }
}
