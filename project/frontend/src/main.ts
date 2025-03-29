import "./chartManager";

const predictImgWS = "ws://localhost:5002";
const predictionText = document.getElementById("predictionText") as HTMLParagraphElement

class WebSocketManager {
  private socket: WebSocket;
  private predictionText: HTMLParagraphElement;

  constructor(url: string, predictionTextId: string) {
    this.socket = new WebSocket(url)
    this.predictionText = document.getElementById(predictionTextId) as HTMLParagraphElement

    this.socket.addEventListener("open", () => console.log("Connected to predict image websocket"))
    this.socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data)
      if (data.prediction) {
        this.predictionText.innerText = data.prediction
      }
    })
  }

  sendPrediction(imageData: number[]) {
    this.socket.send(JSON.stringify({ imageData }))
  }
}

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

  constructor(canvasId: string, predictionCallback?: (imageData: number[]) => void) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement

    if (!this.canvas) {
      throw new Error("Canvas not found");
    }

    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D

    this.ctx.imageSmoothingEnabled = false
    this.ctx.strokeStyle = 'white'
    this.ctx.fillStyle = "white";

    this.predictCallback = predictionCallback || null;

    this.canvas.addEventListener("pointerdown", this.startDrawing.bind(this));
    this.canvas.addEventListener("pointerup", this.stopDrawing.bind(this));
    this.canvas.addEventListener("pointerout", this.stopDrawing.bind(this));
    this.canvas.addEventListener("pointermove", this.draw.bind(this));
  }

  private startDrawing(e: MouseEvent) {
    if (e.button == 2 ) {
      this.clearCanvas()
      return
    }

    if (e.button == 0) {
      this.isDrawing = true
      ;[this.lastX, this.lastY] = [e.offsetX, e.offsetY]
      this.draw(e)

      if (this.predictionTimer) clearInterval(this.predictionTimer)

      this.predictionTimer = setInterval(() => {
        const imageData = this.getImageDataInGrayscale();
        if (this.predictCallback) {
          this.predictCallback(imageData);
        }
      }, 200);
    }
  }

  private draw(e: MouseEvent) {
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

  private stopDrawing() {
    this.isDrawing = false
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
      this.predictionTimer = null
    }
  }

  public clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
    }
    predictionText.innerText = "-";
  }

  private getImageDataInGrayscale(width: number = 28, height: number = 28) {
    // Create the canvas reductor
    const dummyCanvas = document.createElement('canvas') as HTMLCanvasElement
    const dummyCtx = dummyCanvas.getContext('2d') as CanvasRenderingContext2D

    dummyCanvas.width = width
    dummyCanvas.height = height
    dummyCtx.fillStyle = "black"
    dummyCtx.fillRect(0, 0, width, height)
    dummyCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, width, height)

    // Get image
    const imageData = dummyCtx.getImageData(0, 0, width, height)
    return Array.from({length: width * height}, (_, i) => {
      const index = i * 4
      return imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2] / 3
    })
  }
}

const wsManager = new WebSocketManager(predictImgWS, "predictionText");
const drawingBoard = new DrawingBoardManager("drawingCanvas", (imageData) => wsManager.sendPrediction(imageData));

// Clean button
document.getElementById("clearBtn")!.addEventListener("click", () => drawingBoard.clearCanvas());