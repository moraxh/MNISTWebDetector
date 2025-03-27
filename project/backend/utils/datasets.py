from torchvision import datasets, transforms
from PIL import Image
import os

DATA_PATH = "data"

transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize(0.5, 0.5)])

def get_mnist():
    train_dataset = datasets.MNIST(root=f"{DATA_PATH}/datasets", train=True, download=True, transform=transform)
    test_dataset = datasets.MNIST(root=f"{DATA_PATH}/datasets", train=False, download=True, transform=transform)
    return train_dataset, test_dataset

def save_mnist_images(dataset, folder_name):
    save_path = os.path.join(DATA_PATH, folder_name)
    os.makedirs(save_path, exist_ok=True)

    for i, (image, label) in enumerate(dataset):
        image = transforms.ToPILImage()(image * 0.5 + 0.5)
        image.save(os.path.join(save_path, f"{label}_{i}.png"))

if __name__ == "__main__":
    train_ds, test_ds = get_mnist()
    save_mnist_images(train_ds, "train_images")
    save_mnist_images(test_ds, "test_images")
