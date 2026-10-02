import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function testPayment() {
    const clientId = process.env.VITE_KWIKPAY_CLIENT_ID || process.env.VITE_E2_CLIENT_ID;
    const clientSecret = process.env.VITE_KWIKPAY_CLIENT_SECRET || process.env.VITE_E2_CLIENT_SECRET;
    const walletId = process.env.VITE_KWIKPAY_WALLET_ID || process.env.VITE_E2_WALLET_MPESA;
    
    console.log("Using credentials:", { clientId, walletId });
    
    // 1. Get Token
    const tokenRes = await fetch('https://kwikpay.web.tr/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        console.error("Token error:", tokenData);
        return;
    }
    
    console.log("Token obtained successfully.");
    
    // 2. Make Payment
    const url = `https://kwikpay.web.tr/api/v1/c2b/mpesa-payment/${walletId}`;
    console.log("Calling URL:", url);
    
    const paymentRes = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            amount: 10,
            phone: "840000000", // Valid M-Pesa format
            reference: `TEST${Date.now()}`.slice(0, 20)
        }),
    });
    
    const paymentData = await paymentRes.text();
    console.log("Payment status:", paymentRes.status);
    console.log("Payment response:", paymentData);
}

testPayment();
