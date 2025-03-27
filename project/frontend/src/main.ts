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

const trainingProgressWS = "http://localhost:5001";
const trainingProgressSocket = new WebSocket(trainingProgressWS);

const modelTrainingModal = document.getElementById("modelTrainingModal") as HTMLDialogElement;

if (!modelTrainingModal) {
  throw new Error("Model training modal not found");
}

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