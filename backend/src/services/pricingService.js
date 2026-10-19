/**
 * Pricing Service (Stages A & B)
 * --------------------------------
 * This module calculates suggested artisan pricing in two stages:
 * Stage A (Cost-Plus Rule): Calculates production cost floor using material cost,
 * labor hours, category hourly rate, and overhead percentage.
 * Stage B (Market-Aware): If 5 or more comparable items exist in MongoDB for the category,
 * it blends market percentiles (25th, 50th, 75th) with the cost floor so artisans never sell at a loss.
 */

const Product = require('../models/Product');
const pricingConfig = require('../config/pricingConfig.json');

/**
 * Calculates a percentile value from a sorted array of numbers using linear interpolation.
 * @param {number[]} sortedArr - Ascending sorted list of numbers
 * @param {number} p - Percentile between 0 and 1 (e.g. 0.5 for median)
 */
function calculatePercentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    if (sortedArr.length === 1) return sortedArr[0];

    const index = p * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Removes extreme outliers from an array of prices using the Interquartile Range (IQR) method.
 * This prevents test records (e.g. ₹1 or ₹999,999) from skewing market recommendations.
 * @param {number[]} prices
 */
function filterOutliersIQR(prices) {
    if (prices.length < 5) return prices;

    const q1 = calculatePercentile(prices, 0.25);
    const q3 = calculatePercentile(prices, 0.75);
    const iqr = q3 - q1;

    // Minimum boundary: at least ₹10
    const lowerBound = Math.max(10, q1 - 1.5 * iqr);
    const upperBound = q3 + 1.5 * iqr;

    const filtered = prices.filter(p => p >= lowerBound && p <= upperBound);
    // If filtering removed too many items, return original prices to avoid empty sample
    return filtered.length >= 3 ? filtered : prices;
}

/**
 * Suggests price tiers based on cost formula and market competition.
 *
 * @param {Object} params
 * @param {string} params.category - Product category from schema enum
 * @param {number} params.rawMaterialsCost - Material expense in INR
 * @param {number} params.laborHours - Hours spent creating the product
 * @param {string} [params.currentVendorId] - Optional vendor ID to exclude own products from market comparison
 */
async function calculatePriceSuggestion({ category, rawMaterialsCost = 0, laborHours = 0, description = '', currentVendorId = null }) {
    const materials = Math.max(0, Number(rawMaterialsCost) || 0);
    const hours = Math.max(0, Number(laborHours) || 0);

    // ── STAGE A: Rule-Based Cost-Plus Floor ──────────────────────────────────────
    // 1. Get rates for category (or fallback to defaults)
    const categoryConfig = (pricingConfig.categoryOverrides && pricingConfig.categoryOverrides[category]) || {};
    const hourlyRate = categoryConfig.hourlyRate || pricingConfig.defaultHourlyRate || 80;
    const overheadPercent = categoryConfig.overheadPercent !== undefined 
        ? categoryConfig.overheadPercent 
        : (pricingConfig.defaultOverheadPercent || 0.15);

    // 2. Base cost calculation
    const laborCost = Math.round(hours * hourlyRate);
    const directCost = materials + laborCost;
    const overheadCost = Math.round(directCost * overheadPercent);
    const totalCostFloor = directCost + overheadCost; // Absolute minimum to break even

    // Fallback minimum to avoid 0 when vendor enters 0 for both
    const effectiveCost = Math.max(50, totalCostFloor);

    // Default Stage A tier margins from config
    const fairMargin = pricingConfig.tierMargins.fair || 1.25;
    const marketMargin = pricingConfig.tierMargins.market || 1.60;
    const premiumMargin = pricingConfig.tierMargins.premium || 2.20;

    let fairPrice = Math.round(effectiveCost * fairMargin);
    let marketPrice = Math.round(effectiveCost * marketMargin);
    let premiumPrice = Math.round(effectiveCost * premiumMargin);

    // ── STAGE C: Machine Learning Model in Python Service ────────────────────────
    let mlResult = null;
    try {
        const aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
        const aiServiceKey = process.env.AI_SERVICE_KEY || '';

        const mlResponse = await fetch(`${aiServiceUrl}/predict-price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Key': aiServiceKey
            },
            body: JSON.stringify({
                category,
                rawMaterialsCost: materials,
                laborHours: hours,
                description: description || ''
            }),
            signal: AbortSignal.timeout(3000) // Fast 3-second timeout
        });

        if (mlResponse.ok) {
            const data = await mlResponse.json();
            if (data && data.available) {
                mlResult = data;
            }
        }
    } catch (err) {
        // Silently proceed to Stage B if ML service is unreachable
    }

    if (mlResult) {
        let explanationEn = '';
        let explanationHi = '';

        if (mlResult.isSynthetic) {
            explanationEn = `Calculated using Stage C Machine Learning (GradientBoostingRegressor) trained on SYNTHETIC bootstrap data (${mlResult.trainingSamples} samples, Cross-validated MAE: ₹${mlResult.mae}). WARNING: Synthetic bootstrap data cannot represent real market trends.`;
            explanationHi = `स्टेज सी मशीन लर्निंग मॉडल (सिंथेटिक बूटस्ट्रैप डेटा पर प्रशिक्षित, 5-फोल्ड त्रुटि: ₹${mlResult.mae}) द्वारा अनुमानित। चेतावनी: सिंथेटिक डेटा वास्तविक बाज़ार मांग का प्रतिनिधित्व नहीं करता है।`;
        } else {
            explanationEn = `Calculated using Stage C Machine Learning (GradientBoostingRegressor) trained on ${mlResult.trainingSamples} real marketplace products (Cross-validated MAE: ₹${mlResult.mae}).`;
            explanationHi = `स्टेज सी मशीन लर्निंग मॉडल (${mlResult.trainingSamples} वास्तविक उत्पादों पर प्रशिक्षित, 5-फोल्ड त्रुटि: ₹${mlResult.mae}) द्वारा सुझाया गया मूल्य।`;
        }

        return {
            fair: mlResult.fair,
            market: mlResult.market,
            premium: mlResult.premium,
            breakdown: {
                materials,
                laborHours: hours,
                hourlyRate,
                laborCost,
                overheadPercent,
                overheadCost,
                totalCostFloor,
                mlMetadata: {
                    isSynthetic: mlResult.isSynthetic,
                    trainingSamples: mlResult.trainingSamples,
                    mae: mlResult.mae
                }
            },
            basis: 'ml',
            isSynthetic: mlResult.isSynthetic,
            comparableCount: mlResult.trainingSamples,
            explanationEn,
            explanationHi
        };
    }

    let basis = 'cost-only';
    let comparableCount = 0;
    let marketStats = null;

    // ── STAGE B: Market-Aware MongoDB Percentiles ────────────────────────────────
    try {
        const query = { category };
        if (currentVendorId) {
            query.vendor = { $ne: currentVendorId };
        }


        // Fetch valid prices for products in the same category
        const existingProducts = await Product.find(query)
            .select('price')
            .lean();

        const rawPrices = existingProducts
            .map(p => Number(p.price))
            .filter(p => !isNaN(p) && p > 0)
            .sort((a, b) => a - b);

        comparableCount = rawPrices.length;

        // Stage B triggers ONLY when at least 5 comparable products exist
        if (comparableCount >= 5) {
            const cleanPrices = filterOutliersIQR(rawPrices);

            const p25 = Math.round(calculatePercentile(cleanPrices, 0.25));
            const median = Math.round(calculatePercentile(cleanPrices, 0.50));
            const p75 = Math.round(calculatePercentile(cleanPrices, 0.75));

            marketStats = {
                sampleSize: cleanPrices.length,
                p25,
                median,
                p75
            };

            // Blend market data with cost floor:
            // - Fair price: Market 25th percentile, but NEVER below cost floor + 15% minimum margin
            const costGuaranteedFloor = Math.round(effectiveCost * 1.15);
            fairPrice = Math.max(costGuaranteedFloor, p25);

            // - Market price: Average of cost-plus market margin and market median
            const costMarketTarget = Math.round(effectiveCost * marketMargin);
            marketPrice = Math.max(fairPrice, Math.round((costMarketTarget + median) / 2));

            // - Premium price: 75th percentile or cost-plus premium, whichever provides higher return
            const costPremiumTarget = Math.round(effectiveCost * premiumMargin);
            premiumPrice = Math.max(marketPrice + 50, Math.max(costPremiumTarget, p75));

            basis = 'cost+market';
        }
    } catch (err) {
        // Graceful degradation: if MongoDB query fails, fallback cleanly to Stage A
        console.error('Pricing Stage B lookup warning:', err.message);
        basis = 'cost-only';
    }

    // ── Explanations (English & Hindi) ──────────────────────────────────────────
    let explanationEn = '';
    let explanationHi = '';

    if (basis === 'cost+market') {
        explanationEn = `Calculated using your direct cost (₹${totalCostFloor}) blended with ${comparableCount} comparable items in "${category}". Fair Base protects your costs, Market aligns with market median (₹${marketStats.median}), and Premium reflects the upper quartile.`;
        explanationHi = `यह सुझाव आपकी लागत (₹${totalCostFloor}) और "${category}" श्रेणी के ${comparableCount} बाज़ार उत्पादों के विश्लेषण पर आधारित है। उचित मूल्य आपकी लागत सुरक्षित रखता है और बाज़ार दर औसत मांग के अनुसार है।`;
    } else {
        explanationEn = `Calculated using cost-plus rule (materials ₹${materials} + labor ${hours} hrs @ ₹${hourlyRate}/hr + ${Math.round(overheadPercent * 100)}% overhead). Market data unavailable (requires at least 5 products in this category; found ${comparableCount}).`;
        explanationHi = `यह सुझाव लागत-आधारित फॉर्मूले (सामग्री ₹${materials} + श्रम ${hours} घंटे @ ₹${hourlyRate}/घंटे + ${Math.round(overheadPercent * 100)}% ओवरहेड) से निकाला गया है। इस श्रेणी में बाज़ार डेटा के लिए कम से कम 5 उत्पादों की आवश्यकता है (वर्तमान में ${comparableCount} हैं)।`;
    }

    return {
        fair: fairPrice,
        market: marketPrice,
        premium: premiumPrice,
        breakdown: {
            materials,
            laborHours: hours,
            hourlyRate,
            laborCost,
            overheadPercent,
            overheadCost,
            totalCostFloor,
            marketStats
        },
        basis,
        comparableCount,
        explanationEn,
        explanationHi
    };
}

module.exports = {
    calculatePriceSuggestion
};
