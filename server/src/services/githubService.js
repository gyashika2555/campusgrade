function parseGitHubUrl(repositoryUrl) {
  const url = new URL(repositoryUrl);
  if (url.hostname !== "github.com") throw new Error("Only github.com repository URLs are accepted");
  const [owner, repo] = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  if (!owner || !repo) throw new Error("Invalid GitHub repository URL");
  return { owner, repo };
}

export async function inspectRepository(repositoryUrl) {
  const { owner, repo } = parseGitHubUrl(repositoryUrl);
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "CampusGrade" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const [repoResponse, commitResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers }),
  ]);
  if (!repoResponse.ok || !commitResponse.ok) throw new Error("Repository could not be read; check its URL and access permissions");
  const repository = await repoResponse.json();
  const commits = await commitResponse.json();
  return { owner, repo, defaultBranch: repository.default_branch, language: repository.language, commitSha: commits[0]?.sha ?? null, pushedAt: repository.pushed_at };
}
