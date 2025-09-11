// Function to get flame emojis
export const getFlames = (flameCount: number) => {
  const flames = ["🔥".repeat(flameCount)];
  return flames.join("");
};

// prettier-ignore
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Function to get current spinner frame
export const getSpinner = (spinnerIndex: number) => {
  return SPINNER_FRAMES[spinnerIndex];
};
