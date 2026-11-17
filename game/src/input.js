// FRONTLINE input: keyboard + mouse, in canvas pixels. The sim reads this
// object directly; the playtest drives it the same way a player does.
export function makeInput(canvas) {
  const input = {
    keys: {},
    pressed: {}, // edge-triggered, consumed by the sim each step
    mouseX: 640,
    mouseY: 400,
    mouseDown: false,
    mouseClicked: false,
  };

  function canvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const p = canvasPos(e.clientX, e.clientY);
    input.mouseX = p.x; input.mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
    const p = canvasPos(e.clientX, e.clientY);
    input.mouseX = p.x; input.mouseY = p.y;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => {
    input.keys = {}; input.mouseDown = false;
  });
  return input;
}

export function consumePressed(input) {
  const p = input.pressed;
  input.pressed = {};
  const clicked = input.mouseClicked;
  input.mouseClicked = false;
  return { keys: p, clicked };
}

// Movement vector from WASD / arrows, normalised.
export function moveVector(input) {
  let x = 0; let y = 0;
  if (input.keys.KeyA || input.keys.ArrowLeft) x -= 1;
  if (input.keys.KeyD || input.keys.ArrowRight) x += 1;
  if (input.keys.KeyW || input.keys.ArrowUp) y -= 1;
  if (input.keys.KeyS || input.keys.ArrowDown) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}
