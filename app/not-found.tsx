import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="anime-card mx-auto max-w-xl p-8 text-center sm:p-12">
      <div className="text-6xl" aria-hidden="true">(╥﹏╥)</div>
      <span className="kicker mt-5 inline-block">404 LOST EPISODE</span>
      <h1 className="manga-title mt-2 text-3xl font-black text-ink">这一页走丢了</h1>
      <p className="mt-3 text-muted">可能是链接过期，也可能是仓库开启了隐藏剧情。</p>
      <Link href="/" className="primary-button mt-6 inline-flex">回到首页</Link>
    </div>
  );
}
