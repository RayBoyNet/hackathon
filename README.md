# Monkey Climb 

![]("/images/Monkey Climb Thumbnail.PNG")

Welcome to Monkey Climb — a small, AI-generated vertical platformer built with Next.js and TypeScript. The game runs in the browser using a canvas-based renderer. The objective is to climb as high as possible, collect items, unlock a double-jump power-up, and reach the flag to win.

This README explains how to run the project locally, how to play, available settings, and troubleshooting tips.

## Quick start

Install dependencies and start the development server:

```powershell
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

To build for production:

```powershell
npm run build
npm run start
```

Note: this project uses Tailwind CSS and the Next.js app directory. Node.js (16+) is recommended.

## How to play

- Objective: Climb upward by jumping from platform to platform and reach the goal flag at the top.
- Collect coins and other collectibles to increase your score. A hidden orb gives you the double-jump ability.
- Avoid enemies — touching an enemy or falling off-screen will reset your position.
- Once you reach the flag, the game ends in a Victory screen with your score.

Gameplay mechanics

- Movement: simple physics with gravity and horizontal movement.
- Jumping: a single jump is available by default. Finding the hidden orb unlocks a permanent double-jump for that run.
- Moving platforms: some platforms move horizontally and can help or hinder your climb.

Tips

- Use short horizontal taps to adjust position on moving platforms.
- Watch for question-mark indicators on platforms — they hide the orb or other surprises.

## Controls

- Keyboard:
  - Move left: Arrow Left or A
  - Move right: Arrow Right or D
  - Jump: Space, Arrow Up, or W
  - Menu / Pause: click Menu in the UI

The on-screen arcade D-pad and action buttons visually reflect current key presses.

## Settings (in-game)

Open the Settings screen from the main menu to configure the following:

- Character: choose between the Monkey or Block avatar (visual only).
- Difficulty: Easy / Medium / Hard — controls level generation (number of platforms, gaps, moving platforms).
- Theme: Forest, Cave, Desert, Snow — changes background and platform colors.
- Sound Effects: toggle simple procedural sound effects (Web Audio Oscillator) on/off.

Settings notes

- Difficulty affects procedural generation (platform count, gap sizes, moving platforms). Hard increases challenge.
- Sound uses the Web Audio API. Some browsers require user interaction to enable audio — toggle sound in Settings and try playing to allow the AudioContext to start.

## UI elements

- Main Menu: Play Game, Settings, Quit.
- Settings: change character, difficulty, theme, and sound.
- In-game HUD (sidebar): Score, Height (meters), character selector shortcut, and the Agent Log (shows level-generation messages).
- Victory modal: appears when you reach the flag with score and Play Again.

## Development & troubleshooting

- Project structure: the main game component is `src/app/ClimbingMonkey.tsx` and the page entry is `src/app/page.tsx`.
- If the canvas is blank:
  - Make sure the dev server is running and the page is loaded at http://localhost:3000.
  - Check the browser console for errors (especially around Web Audio or canvas context creation).
- Audio troubles:
  - Web Audio may be blocked until a user gesture occurs in some browsers. Toggle Sound Effects in the Settings or press Play to allow audio.
  - If AudioContext fails to initialize, sound is silently disabled and gameplay continues normally.

## Contributing

If you'd like to contribute improvements (gameplay, UI polish, or tests):

1. Fork the repository and create a feature branch.
2. Make changes and run the app locally to verify behavior.
3. Open a pull request with a clear description and screenshots or recordings if UI changes are involved.

Some suggested improvements:

- Add touch controls for mobile playability.
- Improve audio assets (replace procedural tones with short samples).
- Add unit/integration tests for level generation and physics.

## License

This project is provided as-is for demo and hackathon purposes. Modify and use the code as you like.
