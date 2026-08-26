export default function RepositoryGithubLink({ name, className = '' }: { name: string; className?: string }) {
  const href = `https://github.com/${name.split('/').map(encodeURIComponent).join('/')}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={`在 GitHub 打开 ${name}`}>
      {name} <span aria-hidden="true">↗</span>
    </a>
  );
}
