# Razorpay Payment Gateway Integration — VendorConnect

This backend integrates the official **Razorpay Standard Checkout** with secure server-side order creation and cryptographic signature verification.

---

## 1. Environment Configuration

Copy or edit `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/vendorconnect
JWT_SECRET=your_jwt_secret_key_here

# Razorpay Test API Keys (switches automatically to live Razorpay Test Checkout when set)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret

# Optional Local Demo Simulator (active only when API keys above are blank)
RAZORPAY_DEMO_MODE=true
```

### Obtaining Razorpay Test Keys
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Switch to **Test Mode** (toggle on the top nav).
3. Navigate to **Account & Settings** -> **API Keys**.
4. Generate or view your **Key ID** (`rzp_test_...`) and **Key Secret**.
5. Paste them into `backend/.env`.

> **Security Note:** The `RAZORPAY_KEY_SECRET` is used exclusively on the server to compute and verify HMAC-SHA256 signatures. It is never exposed in the client-side code or network responses. The frontend receives only the public `keyId`.

---

## 2. Running & Testing

### Running Tests
Execute the automated integration test suite:
```powershell
cd backend
npm test
```
This tests signature validation, order creation, payment capture, idempotency, inventory reservation & restoration, and vendor order isolation.

### Starting the Server
```powershell
cd backend
npm run dev
# or: npm start
```

---

## 3. How the Payment Flow Works

```
[Buyer: cart.html] ──── (1) POST /api/orders { paymentMethod: 'Razorpay' } ────> [Backend]
                                                                                   │ Creates Razorpay Order
                                                                                   │ Holds stock ('Awaiting Payment')
[Buyer: cart.html] <─── (2) { razorpay: { keyId, orderId, amount } } ──────────────┘
       │
       ▼ Opens Razorpay Popup Modal
[Razorpay Checkout] ── (3) Buyer pays with Test Card / UPI
       │
       ▼ Success handler callback { razorpay_order_id, razorpay_payment_id, razorpay_signature }
[Buyer: cart.html] ──── (4) POST /api/orders/razorpay/verify ───────────────────> [Backend]
                                                                                   │ Cryptographic HMAC verify
                                                                                   │ Confirms capture
                                                                                   │ Status -> 'Placed'
                                                                                   │ Payment -> 'Completed'
[Buyer: orders.html] <─ (5) 200 OK (Cart cleared, redirect to orders) ─────────────┘
```

### Abandonment / Dismissal Handling
If the buyer closes the Razorpay popup modal without completing payment:
1. `cart.html` calls `POST /api/orders/razorpay/cancel`.
2. The backend cancels the temporary order (`orderStatus: 'Cancelled'`, `paymentStatus: 'Failed'`).
3. Reserved inventory stock is atomically returned to the product document.
4. The buyer's cart remains intact so they can retry or select Cash on Delivery.

---

## 4. Razorpay Test Credentials (Test Mode)

| Method | Test Details |
|---|---|
| **Test Cards** | Card Number: `4111 1111 1111 1111` (or any Visa/Mastercard test card)<br>Expiry: Any future date (e.g. `12/30`)<br>CVV: `123`<br>OTP: `123456` or click "Success" in sandbox window |
| **UPI** | Virtual Payment Address (VPA): `success@razorpay` (or click "Success") |
| **Net Banking** | Select any bank (e.g., SBI, HDFC) and click "Success" |
