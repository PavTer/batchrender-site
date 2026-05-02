// api/release.js
// Vercel Edge Function — proxy to GitHub Releases API.
// Allows the public site to read release info from a private repository
// without exposing the GitHub token to the browser.
//
// Required env var: GITHUB_TOKEN (fine-grained PAT with Contents:Read for PavTer/BatchRender)

export const config = {
  runtime: 'edge',
};

const GITHUB_API = 'https://api.github.com/repos/PavTer/BatchRender/releases/latest';

export default async function handler(request) {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return Response.json(
        { error: 'GITHUB_TOKEN not configured' },
        { status: 500 }
      );
    }

    const ghResponse = await fetch(GITHUB_API, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'batchrender-site',
      },
    });

    if (!ghResponse.ok) {
      return Response.json(
        { error: `GitHub API returned ${ghResponse.status}` },
        { status: ghResponse.status }
      );
    }

    const data = await ghResponse.json();

    // Return only what the site needs — never leak full GitHub response
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
          // Cache on Vercel Edge for 5 minutes; browsers may cache for 1 minute.
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
