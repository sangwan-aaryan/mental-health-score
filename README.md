# Mental Health Score

**Student Wellness Signal** is an informational web app that estimates a student wellness score from survey responses about daily habits and demographics. It combines a responsive HTML, CSS, and JavaScript frontend with a FastAPI API and a bundled scikit-learn model.

> **Important:** This project is an educational demonstration, not a diagnosis or clinical assessment. Do not use its estimates for clinical or other high-stakes decisions.

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: Not specified](https://img.shields.io/badge/License-not%20specified-lightgrey.svg)](#license)

## Contents

- [Features](#features)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Run with Docker](#run-with-docker)
- [API](#api)
- [Deploy to AWS App Runner](#deploy-to-aws-app-runner)
- [Model and limitations](#model-and-limitations)
- [Project files](#project-files)
- [License](#license)

## Features

- Responsive wellness check-in form with progress tracking and a sample response.
- Client- and server-side validation.
- Model estimate, non-clinical suggestions, training-range warnings, and a visual summary of submitted routines.
- Light and dark themes, plus browser print/save for results.
- Check-ins are not saved by the app.

## Technology

- Python 3.12, FastAPI, Pydantic
- pandas, joblib, and scikit-learn 1.9.0
- HTML, CSS, and vanilla JavaScript
- Docker; AWS App Runner and Amazon ECR for the documented deployment path

## Run locally

Use Python 3.12, which is also the runtime used by the Docker image.

1. Clone the repository and enter the project directory:

   ```powershell
   git clone https://github.com/sangwan-aaryan/mental-health-score.git
   cd mental-health-score
   ```

2. Install the Python dependencies:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. Start the API in one terminal:

   ```powershell
   python -m uvicorn main:app --reload --port 8000
   ```

4. Serve the frontend in a second terminal:

   ```powershell
   python -m http.server 5500
   ```

5. Open [http://localhost:5500](http://localhost:5500). The page connects to the API on port `8000`.

The API allows the local frontend origins by default. If you host the frontend on a different origin, set `CORS_ORIGINS` to a comma-separated list of allowed origins before starting the API.

## Run with Docker

From the project directory, build and run the container:

```powershell
docker build -t mental-health-score .
docker run --rm -p 8080:8080 mental-health-score
```

Open [http://localhost:8080](http://localhost:8080). The container serves the frontend and API from one origin. Its health endpoint is [http://localhost:8080/health](http://localhost:8080/health). The Docker image includes the app and model, but excludes the notebook and training CSV.

## API

When the API is running, interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Serves the frontend |
| `GET` | `/health` | Reports API and model availability |
| `POST` | `/predict` | Validates check-in data and returns an estimate |

Example request:

```json
{
  "age": 21,
  "gender": "Female",
  "country": "India",
  "academic_level": "Undergraduate",
  "most_used_platform": "Instagram",
  "purpose_of_use": "Entertainment",
  "avg_daily_usage_hours": 5,
  "daily_unlocks": 100,
  "study_hours": 3,
  "physical_activity_hours": 1,
  "sleep_hours_per_night": 7,
  "stress_level": "Medium"
}
```

The response contains `predicted_mental_health_score`, `interpretation`, `suggestions`, and `data_warnings`. The score is a model estimate, not a probability or clinical category.

## Deploy to AWS App Runner

The following path builds a Linux AMD64 container, pushes it to Amazon ECR, and runs it with AWS App Runner.

### Prerequisites

- An AWS account with permissions to create an ECR repository, push an image, and create an App Runner service.
- AWS CLI v2 configured locally with your own credentials or IAM Identity Center profile.
- Docker Desktop running with Linux containers enabled.

Never put AWS credentials in this repository or share them in an issue or chat. Choose an AWS Region and use it for both ECR and App Runner.

### Build and push the image

Run these commands in PowerShell from the project directory. Change the Region if needed. Create the ECR repository once; skip that command if it already exists.

```powershell
$AWS_REGION = "us-east-1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$ECR_REPO = "mental-health-score"
$IMAGE_URI = "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"

aws ecr create-repository --repository-name $ECR_REPO --region $AWS_REGION
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build --platform linux/amd64 -t "${ECR_REPO}:latest" .
docker tag "${ECR_REPO}:latest" "${IMAGE_URI}:latest"
docker push "${IMAGE_URI}:latest"
```

### Create the App Runner service

1. In the AWS Console, open **App Runner** in the same Region and select **Create service**.
2. Choose **Container registry** and **Amazon ECR**, then select the repository and image tag you pushed.
3. Configure or select an ECR access role so App Runner can pull the image. Automatic deployments are optional.
4. Set the container port to `8080` and the HTTP health-check path to `/health`.
5. Choose the access setting, review the estimated charges, and create the service.
6. When the service is running, open its App Runner URL. The frontend and prediction API share that HTTPS origin.

If you select public access, anyone with the service URL can use the app. It has no authentication, rate limiting, or persistent storage. Review [AWS App Runner pricing](https://aws.amazon.com/apprunner/pricing/) before creating a service.

## Model and limitations

The API loads `Mental_Health_Model.pkl` at startup. The notebook, `ML_Project.ipynb`, documents training and evaluation using `Student Social Media And Mental Health Impact.csv`. On the documented 70/30 split with `random_state=42`, the bundled model scored R² 0.9168, MAE 0.2712, and RMSE 0.3823. These are results from one held-out split and do not guarantee real-world accuracy.

The model reflects its source survey data and may not represent other populations or contexts. Some inputs outside the training data ranges produce a warning. A model estimate is not a probability or measure of an individual's mental health; do not use this app for diagnosis, treatment, or high-stakes decisions.

## Project files

| File | Description |
| --- | --- |
| `main.py` | FastAPI application, validation, and prediction endpoint |
| `index.html`, `style.css`, `script.js` | Frontend |
| `Mental_Health_Model.pkl` | Trained model loaded by the API |
| `ML_Project.ipynb` | Model exploration, training, and evaluation |
| `Student Social Media And Mental Health Impact.csv` | Dataset used by the notebook |
| `Dockerfile` | Container image configuration |

## License

No license is currently specified. Unless a license is added, all rights remain with the copyright holder; reuse and redistribution are not granted by this repository.
