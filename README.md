# Student Wellness Signal

An informational web app that estimates a student mental-health score from a survey-style set of habits and demographics. This is a machine-learning demonstration, not a diagnosis or clinical assessment.

## Run locally

1. Install the packages in `requirements.txt` with `python -m pip install -r requirements.txt`.
2. Start the API from this folder:

   ```powershell
   python -m uvicorn main:app --reload --port 8000
   ```

3. In a second terminal, serve the frontend:

   ```powershell
   python -m http.server 5500
   ```

4. Open `http://localhost:5500` in a browser. The frontend checks `/health` and submits predictions to the API on port 8000.

If the frontend is served from a different origin, set `CORS_ORIGINS` to a comma-separated list of allowed origins before starting the API.

## Deploy to AWS App Runner

The Docker image runs the FastAPI API and serves the frontend from the same origin. It listens on port `8080`, loads the bundled model at startup, and exposes `/health` for health checks. The image intentionally excludes the notebook and training CSV.

### Prerequisites

- An AWS account with permissions to create and push to an Amazon ECR repository and create an App Runner service.
- AWS CLI v2 configured with your own credentials (`aws configure` or an AWS IAM Identity Center profile).
- Docker Desktop running.

Do not share AWS access keys or commit them to this project. Select an AWS Region close to your users; ECR and App Runner must use the same Region.

### Build and push the image (PowerShell)

Run these commands from the project directory. Change the Region if needed. Create the ECR repository only once:

```powershell
$AWS_REGION = "us-east-1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$ECR_REPO = "student-wellness-signal"
$IMAGE_URI = "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"

aws ecr create-repository --repository-name $ECR_REPO --region $AWS_REGION
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build --platform linux/amd64 -t student-wellness-signal:latest .
docker tag student-wellness-signal:latest "${IMAGE_URI}:latest"
docker push "${IMAGE_URI}:latest"
```

For later releases, rebuild and push the image again. If the repository already exists, skip `aws ecr create-repository`.

### Create the App Runner service

1. In the AWS Console, open **App Runner** in the same Region and choose **Create service**.
2. Select **Container registry** → **Amazon ECR**, then choose the `student-wellness-signal` repository and `latest` image.
3. If prompted, create/select an ECR access role so App Runner can pull the image. Enable automatic deployments if you want pushes to `latest` to deploy automatically.
4. Configure the service to listen on port `8080`. Configure an HTTP health check at `/health`.
5. Choose whether the service is publicly accessible, review the estimated charges, and create the service.
6. When the service reports **Running**, open its App Runner URL. The page and `/predict` API use HTTPS on the same origin; no frontend URL or CORS configuration is needed.

The App Runner URL is public if public access is selected. This demo does not authenticate users or persist check-ins, and its model output is not a diagnosis or suitable for clinical or other high-stakes decisions. Review the [App Runner pricing](https://aws.amazon.com/apprunner/pricing/) before creating the service.

## Frontend features

- Responsive wellness check-in with completion tracking and a one-click example.
- Accessible stress-level controls, field-level validation, and light/dark themes.
- Results show the model estimate, API suggestions, out-of-range data caveats, and a visual summary of the submitted routine.
- Use **Save / print** to print or save the result from your browser. The page does not keep a check-in history.

## Model and accuracy

The API loads `Mental_Health_Model.pkl` from this project directory. On the notebook's 70/30 split with `random_state=42`, the bundled model scored R² 0.9168, MAE 0.2712, and RMSE 0.3823. These are results from one held-out split, not a guarantee of real-world accuracy. To reproduce the model from the CSV, run `ML_Project.ipynb` from top to bottom. The notebook compares default and tuned random forests with 5-fold cross-validation on training data, reports holdout metrics, then exports the model with the better cross-validation score. The API maps countries into the same `Grouped_country` feature used during training and flags numeric inputs outside the dataset's observed ranges.

An estimate is not a probability or a measure of an individual's mental health. Model quality depends on the source dataset and its representativeness; do not use this app for clinical or high-stakes decisions.
