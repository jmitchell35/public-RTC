import LogoComponent from "@/components/logo_component";
import ProfileForm from '@/components/profile/profile-form';
import {Suspense} from 'react';
import {fetchUserById} from '@/lib/actions';

import {Metadata} from 'next';

export const metadata: Metadata = {
    title: 'Profile',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = params.id;
    const user = await fetchUserById(id);

    return (
        <main className="flex items-center justify-center md:h-screen">
            <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
                <div className="flex h-20 w-full items-end rounded-lg bg-blue-500 p-3 md:h-36">
                    <LogoComponent/>
                </div>
                <ProfileForm user={user}/>
            </div>
        </main>
    );
}
