import Chart from 'chart.js/auto';

interface TrainingData {
  current_epoch: number,
  total_epochs: number,
  train_loss: number[],
  val_loss: number[],
  ETA: number,
  is_model_trained: boolean
}

export class ChartManager {
  chart: Chart

  constructor(canvas: HTMLCanvasElement) {
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          this.createDataset("Training Loss", "rgb(75, 192, 192)") as never,
          this.createDataset("Validation Loss", "rgb(255, 99, 132)") as never
        ]
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
  }

  private createDataset(label: string, color: string) {
    return {
      type: 'line',
      label: label,
      data: [],
      borderColor: color,
      tension: 0.1
    }
  }

  update(data: TrainingData) {
    const percentage = data.current_epoch / data.total_epochs * 100;
    UIManager.updateProgress(percentage)
    
    // Load data for the first time
    if (this.chart.data.labels?.length == 0) {
      this.chart.data.labels = Array.from(Array(data.current_epoch).keys()) as never[]
      this.chart.data.datasets[0].data = data.train_loss
      this.chart.data.datasets[1].data = data.val_loss
      this.chart.update()
      UIManager.updateETA(data.ETA)
    } else {
      if (data.current_epoch > this.getLastEpoch()) {
        this.chart.data.labels?.push(data.current_epoch as never)
        this.chart.data.datasets[0].data?.push(data.train_loss[data.current_epoch - 1] as never)
        this.chart.data.datasets[1].data?.push(data.val_loss[data.current_epoch - 1] as never)
        this.chart.update()
        UIManager.updateETA(data.ETA)
      }
    }
  }

  private getLastEpoch(): number {
    return Math.max(...(this.chart.data.labels as number[] || [0]))
  }
}

class UIManager {
  private static ETATimer: any = null;
  private static ETA = 0;

  static updateProgress(percentage: number) {
    modelTrainingProgress.value = percentage
    modelTrainingProgressText.innerText = Math.round(percentage) + "%";
  }

  static updateETA(ETA: number) {
    this.ETA = ETA
    if (!this.ETATimer) {
      this.ETATimer = setInterval(() => {
        this.ETA = Math.max(0, this.ETA - 1)
        this.displayETA()
      }, 1000)
    }
    this.displayETA()
  }
  
  static displayETA() {
    const etaMinutes = Math.floor(this.ETA / 60);
    const etaSecondsLeft = Math.floor((this.ETA % 60));

    modelTrainingETA.innerText = `ETA: ${etaMinutes}m ${etaSecondsLeft}s`;
  }
}

const modelTrainingChart = document.getElementById("modelTrainingChart") as HTMLCanvasElement;
const modelTrainingProgress = document.getElementById("modelTrainingProgress") as HTMLProgressElement;
const modelTrainingProgressText = document.getElementById("modelTrainingProgressText") as HTMLParagraphElement;
const modelTrainingETA = document.getElementById("modelTrainingETA") as HTMLParagraphElement;
const modelTrainingModal = document.getElementById("modelTrainingModal") as HTMLDialogElement;

const chartManager = new ChartManager(modelTrainingChart)
const trainingProgressWebSocket = new WebSocket("http://localhost:5001");

trainingProgressWebSocket.addEventListener("open", () => console.log("Connected to training progress websocket"))

trainingProgressWebSocket.addEventListener("message", (event) => {
  const data: TrainingData = JSON.parse(event.data);  

  if (data.is_model_trained) {
    console.log("Model trained, closing websocket");
    modelTrainingModal.close()
    trainingProgressWebSocket.close();
  } else {
    if (!modelTrainingModal.open) {
      modelTrainingModal.showModal()
    }
    chartManager.update(data)
  }
})