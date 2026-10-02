import fetch from 'node-fetch';

const clientId = '11';
const clientSecret = 'ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q';
const walletId = '891ae33d-664c-4715-abb1-008688662a03';
// M-Pesa phone number requires 9 digits usually
const phone = '841234567'; 
const amount = 1;

async function test() {
  try {
    const tokenRes = await fetch('https://kwikpay.web.tr/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        console.error('No token:', tokenData);
        return;
    }
    
    console.log('Sending C2B request...');
    const paymentRes = await fetch(`https://kwikpay.web.tr/api/v1/c2b/mpesa-payment/${walletId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ amount, phone, reference: 'TEST' + Date.now() }),
    });
    
    const status = paymentRes.status;
    const body = await paymentRes.text();
    console.log(`Status: ${status}`);
    console.log(`Body: ${body}`);
  } catch(e) {
    console.error('Error:', e);
  }
}

test();
