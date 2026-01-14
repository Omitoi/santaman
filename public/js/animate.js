// --- ANIMATION CONFIGURATION ---
const SPRITE_SIZE = 64;
// The number of frames in one row of the sprite sheet
const FRAMES_PER_DIRECTION = 3;
const FRAME_TIME = 0.15; // seconds per frame

// --- PLAYER ANIMATION ---
// Animates player sprite according to movement direction
export function updatePlayerAnimation(deltaTime, player) {
  // This function can't run if the player object or its element don't exist
  if (!player || !player.el) return;

  // Access the player-specific animation state
  const anim = player.animation;

  // Determine movement direction
  const dx = player.x - player.prevX;
  const dy = player.y - player.prevY;

  // GHOST LOGIC
  if (player.isDead) {
    // Frames: 0=Right, 1=Idle/Up/Down, 2=Left
    let frameIndex = 1; // Default to Idle/Up/Down

    if (dx > 0.1)
      frameIndex = 0; // Right
    else if (dx < -0.1) frameIndex = 2; // Left

    // Ghost floating animation is handled by CSS, but sprite frame is handled here.
    // We only have 1 row.
    const bgX = frameIndex * SPRITE_SIZE;
    const bgY = 0;

    player.el.style.backgroundPosition = `-${bgX}px -${bgY}px`;
    return;
  }

  // STANDARD PLAYER LOGIC
  // 1) Update direction based on movement
  const isMoving =
    player.animation.isMoving !== undefined ? player.animation.isMoving : dx !== 0 || dy !== 0;

  if (!isMoving) {
    anim.currentFrame = 1;
    anim.animTime = 0;
  } else {
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      if (Math.abs(dx) > Math.abs(dy)) {
        anim.currentDir = dx > 0 ? 'right' : 'left';
      } else {
        anim.currentDir = dy > 0 ? 'down' : 'up';
      }
    }

    anim.animTime += deltaTime;
    if (anim.animTime >= FRAME_TIME) {
      anim.animTime -= FRAME_TIME;
      anim.currentFrame = (anim.currentFrame + 1) % FRAMES_PER_DIRECTION;
    }
  }

  const dirIndex = {
    down: 0,
    left: 1,
    right: 2,
    up: 3,
  }[anim.currentDir];

  const bgX = anim.currentFrame * SPRITE_SIZE;
  const bgY = dirIndex * SPRITE_SIZE;

  player.el.style.backgroundPosition = `-${bgX}px -${bgY}px`;

  player.el.classList.remove('anim-up', 'anim-down', 'anim-left', 'anim-right');
  player.el.classList.add(`anim-${anim.currentDir}`);
}

// --- OTHER ELEMENT ANIMATIONS ---
// Animates bombs, explosions and ghosts
// As opposed to player animation, this is a simple 3 frame animation
// not dependent on movement direction
export function updateElementAnimation(deltaTime, element, spriteSize = SPRITE_SIZE) {
  if (!element || !element.el) return;

  const anim = element.animation;

  anim.animTime += deltaTime;
  if (anim.animTime >= FRAME_TIME) {
    anim.animTime -= FRAME_TIME;
    anim.currentFrame = (anim.currentFrame + 1) % FRAMES_PER_DIRECTION;
  }

  const bgX = anim.currentFrame * spriteSize;
  const bgY = 0;

  element.el.style.backgroundPosition = `-${bgX}px -${bgY}px`;
}
