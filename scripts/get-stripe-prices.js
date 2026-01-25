/**
 * Script pour récupérer les Price IDs Stripe
 * Usage: STRIPE_SECRET_KEY=sk_... node scripts/get-stripe-prices.js
 */

const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is required');
  console.log('Usage: STRIPE_SECRET_KEY=sk_... node scripts/get-stripe-prices.js');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

async function getStripePrices() {
  try {
    console.log('🔍 Fetching Stripe prices...\n');
    
    const prices = await stripe.prices.list({
      limit: 100,
      active: true,
    });
    
    console.log(`✅ Found ${prices.data.length} active prices:\n`);
    
    // Grouper par produit
    const pricesByProduct = {};
    
    for (const price of prices.data) {
      const productId = typeof price.product === 'string' ? price.product : price.product?.id;
      
      if (!pricesByProduct[productId]) {
        pricesByProduct[productId] = [];
      }
      
      pricesByProduct[productId].push(price);
    }
    
    // Afficher les prix par produit
    for (const [productId, productPrices] of Object.entries(pricesByProduct)) {
      const product = await stripe.products.retrieve(productId);
      console.log(`📦 Product: ${product.name} (${productId})`);
      
      for (const price of productPrices) {
        const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
        const currency = price.currency?.toUpperCase() || 'USD';
        const interval = price.recurring?.interval || 'one-time';
        const intervalCount = price.recurring?.interval_count || 1;
        
        console.log(`   💰 Price ID: ${price.id}`);
        console.log(`      Amount: $${amount} ${currency}`);
        console.log(`      Interval: ${intervalCount} ${interval}(s)`);
        console.log(`      Active: ${price.active ? '✅' : '❌'}`);
        console.log('');
      }
    }
    
    // Suggestions pour Etsmart
    console.log('\n📋 Suggested Price IDs for Etsmart plans:');
    console.log('─'.repeat(50));
    
    const smartPrices = prices.data.filter(p => {
      const amount = p.unit_amount ? p.unit_amount / 100 : 0;
      return Math.abs(amount - 19.99) < 0.01 && p.recurring?.interval === 'month';
    });
    
    const proPrices = prices.data.filter(p => {
      const amount = p.unit_amount ? p.unit_amount / 100 : 0;
      return Math.abs(amount - 29.99) < 0.01 && p.recurring?.interval === 'month';
    });
    
    const scalePrices = prices.data.filter(p => {
      const amount = p.unit_amount ? p.unit_amount / 100 : 0;
      return Math.abs(amount - 49.99) < 0.01 && p.recurring?.interval === 'month';
    });
    
    if (smartPrices.length > 0) {
      console.log(`\n✅ SMART ($19.99/month):`);
      smartPrices.forEach(p => console.log(`   ${p.id}`));
    } else {
      console.log(`\n⚠️  SMART ($19.99/month): No matching price found`);
    }
    
    if (proPrices.length > 0) {
      console.log(`\n✅ PRO ($29.99/month):`);
      proPrices.forEach(p => console.log(`   ${p.id}`));
    } else {
      console.log(`\n⚠️  PRO ($29.99/month): No matching price found`);
    }
    
    if (scalePrices.length > 0) {
      console.log(`\n✅ SCALE ($49.99/month):`);
      scalePrices.forEach(p => console.log(`   ${p.id}`));
    } else {
      console.log(`\n⚠️  SCALE ($49.99/month): No matching price found`);
      console.log(`   💡 You may need to create this price in Stripe Dashboard`);
    }
    
  } catch (error) {
    console.error('❌ Error fetching Stripe prices:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.error('   Make sure your STRIPE_SECRET_KEY is valid');
    }
    process.exit(1);
  }
}

getStripePrices();

