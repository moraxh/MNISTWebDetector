import "./chartManager";

const predictImgWS = "ws://localhost:5002";
const predictImgSocket = new WebSocket(predictImgWS);
const predictionText = document.getElementById("predictionText") as HTMLParagraphElement

predictImgSocket.addEventListener("open", () => {
    console.log("Connected to predict image websocket");
})

predictImgSocket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);

  if (data.prediction) {
    predictionText.innerText = data.prediction; 
  }
})

class DrawingBoardManager {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  lastX = 0
  lastY = 0 
  strokeWidth = 25
  isDrawing = false
  interpolation = 5
  predictionTimer: any = null;
  predictCallback: ((imageData: number[]) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, predictionCallback?: (imageData: number[]) => void) {
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    this.ctx.imageSmoothingEnabled = false
    this.ctx.strokeStyle = 'white'
    this.ctx.fillStyle = "white";

    this.predictCallback = predictionCallback || null;

    this.canvas.addEventListener('mousedown', (e) => {
      this.startDrawing(e)
      canvas.addEventListener('mousemove', this.draw.bind(this))
    })
    this.canvas.addEventListener('mouseup', () => {
      this.stopDrawing()
      canvas.removeEventListener('mousemove', this.draw.bind(this))
    })
    this.canvas.addEventListener('mouseout', this.stopDrawing)
  }

  startDrawing(e: MouseEvent) {
    if (e.button == 2 ) {
      this.clearCanvas()
    } else if (e.button == 0) {
      this.isDrawing = true
      ;[this.lastX, this.lastY] = [e.offsetX, e.offsetY]
      this.draw(e)

      if (this.predictionTimer) {
        clearInterval(this.predictionTimer);
      }
      this.predictionTimer = setInterval(() => {
        const imageData = this.getImageDataInGrayscale();
        if (this.predictCallback) {
          this.predictCallback(imageData);
        }
      }, 200);
    }
  }

  draw(e: MouseEvent) {
    if (!this.isDrawing) return

    const { offsetX, offsetY } = e

    const dx = this.lastX - offsetX
    const dy = this.lastY - offsetY

    for (let i = 0; i < this.interpolation; i++) {
      this.ctx.beginPath()
      this.ctx.arc(this.lastX + (dx / this.interpolation) * i, this.lastY + (dy / this.interpolation) * i, this.strokeWidth, 0, 2 * Math.PI)
      this.ctx.fill()
    }
    
    ;[this.lastX, this.lastY] = [offsetX, offsetY]
  }

  stopDrawing() {
    this.isDrawing = false
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
    }
    predictionText.innerText = "-";
  }

  getImageDataInGrayscale(width: number = 28, height: number = 28) {
    // Create the canvas reductor
    const dummyCanvas = document.createElement('canvas') as HTMLCanvasElement
    const dummyCtx = dummyCanvas.getContext('2d') as CanvasRenderingContext2D
    dummyCanvas.width = width
    dummyCanvas.height = height
    dummyCtx.fillStyle = "black"
    dummyCtx.fillRect(0, 0, width, height)

    // Draw the image
    dummyCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, width, height)

    // Get image
    const imageData = dummyCtx.getImageData(0, 0, width, height)

    // Convert to grayscale
    const grayscaleImageData = Array(width * height).fill(0)
    for (let i = 0; i < imageData.data.length; i += 4) {
      const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3
      grayscaleImageData[i / 4] = avg
    }

    return grayscaleImageData
  }
}

const canvas = document.getElementById('drawingCanvas') as HTMLCanvasElement 
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement

const predictImg = async (imageData: number[]) => {
    predictImgSocket.send(JSON.stringify({ imageData: imageData }));
}

const drawingBoardManager = new DrawingBoardManager(canvas, predictImg)
clearBtn.addEventListener('click', drawingBoardManager.clearCanvas.bind(drawingBoardManager))
