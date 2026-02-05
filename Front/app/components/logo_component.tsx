import { lusitana } from '@/lib/fonts';
import {ChatBubbleBottomCenterTextIcon} from "@heroicons/react/16/solid";

export default function LogoComponent() {
    return (
        <div
            className={`${lusitana.className} flex flex-row items-center leading-none text-white`}
        >
            <ChatBubbleBottomCenterTextIcon className="h-12 w-12" />
            <p className="text-[44px]"> Chat-roulette</p>
        </div>
    );
}