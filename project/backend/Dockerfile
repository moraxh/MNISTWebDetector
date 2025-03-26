FROM pytorch/pytorch:2.6.0-cuda11.8-cudnn9-devel

WORKDIR /app/backend

COPY requirements.txt .

EXPOSE 5001

RUN pip install --no-cache-dir -r requirements.txt