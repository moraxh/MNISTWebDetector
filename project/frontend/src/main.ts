import Chart from 'chart.js/auto';

const modelTrainingChart = document.getElementById("modelTrainingChart") as HTMLCanvasElement;
const modelTrainingProgress = document.getElementById("modelTrainingProgress") as HTMLProgressElement;
const modelTrainingProgressText = document.getElementById("modelTrainingProgressText") as HTMLParagraphElement;
const modelTrainingETA = document.getElementById("modelTrainingETA") as HTMLParagraphElement;

const epochCompletionTimestamps: number[] = [];
let eta = 0
let etaTimer: any = null;

const chart = new Chart(modelTrainingChart, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      type: 'line',
      label: 'Training Loss',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }, {
      type: 'line',
      label: 'Validation Loss',
      data: [],
      borderColor: 'rgb(255, 99, 132)',
      tension: 0.1
    }]
  },
  options: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
})

const predictImgWS = "ws://localhost:5002";
const predictImgSocket = new WebSocket(predictImgWS);
const predictionText = document.getElementById("predictionText") as HTMLParagraphElement;

predictImgSocket.addEventListener("open", () => {
    console.log("Connected to predict image websocket");
})

predictImgSocket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);

  if (data.prediction) {
    predictionText.innerText = data.prediction; 
  }
})

const predictImg = async (imageData: number[]) => {
    predictImgSocket.send(JSON.stringify({ imageData: imageData }));
}

const trainingProgressWS = "http://localhost:5001";
const trainingProgressSocket = new WebSocket(trainingProgressWS);

const modelTrainingModal = document.getElementById("modelTrainingModal") as HTMLDialogElement;

trainingProgressSocket.addEventListener("open", () => {
    console.log("Connected to training progress websocket");
})

trainingProgressSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);

    if (data.is_model_trained) {
      console.log("Model trained, closing websocket");
      modelTrainingModal.close()
      trainingProgressSocket.close();
    } else {
      if (!modelTrainingModal.open) {
        modelTrainingModal.showModal()
      }

      // Load initial data
      if (chart.data.labels?.length === 0) {
        // Percentage
        const percentage = data.current_epoch / data.total_epochs * 100;
        modelTrainingProgress.value = percentage
        modelTrainingProgressText.innerText = Math.round(percentage) + "%";

        // Chart
        chart.data.labels = Array.from(Array(data.current_epoch).keys()) as never[]
        chart.data.datasets[0].data = data.train_loss
        chart.data.datasets[1].data = data.val_loss
        chart.update()
      } else {
        // Update data
        if (data.current_epoch > Math.max(...(chart.data.labels as number[] || []))) {
          epochCompletionTimestamps.push(performance.now())

          // Percentage
          const percentage = data.current_epoch / data.total_epochs * 100;
          modelTrainingProgress.value = percentage
          modelTrainingProgressText.innerText = Math.round(percentage) + "%";

          // Chart
          chart.data.labels?.push(data.current_epoch as never)
          chart.data.datasets[0].data?.push(data.train_loss[data.current_epoch - 1] as never)
          chart.data.datasets[1].data?.push(data.val_loss[data.current_epoch - 1] as never)
          chart.update()

          // ETA
          if (epochCompletionTimestamps.length > 1) {
            let differenceEpochTimes = epochCompletionTimestamps.map((timestamp, index) => timestamp - epochCompletionTimestamps[index - 1]);
            differenceEpochTimes = differenceEpochTimes.filter(time => time > 0);

            const sum = differenceEpochTimes.reduce((a, b) => a + b, 0);
            const averageEpochTime = sum / differenceEpochTimes.length;

            eta = (data.total_epochs - data.current_epoch) * averageEpochTime;

            updateETA()
          }
        }
      }
    }
})

const updateETA = () => {
  // Start Timer
  if (!etaTimer) {
    etaTimer = setInterval(() => {
      eta -= 1000;
      eta = Math.max(0, eta);
      updateETA()
    }, 1000)
  }

  const etaMinutes = Math.floor(eta / 60000);
  const etaSecondsLeft = Math.floor((eta % 60000) / 1000);

  const etaString = `ETA: ${etaMinutes}m ${etaSecondsLeft}s`;

  modelTrainingETA.innerText = etaString;
}

// CANVAS

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
let strokeWidth = 20
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
  const imageData = getImageDataInGrayscale()
  predictImg(imageData)
}

const clearCanvas = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

const getImageDataInGrayscale = (width: number = 28, height: number = 28) => {
  // Get image
  const dummyCanvas = document.createElement('canvas')
  const dummyCtx = dummyCanvas.getContext('2d')
  dummyCanvas.width = width
  dummyCanvas.height = height
  if (dummyCtx === null) {
    throw new Error("Canvas context not found");
  }
  dummyCtx.fillStyle = "black"
  dummyCtx.fillRect(0, 0, width, height)
  dummyCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height)

  const imageData = dummyCtx.getImageData(0, 0, width, height)

  const grayscaleImageData = Array(width * height).fill(0)
  // Convert to grayscale
  for (let i = 0; i < imageData.data.length; i += 4) {
    const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3
    grayscaleImageData[i / 4] = avg
  }
  return grayscaleImageData
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