# VendorConnect AI Service (Python FastAPI)

This microservice provides AI processing for VendorConnect artisans:
1. **AI Image Studio**: EXIF correction, automatic background removal, CLAHE lighting balancing, 1200x1200 white studio canvas.
2. **Multilingual Auto-Cataloger**: Speech-to-text transcription + LLM catalog generation (English & Hindi).
3. **Dynamic ML Pricing**: Machine learning price suggestion model.

---

## Windows PowerShell Setup Instructions

### 1. Create a Python Virtual Environment
Open PowerShell, navigate to the `ai-service` directory, and create a virtual environment:

```powershell
cd D:\mini_project1\ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
```

> **Note**: If you get a script execution policy restriction error in PowerShell, run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```
> and re-run `.\venv\Scripts\Activate.ps1`.

### 2. Install Dependencies
With your virtual environment active, install the pinned packages:

```powershell
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create your `ai-service/.env` file based on `.env.example`:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure:
* `AI_SERVICE_KEY`: A secure random string. **Must match `AI_SERVICE_KEY` in `backend/.env`**.
* `AI_MOCK=true`: Keep this as `true` initially so everything works without API keys or neural model downloads.
* Set `AI_MOCK=false` later when you want real background removal (`rembg`) and real external APIs.

> **Important**: When `AI_MOCK=false`, `rembg` will download its ~176 MB neural background model (`u2net`) on its first run.

### 4. Run the AI Microservice
Run the FastAPI application with Uvicorn:

```powershell
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The service will listen strictly on `http://127.0.0.1:8000`.

### 5. Verify Mock Pipeline
You can run the standalone test script anytime to test all three AI modules in mock mode without external API keys:

```powershell
.\venv\Scripts\python.exe test_mock.py
```

---

## Stage C: Dynamic ML Pricing Assistant

The ML pricing system predicts prices using a scikit-learn `GradientBoostingRegressor` trained on craft attributes (`category`, `rawMaterialsCost`, `laborHours`, description length, and craft keywords like silk, handwoven, brass, carved, silver, terracotta).

### Step 1: Export Products from MongoDB
To export your MongoDB Atlas catalog to a CSV dataset without sharing credentials:

```powershell
cd D:\mini_project1\backend
node scripts\export-products.js
```

This writes the dataset to `ai-service/data/products_export.csv`.

### Step 2: Train the Pricing Model
Navigate to `ai-service`:

```powershell
cd D:\mini_project1\ai-service
```

* **Production Training (Requires >= 50 real products)**:
  ```powershell
  .\venv\Scripts\python.exe train_price_model.py
  ```
  If fewer than 50 real products exist in your catalog, training will gracefully pause to prevent under-fitted predictions from misleading artisans.

* **Educational / Synthetic Bootstrap Mode**:
  If you have fewer than 50 products and want to evaluate the ML pipeline end-to-end for your academic report:
  ```powershell
  .\venv\Scripts\python.exe train_price_model.py --synthetic
  ```
  This will generate a synthetic dataset, calculate the 5-fold cross-validated MAE, serialize the model to `models/price_model.joblib`, and **explicitly label the predictions as SYNTHETIC** in the API response and vendor UI.

