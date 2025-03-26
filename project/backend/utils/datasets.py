from torchvision import datasets, transforms

DATA_PATH = "data/"

transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize(0.5, 0.5)])

def get_mnist():
    train_dataset = datasets.MNIST(root=f"{DATA_PATH}/datasets", train=True, download=True, transform=transform)
    test_dataset = datasets.MNIST(root=f"{DATA_PATH}/datasets", train=False, download=True, transform=transform)
    return train_dataset, test_dataset
