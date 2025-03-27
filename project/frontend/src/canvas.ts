const clearBtn = document.getElementById('clearBtn')
const canvas = document.getElementById("drawingCanvas") as HTMLCanvasElement;

if (!canvas) {
  throw new Error("Canvas not found");
}

if (!clearBtn) {
  throw new Error("Clear button not found");
}

const ctx = canvas.getContext('2d')

if (!ctx) {
  throw new Error("Canvas context not found");
}

let lastX = 0
let lastY = 0 
let strokeWidth = 10
let isDrawing = false
let interpolation = 5

ctx.imageSmoothingEnabled = false
ctx.strokeStyle = 'white'
ctx.fillStyle = "white";

const startDrawing = (e: MouseEvent) => {
  if (e.button == 2 ) {
    clearCanvas()
  } else if (e.button == 0) {
    isDrawing = true
    ;[lastX, lastY] = [e.offsetX, e.offsetY]
    draw(e)
  }
}

const draw = (e: MouseEvent) => {
  if (!isDrawing) return

  const { offsetX, offsetY } = e

  const dx = lastX - offsetX
  const dy = lastY - offsetY

  for (let i = 0; i < interpolation; i++) {
    ctx.beginPath()
    ctx.arc(lastX + (dx / interpolation) * i, lastY + (dy / interpolation) * i, strokeWidth, 0, 2 * Math.PI)
    ctx.fill()
  }
  
  ;[lastX, lastY] = [offsetX, offsetY]
}

const stopDrawing = () => {
  isDrawing = false
}

const clearCanvas = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

canvas.addEventListener('mousedown', (e) => {
  startDrawing(e)
  canvas.addEventListener('mousemove', draw)
})
canvas.addEventListener('mouseup', () => {
  stopDrawing()
  canvas.removeEventListener('mousemove', draw)
})
canvas.addEventListener('mouseout', stopDrawing)
clearBtn.addEventListener('click', clearCanvas)