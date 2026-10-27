import type { ReactNode } from 'react'

/** Stand-in for pages that are still being ported from the Java app. */
export default function PagePlaceholder({ title, children }: { title: string; children: ReactNode }): React.ReactElement {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-2 p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted">{children}</p>
    </section>
  )
}
