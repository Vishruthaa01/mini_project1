/* =========================================================
   SCROLL & NAVIGATION HELPERS
========================================================= */

function scrollToSection(id){
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({
            behavior: "smooth"
        });
    } else {
        window.location.href = `index.html#${id}`;
    }
}


/* =========================================================
   TOAST NOTIFICATIONS
========================================================= */

function showToast(message){
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "25px";
    toast.style.right = "25px";
    toast.style.background = "#241b2f";
    toast.style.color = "white";
    toast.style.padding = "14px 18px";
    toast.style.borderRadius = "10px";
    toast.style.zIndex = "1000";
    toast.style.fontSize = "13px";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";

    document.body.appendChild(toast);

    setTimeout(function(){
        toast.remove();
    }, 2500);
}


/* =========================================================
   MODAL DIALOGS
========================================================= */

function openModal(content){
    const modalContent = document.getElementById("modalContent");
    const modal = document.getElementById("modal");
    if (modalContent && modal) {
        modalContent.innerHTML = content;
        modal.classList.add("active");
    }
}

function closeModal(){
    const modal = document.getElementById("modal");
    if (modal) {
        modal.classList.remove("active");
    }
}


/* =========================================================
   AUTHENTICATION & USER STATE SYSTEM
========================================================= */

const STORAGE_USERS_KEY = "artisan_users";
const STORAGE_CURRENT_USER_KEY = "artisan_current_user";
const STORAGE_PRODUCTS_KEY = "artisan_published_products";

// Default demo user account
const DEFAULT_USERS = [
    {
        name: "Lakshmi Devi",
        identifier: "artisan@example.com",
        phone: "9876543210",
        craft: "Textile",
        password: "password123"
    }
];

function getStoredUsers() {
    const data = localStorage.getItem(STORAGE_USERS_KEY);
    if (!data) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
    }
    try {
        return JSON.parse(data);
    } catch(e) {
        return DEFAULT_USERS;
    }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    const data = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch(e) {
        return null;
    }
}

function setCurrentUser(user) {
    if (user) {
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    }
    updateAuthUI();
}

function updateAuthUI() {
    const navAuthContainer = document.getElementById("navAuthContainer");
    const navLinksContainer = document.getElementById("navLinksContainer");
    const dashboardWelcome = document.getElementById("dashboardWelcome");
    const currentUser = getCurrentUser();

    // Update Nav Links dynamically
    if (navLinksContainer) {
        const isMarketplace = window.location.pathname.includes("marketplace.html");
        const isSell = window.location.pathname.includes("sell.html");

        if (currentUser) {
            navLinksContainer.innerHTML = `
                <a href="index.html">Home</a>
                <a href="index.html#features">AI Features</a>
                <a href="marketplace.html" ${isMarketplace ? 'style="color: var(--purple); font-weight: 800;"' : ''}>Marketplace</a>
                <a href="sell.html" ${isSell ? 'style="color: var(--purple); font-weight: 800;"' : ''}>Sell Products 🚀</a>
                <a href="index.html#how">How It Works</a>
            `;
        } else {
            navLinksContainer.innerHTML = `
                <a href="index.html">Home</a>
                <a href="index.html#features">AI Features</a>
                <a href="marketplace.html" ${isMarketplace ? 'style="color: var(--purple); font-weight: 800;"' : ''}>Marketplace</a>
                <a href="index.html#how">How It Works</a>
            `;
        }
    }

    // Update Nav Right Actions
    if (currentUser && navAuthContainer) {
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "A";
        navAuthContainer.innerHTML = `
            <button
                class="icon-btn"
                onclick="showToast('Language options opened 🌐')"
                title="Language"
            >
                🌐
            </button>

            <button
                class="icon-btn"
                onclick="showToast('Cart is currently empty 🛒')"
                title="Cart"
            >
                🛒
            </button>

            <div class="user-menu">
                <div class="user-badge" title="Logged in as ${currentUser.name}">
                    <span class="user-avatar">${initial}</span>
                    <span>${currentUser.name.split(' ')[0]}</span>
                </div>

                <button class="logout-btn" onclick="logout()">
                    Logout
                </button>
            </div>
        `;
    } else if (navAuthContainer) {
        navAuthContainer.innerHTML = `
            <button
                class="icon-btn"
                onclick="showToast('Language options opened 🌐')"
                title="Language"
            >
                🌐
            </button>

            <button
                class="icon-btn"
                onclick="showToast('Cart is currently empty 🛒')"
                title="Cart"
            >
                🛒
            </button>

            <button
                class="login-btn"
                onclick="openLogin()"
            >
                Login
            </button>
        `;
    }

    if (dashboardWelcome) {
        if (currentUser) {
            dashboardWelcome.textContent = `Welcome back, ${currentUser.name} 👋`;
        } else {
            dashboardWelcome.textContent = `Welcome back, Artisan 👋`;
        }
    }
}

function togglePassword(fieldId, btnElement) {
    const input = document.getElementById(fieldId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        btnElement.textContent = "🙈";
    } else {
        input.type = "password";
        btnElement.textContent = "👁️";
    }
}


/* =========================================================
   LOGIN MODAL & LOGIC
========================================================= */

function openLogin() {
    openModal(`
        <h2>
            Welcome Back 👋
        </h2>

        <div id="loginError" class="auth-error"></div>

        <label for="loginIdentifier">
            Mobile Number / Email
        </label>
        <input
            id="loginIdentifier"
            type="text"
            placeholder="e.g. artisan@example.com or 9876543210"
        >

        <label for="loginPassword">
            Password
        </label>
        <div class="password-field-container">
            <input
                id="loginPassword"
                type="password"
                placeholder="Enter password"
                onkeypress="if(event.key==='Enter') processLogin()"
            >
            <button
                type="button"
                class="toggle-password-btn"
                onclick="togglePassword('loginPassword', this)"
            >
                👁️
            </button>
        </div>

        <button
            class="main-btn"
            style="width:100%; margin-top: 8px;"
            onclick="processLogin()"
        >
            Login
        </button>

        <p style="
            text-align:center;
            color:#777;
            font-size:11px;
            margin-top:15px;
        ">
            New artisan?
            <span
                style="
                    color:#6d28d9;
                    cursor:pointer;
                    font-weight:bold;
                "
                onclick="openRegister()"
            >
                Create an account
            </span>
        </p>

        <div style="
            margin-top:15px;
            padding:10px;
            background:#f8f5fc;
            border-radius:8px;
            font-size:11px;
            color:#666;
        ">
            💡 <strong>Demo Login:</strong> artisan@example.com / password123
        </div>
    `);
}

function processLogin() {
    const identifierInput = document.getElementById("loginIdentifier");
    const passwordInput = document.getElementById("loginPassword");
    const errorContainer = document.getElementById("loginError");

    const identifier = identifierInput ? identifierInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!identifier || !password) {
        showAuthError(errorContainer, "Please enter both mobile/email and password.");
        return;
    }

    const users = getStoredUsers();
    const userMatch = users.find(u =>
        (u.identifier.toLowerCase() === identifier.toLowerCase() || u.phone === identifier) &&
        u.password === password
    );

    if (!userMatch) {
        showAuthError(errorContainer, "Invalid mobile/email or password.");
        return;
    }

    setCurrentUser(userMatch);
    closeModal();
    showToast(`Welcome back, ${userMatch.name}! 👋`);

    // Redirect to Sell Page
    setTimeout(() => {
        window.location.href = "sell.html";
    }, 400);
}


/* =========================================================
   REGISTER MODAL & LOGIC
========================================================= */

function openRegister() {
    openModal(`
        <h2>
            Join ArtisanAI 🎨
        </h2>

        <div id="registerError" class="auth-error"></div>

        <label for="regName">
            Full Name *
        </label>
        <input
            id="regName"
            type="text"
            placeholder="e.g. Ramesh Kumar"
        >

        <label for="regIdentifier">
            Mobile Number or Email *
        </label>
        <input
            id="regIdentifier"
            type="text"
            placeholder="e.g. ramesh@example.com or 9876543210"
        >

        <label for="regCraft">
            Your Craft Category *
        </label>
        <select id="regCraft">
            <option value="">Select your craft</option>
            <option value="Textile">Textile</option>
            <option value="Pottery">Pottery</option>
            <option value="Handicraft">Handicraft</option>
            <option value="Jewellery">Jewellery</option>
            <option value="Wood Craft">Wood Craft</option>
            <option value="Metal Craft">Metal Craft</option>
        </select>

        <label for="regPassword">
            Password * (Min 6 characters)
        </label>
        <div class="password-field-container">
            <input
                id="regPassword"
                type="password"
                placeholder="Create password"
            >
            <button
                type="button"
                class="toggle-password-btn"
                onclick="togglePassword('regPassword', this)"
            >
                👁️
            </button>
        </div>

        <label for="regConfirmPassword">
            Confirm Password *
        </label>
        <div class="password-field-container">
            <input
                id="regConfirmPassword"
                type="password"
                placeholder="Confirm password"
                onkeypress="if(event.key==='Enter') processRegister()"
            >
            <button
                type="button"
                class="toggle-password-btn"
                onclick="togglePassword('regConfirmPassword', this)"
            >
                👁️
            </button>
        </div>

        <button
            class="main-btn"
            style="width:100%; margin-top: 10px;"
            onclick="processRegister()"
        >
            Create Artisan Account
        </button>

        <p style="
            text-align:center;
            color:#777;
            font-size:11px;
            margin-top:15px;
        ">
            Already have an account?
            <span
                style="
                    color:#6d28d9;
                    cursor:pointer;
                    font-weight:bold;
                "
                onclick="openLogin()"
            >
                Login here
            </span>
        </p>
    `);
}

function processRegister() {
    const nameInput = document.getElementById("regName");
    const identifierInput = document.getElementById("regIdentifier");
    const craftSelect = document.getElementById("regCraft");
    const passwordInput = document.getElementById("regPassword");
    const confirmPasswordInput = document.getElementById("regConfirmPassword");
    const errorContainer = document.getElementById("registerError");

    const name = nameInput ? nameInput.value.trim() : "";
    const identifier = identifierInput ? identifierInput.value.trim() : "";
    const craft = craftSelect ? craftSelect.value : "";
    const password = passwordInput ? passwordInput.value : "";
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";

    if (!name) {
        showAuthError(errorContainer, "Please enter your full name.");
        return;
    }

    if (!identifier) {
        showAuthError(errorContainer, "Please enter a valid mobile number or email address.");
        return;
    }

    const isEmail = identifier.includes("@");
    const isPhone = /^\d{10,}$/.test(identifier.replace(/[\s\-\+]/g, ''));
    if (!isEmail && !isPhone) {
        showAuthError(errorContainer, "Please enter a valid email address or 10-digit mobile number.");
        return;
    }

    if (!craft) {
        showAuthError(errorContainer, "Please select your craft category.");
        return;
    }

    if (!password || password.length < 6) {
        showAuthError(errorContainer, "Password must be at least 6 characters long.");
        return;
    }

    if (password !== confirmPassword) {
        showAuthError(errorContainer, "Passwords do not match.");
        return;
    }

    const users = getStoredUsers();
    const existingUser = users.find(u =>
        u.identifier.toLowerCase() === identifier.toLowerCase() ||
        (u.phone && u.phone === identifier)
    );

    if (existingUser) {
        showAuthError(errorContainer, "An account with this mobile number or email already exists.");
        return;
    }

    const newUser = {
        name: name,
        identifier: identifier,
        phone: isPhone ? identifier : "",
        craft: craft,
        password: password
    };

    users.push(newUser);
    saveUsers(users);
    setCurrentUser(newUser);

    closeModal();
    showToast(`🎉 Account created! Welcome, ${newUser.name}`);

    // Redirect to Sell Page
    setTimeout(() => {
        window.location.href = "sell.html";
    }, 400);
}

function showAuthError(container, message) {
    if (!container) return;
    container.textContent = message;
    container.classList.add("active");
}

function logout() {
    setCurrentUser(null);
    showToast("Logged out successfully. 👋");
    window.location.href = "index.html";
}


/* =========================================================
   SELL PRODUCTS PAGE LOGIC
========================================================= */

let currentUploadedImageSrc = null;

function handleSellImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        currentUploadedImageSrc = e.target.result;
        const imageCard = document.getElementById("sellImageCard");
        if (imageCard) {
            imageCard.innerHTML = `
                <img
                    class="image-preview-display"
                    src="${currentUploadedImageSrc}"
                    alt="Product preview"
                >
                <div class="badge" style="margin-top: 10px; background: #e6f8eb; color: #16a34a;">
                    ✨ AI Cleaned Background Ready
                </div>
                <p style="color: var(--muted); font-size: 11px; margin-top: 5px;">
                    Click to change image
                </p>
                <label class="upload-label" for="sellImageInput" style="margin-top: 5px; padding: 6px 12px; font-size: 11px;">
                    Change Photo
                </label>
                <input
                    type="file"
                    id="sellImageInput"
                    accept="image/*"
                    style="display: none;"
                    onchange="handleSellImageUpload(event)"
                >
            `;
        }
    };
    reader.readAsDataURL(file);
}

function generateAIDescription() {
    const title = document.getElementById("sellTitle") ? document.getElementById("sellTitle").value.trim() : "";
    const category = document.getElementById("sellCategory") ? document.getElementById("sellCategory").value : "";
    const descTextarea = document.getElementById("sellDescription");

    if (!title) {
        showToast("Please enter a product title first.");
        return;
    }

    const craftName = category || "Handicraft";
    const generatedStory = `✨ Exquisitely handcrafted ${title}, woven with traditional ${craftName} techniques by master artisans. Made using eco-friendly natural materials, this timeless piece brings heritage elegance and authentic craft story directly to your home.`;

    if (descTextarea) {
        descTextarea.value = generatedStory;
    }
    showToast("✨ AI Product Description generated!");
}

function simulateVoiceCataloging() {
    showToast("🎙️ Listening... Speak about your product story");
    const descTextarea = document.getElementById("sellDescription");
    setTimeout(() => {
        if (descTextarea) {
            descTextarea.value = "🎙️ Voice Transcribed: Handcrafted with love using traditional artisan methods passed down through generations. Perfect quality and natural finish.";
        }
        showToast("🎙️ Voice description cataloged!");
    }, 1500);
}

function autoCalculateSmartPrice() {
    const costInput = document.getElementById("sellCostPrice");
    const priceInput = document.getElementById("sellPrice");

    const cost = costInput ? parseFloat(costInput.value) : 0;
    if (cost > 0) {
        const recommended = Math.ceil((cost * 1.4) / 50) * 50;
        if (priceInput) {
            priceInput.value = recommended;
        }
        showToast(`💰 Recommended price ₹${recommended} based on cost + profit margin!`);
    } else {
        showToast("Please enter a valid cost price first.");
    }
}

function openAddProduct() {
    const user = getCurrentUser();
    if (!user) {
        showToast("Please login to access the Artisan Sell Studio.");
        openLogin();
    } else {
        window.location.href = "sell.html";
    }
}

function getStoredProducts() {
    const data = localStorage.getItem(STORAGE_PRODUCTS_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch(e) {
        return [];
    }
}

function saveProducts(products) {
    localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(products));
}

function publishNewProduct() {
    const user = getCurrentUser();

    if (!user) {
        showToast("Please log in to publish products.");
        openLogin();
        return;
    }

    const titleInput = document.getElementById("sellTitle");
    const categorySelect = document.getElementById("sellCategory");
    const priceInput = document.getElementById("sellPrice");
    const descTextarea = document.getElementById("sellDescription");

    const title = titleInput ? titleInput.value.trim() : "";
    const category = categorySelect ? categorySelect.value : "Handicraft";
    const price = priceInput ? priceInput.value.trim() : "";
    const description = descTextarea ? descTextarea.value.trim() : "";

    if (!title || !price) {
        showToast("Please fill in the product title and price.");
        return;
    }

    // Determine category emoji
    let categoryIcon = "🎨";
    if (category === "Textile") categoryIcon = "🧵";
    else if (category === "Pottery") categoryIcon = "🏺";
    else if (category === "Handicraft") categoryIcon = "🧺";
    else if (category === "Jewellery") categoryIcon = "💎";
    else if (category === "Wood Craft") categoryIcon = "🪵";
    else if (category === "Metal Craft") categoryIcon = "⚔️";

    const newProductObj = {
        id: Date.now(),
        title: title,
        category: category,
        categoryIcon: categoryIcon,
        price: parseInt(price),
        maker: user.name,
        image: currentUploadedImageSrc || null,
        description: description
    };

    // Save product into localStorage
    const products = getStoredProducts();
    products.unshift(newProductObj);
    saveProducts(products);

    showToast(`🎉 "${title}" published live to Marketplace!`);

    // Reset form
    const sellForm = document.getElementById("sellForm");
    if (sellForm) sellForm.reset();
    currentUploadedImageSrc = null;

    // Redirect user to the dedicated Marketplace Page to see their published product!
    setTimeout(() => {
        window.location.href = "marketplace.html";
    }, 500);
}

function loadPublishedProductsOnHomepage() {
    const productGrid = document.getElementById("productGrid");
    if (!productGrid) return;

    const publishedProducts = getStoredProducts();
    if (publishedProducts.length === 0) return;

    publishedProducts.forEach(prod => {
        if (document.querySelector(`[data-product-id="${prod.id}"]`)) return;

        const productCard = document.createElement("div");
        productCard.className = "product";
        productCard.dataset.name = prod.title;
        productCard.dataset.category = prod.category;
        productCard.dataset.productId = prod.id;

        const imageHTML = prod.image ?
            `<img src="${prod.image}" style="width:100%; height:100%; object-fit:cover;">` :
            prod.categoryIcon;

        productCard.innerHTML = `
            <div class="product-image">
                ${imageHTML}
            </div>

            <div class="product-info">
                <span class="product-category">
                    ${prod.category}
                </span>

                <h3>
                    ${prod.title}
                </h3>

                <div class="product-maker">
                    By ${prod.maker}
                </div>

                <div class="product-bottom">
                    <div class="price">
                        ₹${prod.price.toLocaleString('en-IN')}
                    </div>

                    <button
                        class="buy-btn"
                        onclick="addToCart('${prod.title.replace(/'/g, "\\'")}')"
                    >
                        Add to Cart
                    </button>
                </div>
            </div>
        `;

        productGrid.insertBefore(productCard, productGrid.firstChild);
    });

    // Update Dashboard counter metric if on home page
    const dashCards = document.querySelectorAll(".dash-card h3");
    if (dashCards && dashCards[0]) {
        let baseCount = 24;
        dashCards[0].textContent = baseCount + publishedProducts.length;
    }
}


/* =========================================================
   SEARCH & CATEGORY FILTERING
========================================================= */

function searchProducts(){
    const searchInput = document.getElementById("searchInput");
    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const products = document.querySelectorAll(".product");

    let found = 0;

    products.forEach(function(product){
        const name = product.dataset.name ? product.dataset.name.toLowerCase() : "";

        if(name.includes(search) || search === ""){
            product.style.display = "block";
            found++;
        } else {
            product.style.display = "none";
        }
    });

    if(found === 0){
        showToast("No matching products found.");
    } else {
        showToast(`${found} product(s) found 🔍`);
    }
}

function filterCategory(category, btnElement) {
    const buttons = document.querySelectorAll(".category-btn");
    buttons.forEach(btn => btn.classList.remove("active"));
    if (btnElement) btnElement.classList.add("active");

    const products = document.querySelectorAll(".product");
    let count = 0;

    products.forEach(product => {
        const prodCategory = product.dataset.category || "";
        if (category === "All" || prodCategory.toLowerCase() === category.toLowerCase()) {
            product.style.display = "block";
            count++;
        } else {
            product.style.display = "none";
        }
    });

    showToast(`Showing ${count} product(s) in ${category}`);
}

function addToCart(product){
    showToast(`${product} added to your cart 🛒`);
}


/* =========================================================
   INITIALIZATION & EVENT LISTENERS
========================================================= */

document.addEventListener("DOMContentLoaded", function() {
    updateAuthUI();
    loadPublishedProductsOnHomepage();
});

// Close modal on backdrop click
const modalElement = document.getElementById("modal");
if (modalElement) {
    modalElement.addEventListener("click", function(event){
        if (event.target === this) {
            closeModal();
        }
    });
}
