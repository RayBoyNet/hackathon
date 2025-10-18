'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Zap } from 'lucide-react';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type Difficulty = 'easy' | 'medium' | 'hard';
type ThemeKey = 'forest' | 'cave' | 'desert' | 'snow';

type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  moving?: boolean;
  startX?: number;
  moveRange?: number;
  moveSpeed?: number;
  moveDirection?: number;
  hasHiddenOrb?: boolean;
};

type Enemy = {
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
};
type Collectible = {
  x: number;
  y: number;
  w: number;
  h: number;
  collected: boolean;
  type?: string;
};
type Orb = {
  platformIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  unlocked: boolean;
  collected: boolean;
};

type Level = {
  platforms: Platform[];
  enemies: Enemy[];
  collectibles: Collectible[];
  hiddenOrbs: Orb[];
} | null;

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  hasDoubleJump: boolean;
  canDoubleJump: boolean;
};

type GameRefType = {
  player: Player;
  level: Level;
  keys: Record<string, boolean>;
  score: number;
  animationId: number | null;
  cameraY: number;
  audioContext: AudioContext | null;
  sounds: Record<string, AudioBuffer | null>;
  playSound?: (type: string) => void;
};

const PlatformerAgent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'victory'>(
    'menu'
  );
  const [agentThinking, setAgentThinking] = useState<boolean>(false);
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [theme, setTheme] = useState<ThemeKey>('forest');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [character, setCharacter] = useState<'monkey' | 'block'>('monkey');

  const gameRef = useRef<GameRefType>({
    player: {
      x: 50,
      y: 300,
      vx: 0,
      vy: 0,
      w: 20,
      h: 30,
      grounded: false,
      hasDoubleJump: false,
      canDoubleJump: false,
    },
    level: null,
    keys: {},
    score: 0,
    animationId: null,
    cameraY: 0,
    audioContext: null,
    sounds: {},
  });

  const themes = React.useMemo(
    () => ({
      forest: { bg: '#87CEEB', platform: '#8B4513', accent: '#228B22' },
      cave: { bg: '#2C3E50', platform: '#34495E', accent: '#95A5A6' },
      desert: { bg: '#F4A460', platform: '#D2691E', accent: '#FFD700' },
      snow: { bg: '#B0E0E6', platform: '#FFFFFF', accent: '#4682B4' },
    }),
    []
  );

  const addLog = (message: string) => {
    setAgentLog((prev) => [...prev.slice(-4), `[Agent] ${message}`]);
  };

  const generateLevel = () => {
    setAgentThinking(true);
    addLog(`Initializing level generation...`);

    if (!gameRef.current.audioContext) {
      try {
        // Prefer standard AudioContext; support older webkit prefix via declaration above
        const Ctx = window.AudioContext || window.webkitAudioContext;
        gameRef.current.audioContext = new Ctx();
        setSoundEnabled(true);
      } catch {
        console.log('Audio not supported');
      }
    }

    setTimeout(() => {
      addLog(`Selected theme: ${theme}, difficulty: ${difficulty}`);

      const platforms = [];
      const enemies = [];
      const collectibles = [];
      const hiddenOrbs = [];

      platforms.push({ x: 0, y: 450, w: 800, h: 50, type: 'ground' });

      const difficultySettings = {
        easy: {
          platformCount: 20,
          maxHorizontalGap: 160,
          minVerticalGap: 60,
          maxVerticalGap: 90,
          movingPlatforms: 2,
        },
        medium: {
          platformCount: 25,
          maxHorizontalGap: 180,
          minVerticalGap: 70,
          maxVerticalGap: 100,
          movingPlatforms: 4,
        },
        hard: {
          platformCount: 30,
          maxHorizontalGap: 200,
          minVerticalGap: 75,
          maxVerticalGap: 110,
          movingPlatforms: 6,
        },
      };

      const settings = difficultySettings[difficulty];
      addLog(
        `Generating solvable climbing path with ${settings.platformCount} platforms...`
      );
      addLog(
        `Difficulty: ${difficulty} = longer climb + wider gaps + more moving platforms`
      );

      const JUMP_POWER = 13;
      const GRAVITY = 0.6;
      const maxJumpHeight = (JUMP_POWER * JUMP_POWER) / (2 * GRAVITY);
      const safeMaxVerticalGap = maxJumpHeight * 0.75;

      addLog(`Max safe jump height: ${Math.floor(safeMaxVerticalGap)} pixels`);

      let x = 150;
      let y = 400;
      const movingPlatformIndices = [];

      for (let i = 0; i < settings.platformCount; i++) {
        const w = 90 + Math.random() * 50;

        const shouldMove =
          i > 2 &&
          i < settings.platformCount - 2 &&
          movingPlatformIndices.length < settings.movingPlatforms &&
          i % Math.floor(settings.platformCount / settings.movingPlatforms) ===
            0;

        const platform = {
          x,
          y,
          w,
          h: 20,
          type: 'platform',
          moving: shouldMove,
          startX: x,
          moveRange: shouldMove ? 100 : 0,
          moveSpeed: shouldMove ? 1.2 : 0,
          moveDirection: 1,
          hasHiddenOrb: false,
        };

        platforms.push(platform);

        if (
          i === Math.floor(settings.platformCount * 0.3) &&
          hiddenOrbs.length === 0
        ) {
          platform.hasHiddenOrb = true;
          hiddenOrbs.push({
            platformIndex: platforms.length - 1,
            x: x + w / 2 - 10,
            y: y - 10,
            w: 20,
            h: 20,
            unlocked: false,
            collected: false,
          });
        }

        if (shouldMove) {
          movingPlatformIndices.push(i);
        }

        if (Math.random() > 0.7) {
          collectibles.push({
            x: x + w / 2 - 8,
            y: y - 35,
            w: 16,
            h: 16,
            collected: false,
          });
        }

        const verticalGap = Math.min(
          settings.minVerticalGap +
            Math.random() * (settings.maxVerticalGap - settings.minVerticalGap),
          safeMaxVerticalGap
        );
        y -= verticalGap;

        const direction = Math.random() > 0.5 ? 1 : -1;
        const horizontalMove =
          60 + Math.random() * (settings.maxHorizontalGap - 60);
        x += direction * horizontalMove;

        x = Math.max(80, Math.min(x, 720 - w));
      }

      addLog(`Created ${movingPlatformIndices.length} moving platforms`);
      addLog(`Hidden double-jump orb placed!`);

      const finalVerticalGap = 50;

      const flagPlatform = {
        x: x,
        y: y - finalVerticalGap,
        w: 150,
        h: 20,
        type: 'goal',
        moving: false,
        moveRange: 0,
        moveSpeed: 0,
        moveDirection: 1,
        hasHiddenOrb: false,
      };
      platforms.push(flagPlatform);

      addLog(
        `Final platform height gap: ${finalVerticalGap}px (Max jump: ~140px)`
      );

      collectibles.push({
        x: flagPlatform.x + flagPlatform.w / 2 - 15,
        y: flagPlatform.y - 60,
        w: 30,
        h: 60,
        type: 'flag',
        collected: false,
      });

      addLog(`Placing 2 enemies strategically...`);

      const totalPlatforms = platforms.length - 2;
      if (totalPlatforms > 5) {
        const enemy1Index = Math.floor(totalPlatforms * 0.4) + 1;
        const enemy2Index = Math.floor(totalPlatforms * 0.7) + 1;

        const enemy1Platform = platforms[enemy1Index];
        const enemy2Platform = platforms[enemy2Index];

        enemies.push({
          x: enemy1Platform.x + 20,
          y: enemy1Platform.y - 25,
          vx: 1.5,
          w: 25,
          h: 25,
          minX: enemy1Platform.x,
          maxX: enemy1Platform.x + enemy1Platform.w - 25,
        });

        enemies.push({
          x: enemy2Platform.x + 20,
          y: enemy2Platform.y - 25,
          vx: 1.5,
          w: 25,
          h: 25,
          minX: enemy2Platform.x,
          maxX: enemy2Platform.x + enemy2Platform.w - 25,
        });
      }

      addLog(`Level generation complete! Starting game...`);
      gameRef.current.level = { platforms, enemies, collectibles, hiddenOrbs };
      gameRef.current.player = {
        x: 50,
        y: 300,
        vx: 0,
        vy: 0,
        w: 20,
        h: 30,
        grounded: false,
        hasDoubleJump: false,
        canDoubleJump: false,
      };
      gameRef.current.score = 0;
      gameRef.current.cameraY = 0;
      setGameState('playing');
      setAgentThinking(false);
    }, 1500);
  };

  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameRef.current.animationId) {
        cancelAnimationFrame(gameRef.current.animationId);
        gameRef.current.animationId = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const game = gameRef.current;

    const playSound = (type: string) => {
      if (!soundEnabled || !game.audioContext) return;

      const audioCtx = game.audioContext as AudioContext;

      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      switch (type) {
        case 'jump':
          oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(
            600,
            audioCtx.currentTime + 0.1
          );
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.1
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.1);
          break;

        case 'doubleJump':
          oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(
            800,
            audioCtx.currentTime + 0.15
          );
          gainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.15
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.15);
          break;

        case 'coin':
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
          oscillator.frequency.setValueAtTime(
            1000,
            audioCtx.currentTime + 0.05
          );
          gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.1
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.1);
          break;

        case 'orb':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(
            1000,
            audioCtx.currentTime + 0.3
          );
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.3
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.3);
          break;

        case 'hit':
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(
            50,
            audioCtx.currentTime + 0.2
          );
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.2
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.2);
          break;

        case 'unlock':
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.05);
          oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.15
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.15);
          break;

        case 'victory':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(523, audioCtx.currentTime);
          oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.15);
          oscillator.frequency.setValueAtTime(784, audioCtx.currentTime + 0.3);
          oscillator.frequency.setValueAtTime(
            1047,
            audioCtx.currentTime + 0.45
          );
          gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioCtx.currentTime + 0.6
          );
          oscillator.start(audioCtx.currentTime);
          oscillator.stop(audioCtx.currentTime + 0.6);
          break;
      }
    };

    game.playSound = playSound;

    const handleKeyDown = (e: KeyboardEvent) => {
      game.keys[e.key] = true;
      e.preventDefault();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      game.keys[e.key] = false;
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const GRAVITY = 0.6;
    const MOVE_SPEED = 6;
    const JUMP_POWER = 13;
    const AIR_CONTROL = 0.8;
    const FRICTION = 0.85;

    let lastTime = Date.now();
    let isRunning = true;

    const gameLoop = () => {
      if (!isRunning) return;

      const now = Date.now();
      const dt = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;

      const player = game.player;
      const level = game.level;

      const moveLeft = game.keys['ArrowLeft'] || game.keys['a'];
      const moveRight = game.keys['ArrowRight'] || game.keys['d'];
      const jump = game.keys[' '] || game.keys['ArrowUp'] || game.keys['w'];

      const accel = player.grounded ? MOVE_SPEED : MOVE_SPEED * AIR_CONTROL;

      if (moveLeft) {
        player.vx = -accel;
      } else if (moveRight) {
        player.vx = accel;
      } else if (player.grounded) {
        player.vx *= FRICTION;
      }

      if (jump && player.grounded) {
        player.vy = -JUMP_POWER;
        player.grounded = false;
        player.canDoubleJump = player.hasDoubleJump;
        game.playSound?.('jump');
      } else if (
        jump &&
        !player.grounded &&
        player.canDoubleJump &&
        !game.keys['_doubleJumpUsed']
      ) {
        player.vy = -JUMP_POWER;
        player.canDoubleJump = false;
        game.keys['_doubleJumpUsed'] = true;
        game.playSound?.('doubleJump');
      }

      if (!jump) {
        game.keys['_doubleJumpUsed'] = false;
      }

      if (!player.grounded) {
        player.vy += GRAVITY * dt;
      }

      player.x += player.vx * dt;
      player.y += player.vy * dt;

      player.grounded = false;

      if (!level) return; // guard against null
      level.platforms.forEach((platform) => {
        if (
          player.x + player.w > platform.x &&
          player.x < platform.x + platform.w
        ) {
          if (
            player.vy >= 0 &&
            player.y + player.h >= platform.y &&
            player.y + player.h <= platform.y + platform.h
          ) {
            player.y = platform.y - player.h;
            player.vy = 0;
            player.grounded = true;
            player.canDoubleJump = player.hasDoubleJump;
          } else if (
            player.vy < 0 &&
            player.y <= platform.y + platform.h &&
            player.y + player.h > platform.y + platform.h
          ) {
            player.y = platform.y + platform.h;
            player.vy = 0;

            if (platform.hasHiddenOrb) {
              level.hiddenOrbs.forEach((orb) => {
                if (
                  !orb.unlocked &&
                  orb.platformIndex === level.platforms.indexOf(platform)
                ) {
                  orb.unlocked = true;
                  orb.y = platform.y - 30;
                  game.playSound?.('unlock');
                }
              });
            }
          }
        }

        if (
          player.y + player.h > platform.y + 5 &&
          player.y < platform.y + platform.h - 5
        ) {
          if (
            player.vx > 0 &&
            player.x + player.w > platform.x &&
            player.x < platform.x
          ) {
            player.x = platform.x - player.w;
            player.vx = 0;
          } else if (
            player.vx < 0 &&
            player.x < platform.x + platform.w &&
            player.x + player.w > platform.x + platform.w
          ) {
            player.x = platform.x + platform.w;
            player.vx = 0;
          }
        }
      });

      if (player.x < 0) {
        player.x = 0;
        player.vx = 0;
      }
      if (player.x > 800 - player.w) {
        player.x = 800 - player.w;
        player.vx = 0;
      }

      if (player.y > game.cameraY + 600) {
        player.x = 50;
        player.y = 300;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.canDoubleJump = player.hasDoubleJump;
        game.playSound?.('hit');
      }

      const cameraThreshold = 250;
      const targetCameraY = player.y - cameraThreshold;

      const cameraSpeed = 0.1;
      game.cameraY += (targetCameraY - game.cameraY) * cameraSpeed;

      if (game.cameraY > 0) {
        game.cameraY = 0;
      }

      level.platforms.forEach((platform) => {
        if (platform.moving) {
          const moveSpeed = platform.moveSpeed ?? 0;
          const moveDirection = platform.moveDirection ?? 1;
          const startX = platform.startX ?? platform.x;
          const moveRange = platform.moveRange ?? 0;

          platform.x += moveSpeed * moveDirection * dt;

          if (
            platform.x <= startX - moveRange ||
            platform.x >= startX + moveRange
          ) {
            platform.moveDirection = (platform.moveDirection ?? 1) * -1;
          }

          if (
            player.grounded &&
            player.x + player.w > platform.x &&
            player.x < platform.x + platform.w &&
            Math.abs(player.y + player.h - platform.y) < 5
          ) {
            player.x +=
              moveSpeed * (platform.moveDirection ?? moveDirection) * dt;
          }
        }
      });

      level.enemies.forEach((enemy) => {
        enemy.x += enemy.vx * dt;

        if (enemy.x <= enemy.minX || enemy.x >= enemy.maxX) {
          enemy.vx *= -1;
        }

        if (
          player.x < enemy.x + enemy.w &&
          player.x + player.w > enemy.x &&
          player.y < enemy.y + enemy.h &&
          player.y + player.h > enemy.y
        ) {
          player.x = 50;
          player.y = 300;
          player.vx = 0;
          player.vy = 0;
          player.grounded = false;
          player.canDoubleJump = player.hasDoubleJump;
          game.playSound?.('hit');
        }
      });

      level.collectibles.forEach((coin) => {
        if (
          !coin.collected &&
          coin.type !== 'flag' &&
          player.x < coin.x + coin.w &&
          player.x + player.w > coin.x &&
          player.y < coin.y + coin.h &&
          player.y + player.h > coin.y
        ) {
          coin.collected = true;
          game.score += 10;
          game.playSound?.('coin');
        }
      });

      level.hiddenOrbs.forEach((orb) => {
        if (
          orb.unlocked &&
          !orb.collected &&
          player.x < orb.x + orb.w &&
          player.x + player.w > orb.x &&
          player.y < orb.y + orb.h &&
          player.y + player.h > orb.y
        ) {
          orb.collected = true;
          player.hasDoubleJump = true;
          game.score += 50;
          game.playSound?.('orb');
        }
      });

      const currentTheme = themes[theme];
      ctx.fillStyle = currentTheme.bg;
      ctx.fillRect(0, 0, 800, 500);

      ctx.save();
      ctx.translate(0, -game.cameraY);

      level.platforms.forEach((platform) => {
        if (platform.type === 'goal') {
          ctx.fillStyle = '#27AE60';
        } else if (platform.moving) {
          ctx.fillStyle = '#E67E22';
        } else {
          ctx.fillStyle = currentTheme.platform;
        }
        ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

        ctx.strokeStyle = platform.moving ? '#D35400' : currentTheme.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x, platform.y, platform.w, platform.h);

        if (platform.moving) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('←→', platform.x + platform.w / 2, platform.y + 15);
        }

        if (platform.hasHiddenOrb) {
          const orb = level.hiddenOrbs.find(
            (o) => o.platformIndex === level.platforms.indexOf(platform)
          );
          if (orb && !orb.unlocked) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('?', platform.x + platform.w / 2, platform.y + 15);
          }
        }
      });

      level.collectibles.forEach((coin) => {
        if (!coin.collected) {
          if (coin.type === 'flag') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(coin.x + 13, coin.y + 10, 4, 50);

            ctx.fillStyle = '#E74C3C';
            ctx.beginPath();
            ctx.moveTo(coin.x + 17, coin.y + 10);
            ctx.lineTo(coin.x + 40, coin.y + 20);
            ctx.lineTo(coin.x + 17, coin.y + 30);
            ctx.closePath();
            ctx.fill();

            if (
              player.x < coin.x + coin.w &&
              player.x + player.w > coin.x &&
              player.y < coin.y + coin.h &&
              player.y + player.h > coin.y
            ) {
              coin.collected = true;
              isRunning = false;
              game.playSound?.('victory');
              setGameState('victory');
              return;
            }
          } else {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(coin.x + 8, coin.y + 8, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });

      level.hiddenOrbs.forEach((orb) => {
        if (orb.unlocked && !orb.collected) {
          ctx.fillStyle = '#9B59B6';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#9B59B6';
          ctx.beginPath();
          ctx.arc(orb.x + 10, orb.y + 10, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#E74CE8';
          ctx.beginPath();
          ctx.arc(orb.x + 10, orb.y + 10, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      level.enemies.forEach((enemy) => {
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = '#C0392B';
        ctx.fillRect(enemy.x + 5, enemy.y + 5, 6, 6);
        ctx.fillRect(enemy.x + 14, enemy.y + 5, 6, 6);
      });

      if (character === 'monkey') {
        const bodyColor = player.hasDoubleJump ? '#8B4513' : '#A0522D';
        const bellyColor = player.hasDoubleJump ? '#D2691E' : '#DEB887';

        ctx.fillStyle = bodyColor;
        ctx.fillRect(player.x, player.y + 8, player.w, player.h - 8);

        ctx.fillStyle = bellyColor;
        ctx.fillRect(player.x + 4, player.y + 12, player.w - 8, player.h - 16);

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + 8, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(player.x + 2, player.y + 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(player.x + 18, player.y + 4, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bellyColor;
        ctx.beginPath();
        ctx.arc(player.x + 2, player.y + 4, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(player.x + 18, player.y + 4, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bellyColor;
        ctx.beginPath();
        ctx.ellipse(
          player.x + player.w / 2,
          player.y + 10,
          7,
          6,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        let leftEyeX = player.x + 6;
        let rightEyeX = player.x + 14;
        let eyeY = player.y + 8;
        let eyeSize = 3;

        if (moveLeft) {
          leftEyeX = player.x + 5;
          rightEyeX = player.x + 13;
        } else if (moveRight) {
          leftEyeX = player.x + 7;
          rightEyeX = player.x + 15;
        }

        if (!player.grounded && player.vy < 0) {
          eyeSize = 2;
          eyeY = player.y + 9;
        }

        if (!player.grounded && player.vy > 3) {
          eyeSize = 4;
          eyeY = player.y + 7;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightEyeX, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, eyeSize - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightEyeX, eyeY, eyeSize - 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + 11, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const mouthY = player.y + 14;

        if (!player.grounded && player.vy < -5) {
          ctx.arc(player.x + 10, mouthY - 1, 3, 0.2 * Math.PI, 0.8 * Math.PI);
        } else if (!player.grounded && player.vy > 5) {
          ctx.arc(player.x + 10, mouthY, 2, 0, Math.PI * 2);
        } else if (moveLeft || moveRight) {
          ctx.moveTo(player.x + 6, mouthY);
          ctx.lineTo(player.x + 14, mouthY);
        } else {
          ctx.arc(player.x + 10, mouthY - 2, 3, 0.3 * Math.PI, 0.7 * Math.PI);
        }
        ctx.stroke();

        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(player.x + player.w, player.y + 20);
        ctx.quadraticCurveTo(
          player.x + player.w + 8,
          player.y + 15,
          player.x + player.w + 10,
          player.y + 10
        );
        ctx.stroke();

        if (player.hasDoubleJump) {
          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('🍌', player.x + 10, player.y - 5);
        }
      } else {
        ctx.fillStyle = player.hasDoubleJump ? '#9B59B6' : '#3498DB';
        ctx.fillRect(player.x, player.y, player.w, player.h);

        ctx.fillStyle = '#2C3E50';

        let leftEyeX = player.x + 4;
        let rightEyeX = player.x + 12;
        let eyeY = player.y + 6;
        let eyeSize = 4;
        const mouthY = player.y + 16;

        if (moveLeft) {
          leftEyeX = player.x + 2;
          rightEyeX = player.x + 10;
        } else if (moveRight) {
          leftEyeX = player.x + 6;
          rightEyeX = player.x + 14;
        }

        if (!player.grounded && player.vy < 0) {
          eyeSize = 2;
          eyeY = player.y + 7;
        }

        if (!player.grounded && player.vy > 3) {
          eyeSize = 5;
          eyeY = player.y + 5;
        }

        ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
        ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

        ctx.strokeStyle = '#2C3E50';
        ctx.lineWidth = 2;
        ctx.beginPath();

        if (!player.grounded && player.vy < -5) {
          ctx.arc(player.x + 10, mouthY, 4, 0.2 * Math.PI, 0.8 * Math.PI);
        } else if (!player.grounded && player.vy > 5) {
          ctx.arc(player.x + 10, mouthY - 1, 3, 0, Math.PI * 2);
        } else if (moveLeft || moveRight) {
          ctx.moveTo(player.x + 6, mouthY);
          ctx.lineTo(player.x + 14, mouthY);
        } else {
          ctx.arc(player.x + 10, mouthY - 1, 3, 0.3 * Math.PI, 0.7 * Math.PI);
        }
        ctx.stroke();

        if (player.hasDoubleJump) {
          ctx.fillStyle = '#E74CE8';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('2X', player.x + 10, player.y - 5);
        }
      }

      ctx.restore();

      ctx.fillStyle = '#2C3E50';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`Score: ${game.score}`, 10, 30);

      const height = Math.max(0, Math.floor(-player.y / 10));
      ctx.fillText(`Height: ${height}m`, 10, 60);

      game.animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      isRunning = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (game.animationId) {
        cancelAnimationFrame(game.animationId);
        game.animationId = null;
      }
    };
  }, [gameState, theme, soundEnabled, character, themes]);

  return (
    <div className='w-full max-w-4xl mx-auto p-6 bg-gray-900 rounded-lg'>
      {gameState === 'menu' && !showSettings && (
        <div className='flex flex-col items-center justify-center min-h-[600px] bg-gradient-to-b from-blue-900 to-purple-900 rounded-lg p-8'>
          <div className='text-center mb-12'>
            <h1 className='text-6xl font-bold text-white mb-4 animate-pulse'>
              🐵 MONKEY CLIMB 🍌
            </h1>
            <p className='text-xl text-gray-300'>
              Scale the Heights, Collect Bananas!
            </p>
          </div>

          <div className='flex flex-col gap-4 w-64'>
            <button
              onClick={generateLevel}
              disabled={agentThinking}
              className='px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-600 transform hover:scale-105 transition'
            >
              {agentThinking ? 'Generating...' : '🎮 Play Game'}
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className='px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 transform hover:scale-105 transition'
            >
              ⚙️ Settings
            </button>

            <button
              onClick={() => alert('Thanks for playing Monkey Climb!')}
              className='px-8 py-4 bg-red-600 text-white text-xl font-bold rounded-lg hover:bg-red-700 transform hover:scale-105 transition'
            >
              🚪 Quit Game
            </button>
          </div>

          <div className='mt-12 text-gray-400 text-sm'>
            <p>An AI-Generated Platformer Experience</p>
          </div>
        </div>
      )}

      {gameState === 'menu' && showSettings && (
        <div className='flex flex-col min-h-[600px] bg-gray-800 rounded-lg p-8'>
          <h2 className='text-4xl font-bold text-white mb-8'>⚙️ Settings</h2>

          <div className='space-y-6 mb-8'>
            <div>
              <label className='block text-gray-300 text-xl mb-3'>
                Character
              </label>
              <div className='flex gap-4'>
                <button
                  onClick={() => setCharacter('monkey')}
                  className={`px-6 py-4 rounded-lg font-bold text-lg ${
                    character === 'monkey'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  🐵 Monkey
                </button>
                <button
                  onClick={() => setCharacter('block')}
                  className={`px-6 py-4 rounded-lg font-bold text-lg ${
                    character === 'block'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  🟦 Block
                </button>
              </div>
            </div>

            <div>
              <label className='block text-gray-300 text-xl mb-3'>
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(
                    (e.target as HTMLSelectElement).value as Difficulty
                  )
                }
                className='w-full p-4 bg-gray-700 text-white text-lg rounded-lg'
              >
                <option value='easy'>Easy</option>
                <option value='medium'>Medium</option>
                <option value='hard'>Hard</option>
              </select>
            </div>

            <div>
              <label className='block text-gray-300 text-xl mb-3'>Theme</label>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme((e.target as HTMLSelectElement).value as ThemeKey)
                }
                className='w-full p-4 bg-gray-700 text-white text-lg rounded-lg'
              >
                <option value='forest'>🌲 Forest</option>
                <option value='cave'>🏔️ Cave</option>
                <option value='desert'>🏜️ Desert</option>
                <option value='snow'>❄️ Snow</option>
              </select>
            </div>

            <div>
              <label className='block text-gray-300 text-xl mb-3'>
                Sound Effects
              </label>
              <button
                onClick={() => {
                  if (!gameRef.current.audioContext) {
                    try {
                      const Ctx =
                        window.AudioContext || window.webkitAudioContext;
                      // Ctx may be undefined in older browsers — guard with try/catch
                      gameRef.current.audioContext = new Ctx();
                      setSoundEnabled(!soundEnabled);
                    } catch {
                      console.log('Audio not supported');
                    }
                  } else {
                    setSoundEnabled(!soundEnabled);
                  }
                }}
                className={`px-6 py-4 rounded-lg font-bold text-lg ${
                  soundEnabled
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                🔊 {soundEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className='px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 w-48'
          >
            ← Back
          </button>
        </div>
      )}

      {(gameState === 'playing' || gameState === 'victory') && (
        <>
          <div className='mb-4 flex items-center justify-between'>
            <h1 className='text-2xl font-bold text-white flex items-center gap-2'>
              <Zap className='text-yellow-400' />
              Monkey Climb
            </h1>
            <div className='flex gap-2'>
              {gameState === 'playing' && (
                <button
                  onClick={() => {
                    setGameState('menu');
                    gameRef.current.keys = {};
                  }}
                  className='px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2'
                >
                  <RotateCcw size={16} />
                  Menu
                </button>
              )}
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className='w-full border-4 border-gray-700 rounded-lg bg-gray-800'
          />

          {gameState === 'playing' && (
            <div className='mt-2 text-sm text-gray-400 text-center'>
              Arrow Keys or WASD to move • Space/W/Up to jump • Hit ? blocks
              from below for power-ups!
            </div>
          )}

          {gameState === 'victory' && (
            <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50'>
              <div className='bg-gray-800 p-8 rounded-lg text-center'>
                <h2 className='text-3xl font-bold text-green-500 mb-2'>
                  Victory!
                </h2>
                <p className='text-xl text-white mb-1'>You reached the flag!</p>
                <p className='text-2xl text-yellow-400 mb-4'>
                  Score: {gameRef.current.score}
                </p>
                <button
                  onClick={() => {
                    generateLevel();
                  }}
                  className='px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700'
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

          <div className='mt-4 bg-gradient-to-b from-gray-800 to-gray-900 p-6 rounded-lg border-4 border-yellow-600'>
            <h3 className='text-lg font-bold text-yellow-400 mb-4 text-center'>
              🕹️ ARCADE CONTROLS 🕹️
            </h3>

            <div className='flex justify-around items-center'>
              {/* D-Pad */}
              <div className='relative'>
                <div className='text-xs text-gray-400 mb-2 text-center'>
                  MOVEMENT
                </div>
                <div className='relative w-32 h-32'>
                  {/* D-Pad Base */}
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='w-32 h-10 bg-gray-700 rounded'></div>
                  </div>
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='w-10 h-32 bg-gray-700 rounded'></div>
                  </div>

                  {/* Up Button */}
                  <div
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-t-lg transition-all ${
                      gameRef.current.keys?.['ArrowUp'] ||
                      gameRef.current.keys?.['w']
                        ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-95'
                        : 'bg-red-800'
                    } flex items-center justify-center text-white font-bold border-2 border-red-900`}
                  >
                    ▲
                  </div>

                  {/* Down Button */}
                  <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-b-lg transition-all ${
                      gameRef.current.keys?.['ArrowDown'] ||
                      gameRef.current.keys?.['s']
                        ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-95'
                        : 'bg-red-800'
                    } flex items-center justify-center text-white font-bold border-2 border-red-900`}
                  >
                    ▼
                  </div>

                  {/* Left Button */}
                  <div
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-l-lg transition-all ${
                      gameRef.current.keys?.['ArrowLeft'] ||
                      gameRef.current.keys?.['a']
                        ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-95'
                        : 'bg-red-800'
                    } flex items-center justify-center text-white font-bold border-2 border-red-900`}
                  >
                    ◀
                  </div>

                  {/* Right Button */}
                  <div
                    className={`absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-r-lg transition-all ${
                      gameRef.current.keys?.['ArrowRight'] ||
                      gameRef.current.keys?.['d']
                        ? 'bg-red-600 shadow-lg shadow-red-500/50 scale-95'
                        : 'bg-red-800'
                    } flex items-center justify-center text-white font-bold border-2 border-red-900`}
                  >
                    ▶
                  </div>

                  {/* Center */}
                  <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gray-900 rounded-full border-2 border-gray-600'></div>
                </div>
              </div>

              {/* Joystick */}
              <div className='relative'>
                <div className='text-xs text-gray-400 mb-2 text-center'>
                  ANALOG
                </div>
                <div className='relative w-32 h-32 bg-gray-700 rounded-full border-4 border-gray-600 flex items-center justify-center'>
                  {/* Joystick base circle */}
                  <div className='absolute inset-4 bg-gray-800 rounded-full'></div>

                  {/* Joystick stick */}
                  <div
                    className='absolute w-12 h-12 bg-gradient-to-b from-red-500 to-red-700 rounded-full border-4 border-red-900 shadow-lg transition-all duration-100'
                    style={{
                      transform: `translate(${
                        gameRef.current.keys?.['ArrowRight'] ||
                        gameRef.current.keys?.['d']
                          ? '15px'
                          : gameRef.current.keys?.['ArrowLeft'] ||
                            gameRef.current.keys?.['a']
                          ? '-15px'
                          : '0px'
                      }, ${
                        gameRef.current.keys?.['ArrowDown'] ||
                        gameRef.current.keys?.['s']
                          ? '15px'
                          : gameRef.current.keys?.['ArrowUp'] ||
                            gameRef.current.keys?.['w']
                          ? '-15px'
                          : '0px'
                      })`,
                    }}
                  >
                    <div className='w-full h-full rounded-full bg-gradient-to-br from-red-400 to-transparent'></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className='relative'>
                <div className='text-xs text-gray-400 mb-2 text-center'>
                  ACTIONS
                </div>
                <div className='relative w-32 h-32'>
                  {/* Jump Button (A) */}
                  <div
                    className={`absolute bottom-8 right-4 w-16 h-16 rounded-full transition-all ${
                      gameRef.current.keys?.[' ']
                        ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-95'
                        : 'bg-green-700'
                    } flex items-center justify-center text-white font-bold text-2xl border-4 border-green-900`}
                  >
                    A
                  </div>

                  {/* Secondary Button (B) */}
                  <div
                    className={`absolute top-8 right-16 w-14 h-14 rounded-full transition-all ${
                      gameRef.current.keys?.['b']
                        ? 'bg-blue-500 shadow-lg shadow-blue-500/50 scale-95'
                        : 'bg-blue-700'
                    } flex items-center justify-center text-white font-bold text-xl border-4 border-blue-900`}
                  >
                    B
                  </div>
                </div>
              </div>
            </div>

            <div className='mt-6 text-center'>
              <div className='inline-block bg-black px-6 py-3 rounded-lg border-2 border-yellow-600'>
                <div className='text-yellow-400 font-mono text-sm mb-1'>
                  INSERT COIN
                </div>
                <div className='text-red-500 font-mono text-xs animate-pulse'>
                  ◉ READY ◉
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Agent log (debug) */}
      {agentLog.length > 0 && (
        <div className='mt-4 text-xs text-gray-400'>
          {agentLog
            .slice()
            .reverse()
            .map((l, i) => (
              <div key={i}>{l}</div>
            ))}
        </div>
      )}
    </div>
  );
};

export default PlatformerAgent;
