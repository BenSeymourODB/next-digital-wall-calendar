import Image from "next/image";
import Link from "next/link";
import logo from "../../public/ODBM_Logo.png";
import nextLogo from "../../public/next.svg";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <main className="flex w-full max-w-4xl flex-col bg-white px-8 py-16 sm:px-16 sm:py-24">
        {/* Hero section with logo and buttons grouped together */}
        <div className="flex flex-col items-center justify-center gap-8 sm:items-start">
          {/* Logos container */}
          <div className="flex w-full flex-col items-center gap-4 sm:items-start">
            <Image
              src={logo}
              alt="ODBM logo"
              priority
              className="h-auto w-full max-w-md"
            />
            <div className="flex items-center gap-3 opacity-60">
              <span className="text-sm text-stone-500">Powered by</span>
              <Image
                src={nextLogo}
                alt="Next.js logo"
                width={100}
                height={25}
                className="dark:invert"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 text-base font-medium sm:flex-row sm:gap-3">
            <Link
              className="bg-foreground text-background flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 shadow-sm transition-all hover:scale-105 hover:bg-[#383838] hover:shadow-md sm:w-auto"
              href="/components"
            >
              Components
            </Link>
            <Link
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/8 px-6 shadow-sm transition-all hover:scale-105 hover:border-transparent hover:bg-black/4 hover:shadow-md sm:w-auto"
              href="/typography"
            >
              Typography
            </Link>
            <Link
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-solid border-black/8 px-6 shadow-sm transition-all hover:scale-105 hover:border-transparent hover:bg-black/4 hover:shadow-md sm:w-auto"
              href="/demo-logging"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                {/* Application Insights Icon - Graph/Chart representation */}
                <path d="M3 18h18v2H3v-2zm2-8h2v6H5v-6zm4-4h2v10H9V6zm4 2h2v8h-2V8zm4-4h2v12h-2V4z" />
              </svg>
              Logging Demo
            </Link>
            <a
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/8 px-6 shadow-sm transition-all hover:scale-105 hover:border-transparent hover:bg-black/4 hover:shadow-md sm:w-auto"
              href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
