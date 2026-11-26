// Input: keyboard (arrows / WASD) plus mouse look. Keys are read per frame
// into a small control vector the flight model consumes.

export function makeInput() {
  return {
    keys: new Set(),
    // Mouse look: dragging moves a free-look offset that eases back to centre.
    lookX: 0, lookY: 0,
    dragging: false,
    lastX: 0, lastY: 0,
    // Edge-triggered actions, consumed once by the main loop.
    pressed: new Set(),
    mouseDown: false,
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.key.toLowerCase());
    input.keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    input.dragging = true;
    input.mouseDown = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.dragging = false;
    input.mouseDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.lookX += (e.clientX - input.lastX) * 0.003;
    input.lookY += (e.clientY - input.lastY) * 0.003;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
}

// Read the current control vector from held keys.
// pitch + = nose up (ArrowUp / W pulls back), roll + = bank right.
export function readControls(input) {
  const k = input.keys;
  const pitch = (k.has('arrowup') || k.has('w') ? 1 : 0)
    + (k.has('arrowdown') || k.has('s') ? -1 : 0);
  const roll = (k.has('arrowright') || k.has('d') ? 1 : 0)
    + (k.has('arrowleft') || k.has('a') ? -1 : 0);
  const yaw = (k.has('e') ? 1 : 0) + (k.has('q') ? -1 : 0);
  const throttle = (k.has('shift') ? 1 : 0) + (k.has('control') ? -1 : 0);
  // Ease the free-look offset back to centre when the mouse is released.
  if (!input.dragging) {
    input.lookX *= 0.94;
    input.lookY *= 0.94;
  }
  input.lookX = clampLook(input.lookX);
  input.lookY = clampLook(input.lookY);
  return { pitch, roll, yaw, throttle, throttleSet: null };
}

function clampLook(v) {
  return Math.max(-0.6, Math.min(0.6, v));
}

// Was this key pressed since the last frame? Consumes the press.
export function wasPressed(input, key) {
  const hit = input.pressed.has(key.toLowerCase());
  if (hit) input.pressed.delete(key.toLowerCase());
  return hit;
}

export function endFrame(input) {
  input.pressed.clear();
}
