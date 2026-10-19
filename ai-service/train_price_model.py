"""
Stage C: Machine Learning Price Model Trainer
---------------------------------------------
Trains a scikit-learn GradientBoostingRegressor on artisan product records.
Uses feature engineering: category, materials cost, labor hours, description length,
and specific artisan craft keyword flags.

Security & Honesty Rules:
- Requires at least 50 real rows to activate for production.
- If fewer than 50 rows exist and --synthetic is passed, it generates bootstrap
  educational data but marks the model permanently as SYNTHETIC in metadata, logs, and API.
"""

import os
import sys
import argparse
import random
from datetime import datetime
import numpy as np

# Ensure UTF-8 console output for Windows PowerShell
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import joblib
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.feature_extraction import DictVectorizer
from sklearn.pipeline import Pipeline

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "products_export.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_FILE = os.path.join(MODEL_DIR, "price_model.joblib")

CATEGORIES = [
    'Textiles & Handloom',
    'Pottery & Clay Art',
    'Woodcraft',
    'Handmade Jewelry',
    'Jewelry',
    'Bamboo & Cane',
    'Metal & Brass Work',
    'Handmade Paintings',
    'Other'
]


def generate_synthetic_data(num_samples: int = 150):
    """
    Generates synthetic bootstrap data for educational testing when the real database
    has fewer than 50 products.
    """
    print("\n" + "=" * 75)
    print("[WARNING: SYNTHETIC DATA BOOTSTRAP]")
    print("Generating synthetic artisan records for educational algorithm evaluation.")
    print("IMPORTANT: Synthetic data CANNOT represent real consumer market trends!")
    print("The trained model will be explicitly flagged as SYNTHETIC in all API responses.")
    print("=" * 75 + "\n")

    synthetic_rows = []
    base_costs = {
        'Textiles & Handloom': (400, 1800, 12, 90),
        'Pottery & Clay Art': (150, 600, 6, 80),
        'Woodcraft': (500, 2500, 15, 95),
        'Handmade Jewelry': (300, 1500, 8, 100),
        'Jewelry': (300, 1500, 8, 100),
        'Bamboo & Cane': (120, 500, 7, 75),
        'Metal & Brass Work': (600, 3000, 18, 100),
        'Handmade Paintings': (250, 1200, 10, 90),
        'Other': (200, 1000, 8, 80)
    }

    random.seed(42)
    for _ in range(num_samples):
        cat = random.choice(CATEGORIES)
        min_mat, max_mat, avg_hrs, rate = base_costs[cat]

        mat_cost = round(random.uniform(min_mat, max_mat), 2)
        hours = max(1, round(random.gauss(avg_hrs, 4), 1))
        desc_len = random.randint(80, 600)

        # Craft keywords
        is_silk = 1 if cat == 'Textiles & Handloom' and random.random() > 0.4 else 0
        is_handwoven = 1 if cat in ['Textiles & Handloom', 'Bamboo & Cane'] and random.random() > 0.3 else 0
        is_brass = 1 if cat == 'Metal & Brass Work' and random.random() > 0.3 else 0
        is_carved = 1 if cat in ['Woodcraft', 'Pottery & Clay Art'] and random.random() > 0.4 else 0
        is_silver = 1 if 'Jewelry' in cat and random.random() > 0.5 else 0
        is_terracotta = 1 if cat == 'Pottery & Clay Art' and random.random() > 0.4 else 0

        # Cost-plus floor with craft premium noise
        direct_cost = mat_cost + (hours * rate)
        markup = random.uniform(1.3, 1.9)
        price = round(direct_cost * markup + (is_silk * 400) + (is_silver * 600) + (is_carved * 300))

        synthetic_rows.append({
            'category': cat,
            'rawMaterialsCost': mat_cost,
            'laborHours': hours,
            'descriptionLength': desc_len,
            'isSilk': is_silk,
            'isHandwoven': is_handwoven,
            'isBrass': is_brass,
            'isCarved': is_carved,
            'isSilver': is_silver,
            'isTerracotta': is_terracotta,
            'price': max(100, price)
        })

    return synthetic_rows


def load_real_data(csv_path: str):
    """Loads CSV exported by backend/scripts/export-products.js"""
    if not os.path.exists(csv_path):
        return None

    import csv
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                rows.append({
                    'category': r['category'],
                    'rawMaterialsCost': float(r.get('rawMaterialsCost', 0) or 0),
                    'laborHours': float(r.get('laborHours', 0) or 0),
                    'descriptionLength': int(r.get('descriptionLength', 0) or 0),
                    'isSilk': int(r.get('isSilk', 0) or 0),
                    'isHandwoven': int(r.get('isHandwoven', 0) or 0),
                    'isBrass': int(r.get('isBrass', 0) or 0),
                    'isCarved': int(r.get('isCarved', 0) or 0),
                    'isSilver': int(r.get('isSilver', 0) or 0),
                    'isTerracotta': int(r.get('isTerracotta', 0) or 0),
                    'price': float(r['price'])
                })
            except (ValueError, KeyError):
                continue
    return rows


def train_model(use_synthetic: bool = False):
    print("--> Preparing Stage C Pricing Model Training...")

    real_data = load_real_data(DATA_FILE)
    real_count = len(real_data) if real_data else 0

    print(f"--> Found {real_count} real records in {DATA_FILE}")

    is_synthetic = False
    if real_count >= 50:
        print(f"[OK] Sufficient real rows ({real_count} >= 50). Training production model on real data.")
        dataset = real_data
    elif use_synthetic:
        print(f"[BOOTSTRAP] Fewer than 50 real rows ({real_count} < 50). Using synthetic dataset as requested.")
        dataset = generate_synthetic_data(num_samples=180)
        is_synthetic = True
    else:
        print("\n[STOP] Insufficient real data (< 50 real products).")
        print("To protect artisans from inaccurate pricing, the production model will not activate.")
        print("To train a synthetic bootstrap model for educational verification, run:")
        print("   python train_price_model.py --synthetic\n")
        return None

    # Prepare feature dictionaries and target array
    feature_keys = [
        'category',
        'rawMaterialsCost',
        'laborHours',
        'descriptionLength',
        'isSilk',
        'isHandwoven',
        'isBrass',
        'isCarved',
        'isSilver',
        'isTerracotta'
    ]

    X_dicts = [{k: row[k] for k in feature_keys} for row in dataset]
    y = np.array([float(row['price']) for row in dataset])

    model_pipeline = Pipeline(steps=[
        ('vectorizer', DictVectorizer(sparse=False)),
        ('regressor', GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.08,
            max_depth=4,
            random_state=42
        ))
    ])

    # Cross-validation MAE
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(model_pipeline, X_dicts, y, cv=kf, scoring='neg_mean_absolute_error')
    cv_mae = round(-float(np.mean(scores)), 2)

    print(f"--> Cross-Validated 5-Fold MAE (Mean Absolute Error): ₹{cv_mae}")

    # Train final model on full dataset
    model_pipeline.fit(X_dicts, y)

    # Save model artifact and provenance metadata
    os.makedirs(MODEL_DIR, exist_ok=True)
    artifact = {
        'pipeline': model_pipeline,
        'metadata': {
            'mae': cv_mae,
            'is_synthetic': is_synthetic,
            'training_samples': len(dataset),
            'trained_at': datetime.utcnow().isoformat(),
            'algorithm': 'GradientBoostingRegressor (scikit-learn)'
        }
    }

    joblib.dump(artifact, MODEL_FILE)
    print(f"[SUCCESS] Model saved to: {MODEL_FILE}")
    print(f"Provenance: is_synthetic={is_synthetic}, samples={len(dataset)}, MAE=₹{cv_mae}\n")
    return artifact



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Stage C Gradient Boosting Price Model")
    parser.add_argument("--synthetic", action="store_true", help="Generate synthetic bootstrap data if real rows < 50")
    args = parser.parse_args()

    train_model(use_synthetic=args.synthetic)
