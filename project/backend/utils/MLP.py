import os
import logging
import coloredlogs
import json
import torch
import torch.nn as nn
import torch.optim as optim
import matplotlib.pyplot as plt
from torch.cuda import is_available
from torch.utils.data import DataLoader
from .datasets import DATA_PATH
from .datasets import get_mnist

# Configure coloredlogs
logger = logging.getLogger(__name__)
coloredlogs.install(level='INFO', logger=logger, fmt='%(asctime)s [%(levelname)s] %(message)s', datefmt='%I:%M:%S %p', isatty=True)

# Create the data directory if it doesn't exist
if not os.path.exists(DATA_PATH):
    os.makedirs(DATA_PATH)

# Hyperparameters
INPUT_SIZE = 28**2
HIDDEN_SIZE = 256
OUTPUT_SIZE = 10
BATCH_SIZE = 128

# Dataset
train_ds, test_ds = get_mnist()
train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=True)

def get_device():
    return 'cuda' if is_available() else 'cpu'

# Get the device (GPU if available, otherwise CPU)
device = get_device()
logger.info(f"Using device: {device}")

class MLP(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super(MLP, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, output_size)
        self.dp = nn.Dropout(0.1)
        self.relu = nn.ReLU()
        self.history = {'train_loss': [], 'val_loss': []}
        self.total_epochs = 0
        self.current_epoch = 0
        self.is_model_trained = False

    def forward(self, x):
        x = x.view(x.size(0), -1)
        x = self.fc1(x)
        x = self.relu(x)
        x = self.dp(x)
        x = self.fc2(x)
        return x

    def fit(self, train_loader=train_loader, test_loader=test_loader, epochs=50, learning_rate=0.01):
        self.total_epochs = epochs
        loss_function = nn.CrossEntropyLoss()

        optimizer = optim.Adam(self.parameters(), lr=learning_rate)

        for epoch in range(epochs):
            self.current_epoch = epoch
            self.train()
            epoch_loss = 0.0
            for batch_X, batch_y in train_loader:
                # Move the data to the GPU if available
                batch_X = batch_X.to(device)
                batch_y = batch_y.to(device)

                optimizer.zero_grad()  # Reinitialize gradients
                outputs = self(batch_X)  # Forward pass
                loss = loss_function(outputs, batch_y) # Calculate loss
                loss.backward()  # Backward -> calculate gradients
                optimizer.step()  # Update parameters
                epoch_loss += loss.item()

            # Calculate average loss per epoch
            train_loss = epoch_loss / len(train_loader)
            self.history['train_loss'].append(train_loss)

            # Validation
            self.eval()
            val_loss = 0.0
            with torch.no_grad():
                for batch_X, batch_y in test_loader:
                    # Move the data to the GPU if available
                    batch_X = batch_X.to(device)
                    batch_y = batch_y.to(device)

                    val_output = model(batch_X)
                    batch_loss = loss_function(val_output, batch_y).item()
                    val_loss += batch_loss

            val_loss = val_loss / len(test_loader)
            self.history['val_loss'].append(val_loss)

            logger.info(f"Epoch {epoch+1}/{epochs}, Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")

        self.is_model_trained = True
        # self.plot_loss()
    
    def get_training_progress(self):
        return {
            'is_model_trained': self.is_model_trained,
            'current_epoch': self.current_epoch,
            'total_epochs': self.total_epochs,
            'train_loss': self.history['train_loss'],
            'val_loss': self.history['val_loss'],
        }

    def predict(self, X):
        self.eval()
        with torch.no_grad():
            if isinstance(X, list):
                X = torch.tensor(X, dtype=torch.float32)
            if X.dim() == 1:
                X = X.view(-1, 28, 28)
            # Normalize
            X = X / 255.0
            X = (X - 0.5) / 0.5
            X = X.to(device)
            outputs = self(X)
            _, predicted = torch.max(outputs, 1)
        return predicted.cpu().numpy()
    
    def save_trained_model(self, model_path, model_info_path):
        # Save the model
        torch.save(self.state_dict(), model_path)

        # Save the training information
        training_info = {
            'total_epochs': self.total_epochs,
            'current_epoch': self.current_epoch,
            'train_loss': self.history['train_loss'],
            'val_loss': self.history['val_loss']
        }
        with open(model_info_path, 'w') as f:
            json.dump(training_info, f)

        logger.info(f"Model saved to {model_path}")
        logger.info(f"Model info saved to {model_info_path}")

    def load_trained_model(self, model_path, model_info_path):
        # Load the model
        map_location = torch.device('cpu') if not is_available() else torch.device('cuda')
        self.load_state_dict(torch.load(model_path, map_location=map_location))
        self.eval()
        self.is_model_trained = True

        # Load the training information
        with open(model_info_path, 'r') as f:
            training_info = json.load(f)
        self.total_epochs = training_info['total_epochs']
        self.current_epoch = training_info['current_epoch']
        self.history['train_loss'] = training_info['train_loss']
        self.history['val_loss'] = training_info['val_loss']

        logger.info(f"Model loaded from {model_path}")
        logger.info(f"Model info loaded from {model_info_path}")

    def plot_loss(self):
        if (len(self.history['train_loss']) == 0 or len(self.history['val_loss']) == 0):
            logger.warning("No hay historial de pérdidas para graficar.")
            return

        plt.figure()
        plt.plot(self.history['train_loss'], label='Train Loss')
        plt.plot(self.history['val_loss'], label='Val Loss')
        plt.xlabel('Epochs')
        plt.ylabel('Loss')
        plt.legend()
        plt.show()


# Create the model and move it to the GPU
model = MLP(INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE)
model.to(device)

if __name__ == '__main__':
    model.fit()