// api/release.js
// Vercel Edge Function — proxy to GitHub Releases API for PavTer/BatchRender-releases.
// The public repo only contains compiled binaries (no source code).
// Token is optional — if GITHUB_TOKEN is set in env, it's used to bump rate limit
// from 60 req/hr (anonymous) to 5000 req/hr (authenticated). Site works without it.

export const config = {
  runtime: 'edge',
};

const GITHUB_API = 'https://api.github.com/repos/PavTer/BatchRender-releases/releases/latest';

export default async function handler(request) {
  try {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'batchrender-site',
    };
    // Optional auth (boosts rate limit but not required)
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const ghResponse = await fetch(GITHUB_API, { headers });

    if (!ghResponse.ok) {
      return Response.json(
        { error: `GitHub API returned ${ghResponse.status}` },
        { status: ghResponse.status }
      );
    }

    const data = await ghResponse.json();

    // Return only what the site needs
    const assets = (data.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
    }));

    return Response.json(
      {
        version: data.tag_name || null,
        published_at: data.published_at || null,
        assets,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=300, max-age=60, stale-while-revalidate=600',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return Response.json(
      { error: 'fetch_failed', message: String(err) },
      { status: 500 }
    );
  }
}
