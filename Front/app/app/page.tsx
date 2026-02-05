import {ArrowRightIcon} from '@heroicons/react/24/outline';
import Link from 'next/link';
import {lusitana} from '@/lib/fonts';
import Image from 'next/image';
import LogoComponent from "@/components/logo_component";

export default function Page() {
    return (
        <main className="flex min-h-screen flex-col p-6">
            <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 p-4 md:h-52">
                <LogoComponent />
            </div>
            <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
                <div className="flex flex-col justify-center gap-6 rounded-lg bg-gray-50 px-6 py-10 md:w-2/5 md:px-20">
                    <p className={`${lusitana.className} text-xl text-gray-800 md:text-3xl md:leading-normal`}>
                      <strong>Welcome to Chat-roulette.</strong> This is our RTC app.
                    </p>
                    <Link
                        href="/login"
                        className="flex items-center gap-5 self-start rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 md:text-base"
                    >
                        <span>Log in</span> <ArrowRightIcon className="w-5 md:w-6"/>
                    </Link>
                    <Link
                        href="/register"
                        className="flex items-center gap-5 self-start rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 md:text-base"
                    >
                        <span>Register</span> <ArrowRightIcon className="w-5 md:w-6"/>
                    </Link>
                </div>
                <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
                    {/* Hero Images */}
                    <Image
                        src="/hero-desktop.jpg"
                        width={1000}
                        height={760}
                        alt="Chat application desktop hero picture"
                        priority
                        className="hidden md:block"

                    />
                    <Image
                        src="/hero-mobile.webp"
                        width={560}
                        height={620}
                        alt="Chat application mobile hero picture"
                        priority
                        className="block md:hidden"
                    />
                </div>
            </div>
        </main>
    );
}