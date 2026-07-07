import process from 'process';

// Get token from env or args
const token = process.env.GITHUB_TOKEN || process.argv[2];

if (!token) {
  console.log('No token provided. Running unauthenticated (subject to 60 req/hr rate limits).');
  console.log('To run authenticated, set GITHUB_TOKEN environment variable or pass the token as an argument:');
  console.log('  node scripts/validate-api.js <your_github_token>');
  console.log('--------------------------------------------------\n');
} else {
  console.log('Token provided. Running authenticated...\n');
}

async function fetchGitHub(url) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'OrgExplorer-Validator',
  };
  
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const res = await fetch(url, { headers });
  
  // Log rate limit headers
  const limit = res.headers.get('x-ratelimit-limit');
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  const resetDate = reset ? new Date(Number(reset) * 1000).toLocaleString() : 'N/A';

  console.log(`[Rate Limit] Remaining: ${remaining}/${limit} | Resets at: ${resetDate}`);

  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

async function test() {
  try {
    // 1. Fetch organization metadata
    console.log('Fetching AOSSIE-Org organization metadata...');
    const org = await fetchGitHub('https://api.github.com/orgs/AOSSIE-Org');
    console.log('Success! Org Login:', org.login);
    console.log('Name:', org.name);
    console.log('Public Repos:', org.public_repos);
    console.log('--------------------------------------------------');

    // 2. Fetch repository metadata
    console.log('Fetching AOSSIE-Org/OrgExplorer repository metadata...');
    const repo = await fetchGitHub('https://api.github.com/repos/AOSSIE-Org/OrgExplorer');
    console.log('Success! Repo Name:', repo.full_name);
    console.log('Stars:', repo.stargazers_count);
    console.log('Forks:', repo.forks_count);
    console.log('Open Issues:', repo.open_issues_count);
    console.log('--------------------------------------------------');

    console.log('Validation complete: Successfully fetched OrgExplorer data!');
  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
  }
}

test();
