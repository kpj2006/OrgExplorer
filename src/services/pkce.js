// Helper to convert decimal to hex string
function dec2hex(dec) {
  return dec.toString(16).padStart(2, '0');
}

// Generate high-entropy code verifier
export function generateCodeVerifier() {
  const array = new Uint8Array(32); // Exactly 64 character hex string
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

// Generate state parameter for CSRF protection
export function generateState() {
  const array = new Uint8Array(16); // Exactly 32 character hex string
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

// SHA-256 hash + base64url encode code verifier
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  
  let binary = '';
  const bytes = new Uint8Array(hash);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Initiate redirect to GitHub OAuth authorize endpoint
export async function initiateOAuthFlow(clientId, redirectUri, scope = 'read:org,repo') {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem('oe_oauth_verifier', verifier);
  localStorage.setItem('oe_oauth_state', state);

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.href = authUrl.toString();
}

// Exchange authorization code for access token via CORS proxy
export async function exchangeCodeForToken(clientId, clientSecret, redirectUri, code, state, customProxyUrl) {
  console.log('[PKCE OAuth] Starting token exchange...');
  console.log('[PKCE OAuth] Arguments received:', { clientId, clientSecret: clientSecret ? '***' : 'missing', redirectUri, code, state, customProxyUrl });

  const storedState = localStorage.getItem('oe_oauth_state');
  const storedVerifier = localStorage.getItem('oe_oauth_verifier');
  console.log('[PKCE OAuth] Retrieved storage variables:', { storedState, storedVerifier });

  // Clean up storage immediately
  localStorage.removeItem('oe_oauth_state');
  localStorage.removeItem('oe_oauth_verifier');

  if (!storedState || !storedVerifier) {
    console.error('[PKCE OAuth] Missing stored verifier or state in localStorage!');
    throw new Error('OAuth flow state not found. Try logging in again.');
  }

  if (state !== storedState) {
    console.error('[PKCE OAuth] State mismatch!', { received: state, stored: storedState });
    throw new Error('OAuth state mismatch. CSRF protection triggered.');
  }

  // Use proxy: fallback to Vite dev server proxy `/github-token-exchange`, 
  // or a user-defined custom proxy. If none, attempt direct (might fail CORS).
  const proxyUrl = customProxyUrl || '/github-token-exchange';
  console.log('[PKCE OAuth] Selected proxy endpoint:', proxyUrl);

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    code_verifier: storedVerifier,
    redirect_uri: redirectUri,
  });
  console.log('[PKCE OAuth] Fetch body payload (URL-encoded):', bodyParams.toString());

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
    });

    console.log('[PKCE OAuth] Proxy response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PKCE OAuth] Raw error response body from proxy:', errorText);
      throw new Error(`Token exchange failed: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    console.log('[PKCE OAuth] Decoded response data:', data);

    if (data.error) {
      console.error('[PKCE OAuth] GitHub returned an error payload:', data);
      throw new Error(`GitHub Error: ${data.error_description || data.error}`);
    }

    console.log('[PKCE OAuth] Token exchange completed successfully.');
    return data; // Expected keys: access_token, token_type, scope
  } catch (fetchError) {
    console.error('[PKCE OAuth] Error during fetch operation:', fetchError);
    throw fetchError;
  }
}
