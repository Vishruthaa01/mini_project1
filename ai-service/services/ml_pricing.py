"""
Stage C: Machine Learning Price Inference Service
-------------------------------------------------
Loads the serialized GradientBoostingRegressor pipeline and predicts market prices
for artisan products based on craft features.

Ensures:
- Real data threshold: if real samples < 50, model is inactive unless explicitly synthetic.
- Clear synthetic labeling in response so the UI and artisan know if predictions come from bootstrap data.
- Cost-floor protection so ML suggestions never undercut break-even artisan cost.
"""

import os
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "price_model.joblib")

_model_cache = None


def load_model():
    """Loads model from disk with caching."""
    global _model_cache
    if not os.path.exists(MODEL_PATH):
        return None

    try:
        _model_cache = joblib.load(MODEL_PATH)
        return _model_cache
    except Exception as e:
        print(f"Failed to load price model: {e}")
        return None


def predict_price_ml(category: str, raw_materials_cost: float, labor_hours: float, description: str = ""):
    """
    Predicts artisan product pricing tiers using trained ML Gradient Boosting Regressor.
    """
    model_data = load_model()
    if not model_data:
        return {
            "available": False,
            "reason": "Model file not found. Train the model using train_price_model.py first."
        }

    pipeline = model_data.get("pipeline")
    metadata = model_data.get("metadata", {})
    is_synthetic = metadata.get("is_synthetic", False)
    training_samples = metadata.get("training_samples", 0)
    mae = metadata.get("mae", 0.0)

    # Threshold rule: must have at least 50 samples
    if training_samples < 50:
        return {
            "available": False,
            "reason": f"Model was trained on only {training_samples} samples. Minimum 50 samples required."
        }

    desc_lower = (description or "").lower()

    # Extract feature dictionary matching training features
    feature_dict = {
        'category': category or 'Other',
        'rawMaterialsCost': float(raw_materials_cost or 0),
        'laborHours': float(labor_hours or 0),
        'descriptionLength': len(description or ""),
        'isSilk': 1 if 'silk' in desc_lower or 'रेशम' in desc_lower else 0,
        'isHandwoven': 1 if any(w in desc_lower for w in ['handwoven', 'हथकरघा', 'बुना']) else 0,
        'isBrass': 1 if 'brass' in desc_lower or 'पीतल' in desc_lower else 0,
        'isCarved': 1 if 'carved' in desc_lower or 'नक्काशी' in desc_lower else 0,
        'isSilver': 1 if 'silver' in desc_lower or 'चांदी' in desc_lower else 0,
        'isTerracotta': 1 if any(w in desc_lower for w in ['terracotta', 'clay', 'मिट्टी']) else 0
    }

    try:
        predicted = float(pipeline.predict([feature_dict])[0])
    except Exception as e:
        return {
            "available": False,
            "reason": f"Prediction inference error: {str(e)}"
        }

    # Artisan cost protection: never suggest below direct cost + 15% minimum margin
    cost_floor = (float(raw_materials_cost or 0) + (float(labor_hours or 0) * 80)) * 1.15
    base_prediction = max(cost_floor, predicted)

    fair = round(max(cost_floor, base_prediction * 0.88))
    market = round(max(fair, base_prediction))
    premium = round(max(market + 50, base_prediction * 1.28))

    return {
        "available": True,
        "fair": fair,
        "market": market,
        "premium": premium,
        "basis": "ml",
        "isSynthetic": is_synthetic,
        "trainingSamples": training_samples,
        "mae": mae
    }
