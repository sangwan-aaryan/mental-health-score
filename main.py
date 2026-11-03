import math
import os
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(__file__).resolve().with_name("Mental_Health_Model.pkl")
model = joblib.load(MODEL_PATH)

COUNTRY_CATEGORIES = [
    "Other", "India", "USA", "Canada", "Australia", "UK", "Germany",
    "Mexico", "Turkey", "France",
]
COUNTRY_LOOKUP = {country.casefold(): country for country in COUNTRY_CATEGORIES}

TRAINING_RANGES = {
    "age": (18, 24),
    "avg_daily_usage_hours": (1.0, 8.8),
    "daily_unlocks": (62, 273),
    "study_hours": (0.3, 8.3),
    "physical_activity_hours": (0.0, 4.1),
    "sleep_hours_per_night": (3.6, 9.9),
}

app = FastAPI(
    title="Student Wellness Signal API",
    description="An informational model estimate based on student survey data; not a clinical assessment.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500",
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class StudentData(BaseModel):
    age: int = Field(..., ge=10, le=100)
    gender: Literal["Male", "Female"]
    country: str = Field(..., min_length=2, max_length=80)
    academic_level: Literal["Undergraduate", "Graduate", "High School"]
    most_used_platform: Literal[
        "Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter", "YouTube",
        "TikTok", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat",
    ]
    purpose_of_use: Literal["Networking", "Education", "Entertainment", "News"]
    avg_daily_usage_hours: float = Field(..., ge=0, le=24, allow_inf_nan=False)
    daily_unlocks: int = Field(..., ge=0)
    study_hours: float = Field(..., ge=0, le=24, allow_inf_nan=False)
    physical_activity_hours: float = Field(..., ge=0, le=24, allow_inf_nan=False)
    sleep_hours_per_night: float = Field(..., ge=0, le=24, allow_inf_nan=False)
    stress_level: Literal["Medium", "Low", "Very High", "High"]


class PredictionResponse(BaseModel):
    predicted_mental_health_score: float
    interpretation: str
    suggestions: list[str]
    data_warnings: list[str]


def get_suggestions(data: StudentData) -> list[str]:
    suggestions = []
    if data.stress_level in ("High", "Very High"):
        suggestions.append(
            "Your reported stress is high. Consider a short reset and reaching out to someone you trust."
        )
    if data.sleep_hours_per_night < 7:
        suggestions.append(
            "You reported under 7 hours of sleep. A consistent wind-down routine may help support rest."
        )
    if data.avg_daily_usage_hours > 6:
        suggestions.append(
            "Your screen-time estimate is above 6 hours. Try a screen-free break or review app notifications."
        )
    if data.physical_activity_hours < 0.5:
        suggestions.append(
            "If it works for you, adding a brief movement break to your day may support your routine."
        )
    if not suggestions:
        suggestions.append(
            "Keep noticing how your routines affect you, and maintain the habits that feel supportive."
        )
    return suggestions[:3]


def get_data_warnings(data: StudentData) -> list[str]:
    warnings = []
    for field, (minimum, maximum) in TRAINING_RANGES.items():
        value = getattr(data, field)
        if value < minimum or value > maximum:
            label = field.replace("_", " ")
            warnings.append(
                f"{label.capitalize()} is outside the training data range "
                f"({minimum:g}–{maximum:g}); this estimate may be less reliable."
            )
    return warnings


@app.get("/")
def greet():
    return FileResponse(APP_DIR / "index.html")


@app.get("/style.css", include_in_schema=False)
def serve_stylesheet():
    return FileResponse(APP_DIR / "style.css", media_type="text/css")


@app.get("/script.js", include_in_schema=False)
def serve_script():
    return FileResponse(APP_DIR / "script.js", media_type="application/javascript")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    normalized_country = data.country.strip()
    if not normalized_country:
        raise HTTPException(status_code=422, detail="Country must not be blank.")
    grouped_country = COUNTRY_LOOKUP.get(normalized_country.casefold(), "Other")

    input_row = pd.DataFrame([{
        "Age": data.age,
        "Gender": data.gender,
        "Academic_Level": data.academic_level,
        "Most_Used_Platform": data.most_used_platform,
        "Purpose_Of_Use": data.purpose_of_use,
        "Avg_Daily_Usage_Hours": data.avg_daily_usage_hours,
        "Daily_Unlocks": data.daily_unlocks,
        "Study_Hours": data.study_hours,
        "Physical_Activity_Hours": data.physical_activity_hours,
        "Sleep_Hours_Per_Night": data.sleep_hours_per_night,
        "Stress_Level": data.stress_level,
        "Grouped_country": grouped_country,
    }])

    prediction = float(model.predict(input_row)[0])
    if not math.isfinite(prediction):
        raise HTTPException(status_code=503, detail="The model returned an invalid score.")

    return PredictionResponse(
        predicted_mental_health_score=round(prediction, 2),
        interpretation="Model estimate from survey patterns; not a clinical category.",
        suggestions=get_suggestions(data),
        data_warnings=get_data_warnings(data),
    )
