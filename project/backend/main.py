import os
import asyncio
import websockets
import logging
import coloredlogs
import json
from utils.datasets import DATA_PATH
from utils.MLP import model

# Configure coloredlogs
logger = logging.getLogger(__name__)
coloredlogs.install(level='INFO', logger=logger, fmt='%(asctime)s [%(levelname)s] %(message)s', datefmt='%I:%M:%S %p', isatty=True)

HOST = os.getenv("HOST", "localhost")

MODEL_PATH = f"{DATA_PATH}/model.pt"
MODEL_INFO_PATH = f"{DATA_PATH}/model.json"
TRAIN_MODEL_PROGRESS_WEBSOCKET_PORT = 5001

async def train_progress_websocket_handler(websocket):
    while True:
        # Send the current epoch progress
        progress = model.get_training_progress()
        await websocket.send(json.dumps(progress))
        await asyncio.sleep(1)  # Adjust the frequency of updates as needed

async def start_train_progress_websocket_server():
    # Web socket for training progress
    start_train_progress_websocket_server = await websockets.serve(train_progress_websocket_handler, HOST, TRAIN_MODEL_PROGRESS_WEBSOCKET_PORT)

    logger.info(f"Training progress websocket server started on ws://localhost:{TRAIN_MODEL_PROGRESS_WEBSOCKET_PORT}")

    await start_train_progress_websocket_server.wait_closed()

async def run_main():
    # Start the training progress websocket server
    websocket_server_task = asyncio.create_task(start_train_progress_websocket_server())

    # Check if there is already a trained model
    if os.path.exists(MODEL_PATH) and os.path.exists(MODEL_INFO_PATH):
        logger.info("Loading trained model")
        model.load_trained_model(MODEL_PATH, MODEL_INFO_PATH)
    else:
        logger.info("Trained model not found, training...")
        await asyncio.to_thread(model.fit)
        model.save_trained_model(MODEL_PATH, MODEL_INFO_PATH)
    
    await asyncio.Future()  # Keep the event loop running

def main():
    # Run the async main function
    asyncio.run(run_main())

if __name__ == '__main__':
    main()