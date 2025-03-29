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
PREDICT_WEBSOCKET_PORT = 5002

class ValidationException(Exception):
    pass

async def train_progress_websocket_handler(websocket):
    try:
        while True:
            # Send the current epoch progress
            progress = model.get_training_progress()
            await websocket.send(json.dumps(progress))
            await asyncio.sleep(2)  # Adjust the frequency of updates as needed
    except websockets.exceptions.ConnectionClosed:
        logger.info("Training progress websocket connection closed")

async def start_train_progress_websocket_server():
    # Web socket for training progress
    server = await websockets.serve(train_progress_websocket_handler, "0.0.0.0", TRAIN_MODEL_PROGRESS_WEBSOCKET_PORT)

    logger.info(f"Training progress websocket server started on ws://localhost:{TRAIN_MODEL_PROGRESS_WEBSOCKET_PORT}")

    await server.wait_closed()

async def predict_websocket_handler(websocket):
    try:
        while True:
            input_data = await websocket.recv()
            input_data = json.loads(input_data)

            # If model is not trained
            progress = model.get_training_progress()
            if not progress['is_model_trained']:
                raise ValidationException("Model is not trained")
            # Validate data
            if 'imageData' not in input_data:
                raise ValidationException("Invalid input data")
            # Validate data length
            if len(input_data['imageData']) != 28**2:
                raise ValidationException("Invalid input data length")

            # Predict
            prediction = model.predict(input_data['imageData'])

            await websocket.send(json.dumps({
                'prediction': str(prediction[0])
            }))

    except websockets.exceptions.ConnectionClosed:
        logger.info("Predict websocket connection closed")
    except ValidationException as e:
        logger.error(f"Validation error: {e}")
        await websocket.send(json.dumps({
            'error': str(e)
        }))
    except Exception as e:
        logger.error(f"Error predicting: {e}")
        await websocket.send(json.dumps({
            'error': 'There was an unknown error'
        }))

async def start_predict_websocket_server():
    # Web socket for predict
    server = await websockets.serve(predict_websocket_handler, "0.0.0.0", PREDICT_WEBSOCKET_PORT)

    logger.info(f"Predict websocket server started on ws://localhost:{PREDICT_WEBSOCKET_PORT}")

    await server.wait_closed()

async def run_main():
    # Start the training progress websocket server
    asyncio.create_task(start_train_progress_websocket_server())
    # Start the predict websocket server
    asyncio.create_task(start_predict_websocket_server())

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