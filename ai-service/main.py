"""
VendorConnect AI Microservice (FastAPI)
----------------------------------------
Provides high-performance AI processing for Indian artisans:
- Studio Image Enhancement (EXIF correction, background removal, lighting balance, 1200x1200 square canvas)
- Multilingual Voice & Text Cataloger (Hindi/English transcript, translation, SEO)
- Dynamic ML Pricing Assistant

Runs strictly on 127.0.0.1:8000 and requires X-Service-Key authentication from Express gateway.
"""

import os
from dotenv import load_dotenv
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Depends, status
from fastapi.responses import Response, JSONResponse
from services.image_enhancer import enhance_product_image
from services.stt_service import transcribe_audio
from services.llm_service import generate_product_catalog
from services.ml_pricing import predict_price_ml

# Load environment configuration
load_dotenv()

EXPECTED_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "your_shared_service_secret_key_here")
AI_MOCK = os.getenv("AI_MOCK", "true").strip().lower() in ("true", "1", "yes")

app = FastAPI(
    title="VendorConnect AI Service",
    description="Artisan Marketplace AI Microservice",
    version="1.0.0"
)


def verify_service_key(x_service_key: str = Header(None, alias="X-Service-Key")):
    """
    Security check: Rejects requests from outside the Express gateway.
    Both services share the secret key configured in their respective .env files.
    """
    if not x_service_key or x_service_key != EXPECTED_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Service-Key header"
        )
    return True


@app.get("/health")
def health_check():
    """Health check endpoint to verify AI service status and configuration."""
    return {
        "status": "healthy",
        "mock_mode": AI_MOCK,
        "service": "VendorConnect AI Service"
    }


@app.post("/enhance-image")
async def enhance_image(
    image: UploadFile = File(...),
    authenticated: bool = Depends(verify_service_key)
):
    """
    Accepts raw artisan photo, removes background, corrects lighting,
    and returns a clean 1200x1200 white-canvas WebP image.
    """
    try:
        # Read uploaded image bytes
        image_bytes = await image.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file received")

        # Process image through enhancement pipeline
        enhanced_bytes = enhance_product_image(image_bytes, mock_mode=AI_MOCK)

        return Response(content=enhanced_bytes, media_type="image/webp")
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Image processing failed: {str(e)}"}
        )


@app.post("/catalog")
async def catalog_endpoint(
    audio: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    authenticated: bool = Depends(verify_service_key)
):
    """
    Multilingual cataloging pipeline:
    1. Transcribes voice audio if provided (deletes from memory immediately).
    2. Passes text/transcript through prompt-injection defended LLM generator.
    3. Validates, sanitizes, and returns strict JSON schema (English + Hindi, category enum, keywords).
    """
    try:
        transcript = ""
        detected_lang = language or "en"

        # Process audio if provided
        if audio is not None:
            audio_bytes = await audio.read()
            if len(audio_bytes) > 0:
                stt_result = transcribe_audio(audio_bytes, filename=audio.filename or "recording.webm", language_hint=language)
                transcript = stt_result.get("transcript", "")
                detected_lang = stt_result.get("detectedLanguage", language or "hi")
            # Audio bytes naturally discarded from memory here

        raw_text = (text or "").strip()
        if not raw_text and not transcript:
            raise HTTPException(status_code=400, detail="At least voice audio or description text is required")

        # Generate catalog using configured adapter
        catalog = generate_product_catalog(raw_text=raw_text, transcript=transcript, detected_lang=detected_lang)
        return catalog
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Catalog generation failed: {str(e)}"}
        )


class PricePredictionRequest(BaseModel):
    category: str
    rawMaterialsCost: float = 0.0
    laborHours: float = 0.0
    description: Optional[str] = ""


@app.post("/predict-price")
def predict_price_endpoint(
    req: PricePredictionRequest,
    authenticated: bool = Depends(verify_service_key)
):
    """
    Stage C Machine Learning price prediction using GradientBoostingRegressor.
    """
    result = predict_price_ml(
        category=req.category,
        raw_materials_cost=req.rawMaterialsCost,
        labor_hours=req.laborHours,
        description=req.description or ""
    )
    return result


if __name__ == "__main__":
    import uvicorn
    # Listens strictly on 127.0.0.1 (never expose directly to the public internet)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
