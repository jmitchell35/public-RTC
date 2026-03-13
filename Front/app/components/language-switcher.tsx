'use client';

import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const current = i18n.language?.startsWith('fr') ? 'fr' : 'en';

    const toggle = () => {
        const next = current === 'fr' ? 'en' : 'fr';
        i18n.changeLanguage(next);
        localStorage.setItem('lang', next);
    };

    return (
        <button
            onClick={toggle}
            title="Switch language"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
            {current === 'fr' ? 'EN' : 'FR'}
        </button>
    );
}
