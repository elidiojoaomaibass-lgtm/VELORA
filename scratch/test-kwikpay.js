import fetch from 'node-fetch';

const clientId = '11';
const clientSecret = 'ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q';
const walletId = '891ae33d-664c-4715-abb1-008688662a03';
const phone = '840000000'; // test phone
const amount = 1;

async function test() {
  console.log('Fetching token...');
  const tokenRes = await fetch('https://kwikpay.web.tr/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  const tokenData = await tokenRes.json();
  console.log('Token Response:', tokenRes.status, tokenData);

  if (!tokenData.access_token) return;

  console.log('Making C2B payment request...');
  const paymentRes = await fetch(`https://kwikpay.web.tr/api/v1/c2b/mpesa-payment/${walletId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ amount, phone, reference: 'TEST' + Date.now() }),
  });
  
  const paymentData = await paymentRes.text();
  console.log('Payment Response Status:', paymentRes.status);
  console.log('Payment Response Body:', paymentData);
}

test();
