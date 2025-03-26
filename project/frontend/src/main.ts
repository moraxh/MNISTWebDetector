const trainingProgressWS = "http://localhost:5001";

const trainingProgressSocket = new WebSocket(trainingProgressWS);

trainingProgressSocket.addEventListener("open", () => {
    console.log("Connected to training progress websocket");
})

trainingProgressSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
})