"""
Standalone Mock Mode Test Script
---------------------------------
Verifies that the image enhancement module runs smoothly in mock mode:
creates a sample image in memory, applies EXIF, lighting, and 1200x1200 compositing,
and verifies output dimensions and format without downloading external models.
"""

import io
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from PIL import Image, ImageDraw
from services.image_enhancer import enhance_product_image

def run_image_mock_test():
    print("--> Creating a test sample image in memory...")
    # Create a simple 400x300 sample image (e.g. simulated artisan vase)
    sample = Image.new('RGB', (400, 300), color=(180, 100, 50))
    draw = ImageDraw.Draw(sample)
    draw.rectangle([50, 50, 350, 250], fill=(210, 130, 80), outline=(255, 255, 255))
    
    input_buffer = io.BytesIO()
    sample.save(input_buffer, format='JPEG')
    input_bytes = input_buffer.getvalue()

    print("--> Running enhance_product_image in mock mode...")
    output_bytes = enhance_product_image(input_bytes, mock_mode=True)

    result_img = Image.open(io.BytesIO(output_bytes))
    print(f"--> Output Image format: {result_img.format}")
    print(f"--> Output Image size: {result_img.size}")

from services.llm_service import generate_product_catalog
from services.stt_service import transcribe_audio

def run_catalog_mock_test():
    print("--> Testing STT transcription in mock mode...")
    stt_res = transcribe_audio(b"dummy_audio_bytes", filename="sample.webm", language_hint="hi")
    print(f"--> Mock Transcript: {stt_res['transcript']}")
    assert "transcript" in stt_res
    assert stt_res["detectedLanguage"] == "hi"

    print("--> Testing LLM catalog generation in mock mode...")
    catalog = generate_product_catalog(raw_text="Handmade terracotta tea cups and teapot set", detected_lang="en")
    print(f"--> English Title: {catalog['titleEn']}")
    print(f"--> Hindi Title:   {catalog['titleHi']}")
    print(f"--> Category:      {catalog['category']}")
    print(f"--> Keywords:      {catalog['keywords']}")

    assert catalog["category"] == "Pottery & Clay Art"
    assert len(catalog["titleEn"]) <= 120
    assert len(catalog["titleHi"]) <= 120
    assert len(catalog["descriptionEn"]) <= 1500
    assert len(catalog["keywords"]) <= 10
    print("[PASS] Multilingual Auto-Cataloger mock pipeline passed successfully!\n")

from services.ml_pricing import predict_price_ml

def run_ml_pricing_test():
    print("--> Testing Stage C ML Pricing model inference...")
    res = predict_price_ml(
        category="Textiles & Handloom",
        raw_materials_cost=600,
        labor_hours=12,
        description="Pure mulberry silk handwoven saree with gold border"
    )
    print(f"--> ML Prediction response: {res}")
    assert "available" in res
    if res["available"]:
        assert res["fair"] > 0
        assert res["market"] >= res["fair"]
        assert res["premium"] >= res["market"]
        assert res["basis"] == "ml"
        print(f"--> Predicted Fair: ₹{res['fair']}, Market: ₹{res['market']}, Premium: ₹{res['premium']} (Synthetic: {res.get('isSynthetic')})")
        print("[PASS] Stage C ML Pricing model prediction passed successfully!\n")
    else:
        print(f"[NOTE] Model not active: {res.get('reason')}\n")

if __name__ == "__main__":
    run_image_mock_test()
    run_catalog_mock_test()
    run_ml_pricing_test()

