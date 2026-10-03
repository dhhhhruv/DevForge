"use client";

import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavGroup, NavGroupSection } from "@/components/ui/nav-group";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { NavAuthLink } from "@/components/auth/nav-auth-link";

/*
 * Four categories, each opening onto sub-grouped links. The row is capped at
 * max-w-7xl, so the nav's width budget is the same at 1280 as at 1920 — a flat
 * list of ten top-level items overran it and wrapped the header onto two rows.
 * Home is deliberately absent: the wordmark is the home link.
 */

const menus: { label: string; sections: NavGroupSection[] }[] = [
    {
        label: "Programs",
        sections: [
            {
                heading: "Contribute",
                items: [
                    { name: "Open Source", href: "/opensource" },
                    { name: "Projects", href: "/projects" },
                ],
            },
            {
                heading: "Summer of Code",
                items: [
                    { name: "GSoC", href: "/gsoc" },
                    { name: "GSSoC Hall of Fame", href: "/gssoc" },
                    { name: "ESoC", href: "/esoc" },
                ],
            },
        ],
    },
    {
        label: "Community",
        sections: [
            {
                heading: "The Club",
                items: [
                    { name: "About", href: "/club" },
                    { name: "Journey", href: "/journey" },
                    { name: "Memory Lane", href: "/memory-lane" },
                ],
            },
            {
                heading: "People",
                items: [
                    { name: "Members", href: "/members" },
                    { name: "Alumni", href: "/alumni" },
                    { name: "Rewards", href: "/rewards" },
                ],
            },
        ],
    },
    {
        label: "Events",
        sections: [
            {
                items: [
                    { name: "Hackathons", href: "/hackathons" },
                    { name: "Conferences", href: "/conferences" },
                    { name: "Calendar", href: "/events" },
                ],
            },
        ],
    },
    {
        label: "Resources",
        sections: [
            {
                items: [
                    { name: "Learn", href: "/learn" },
                    { name: "PR Workbook", href: "/learn/open-source" },
                    { name: "Blog", href: "/blog" },
                ],
            },
        ],
    },
];

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // The member app renders its own DashboardNav; showing the marketing nav
    // (Programs, Community, "Join Us") on top of it makes no sense once signed in.
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
        return null;
    }

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-3' : 'py-5'}`}>
            <div className={`max-w-7xl mx-auto px-4 flex items-center justify-between gap-4 transition-all duration-500 ${isScrolled ? 'glass !rounded-full px-4 md:px-6 py-2 border border-white/10' : ''}`}>

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group shrink-0">
                    <Image
                        src="/logo.png"
                        alt="DevForge Logo"
                        width={40}
                        height={40}
                        priority
                        className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-200 [filter:hue-rotate(160deg)_saturate(1.2)]"
                    />
                    <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">Dev<span className="text-cyan-400">Forge</span></span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
                    {menus.map((menu) => (
                        <NavGroup key={menu.label} label={menu.label} sections={menu.sections} />
                    ))}
                </nav>

                {/* CTA & Mobile Toggle */}
                <div className="flex items-center gap-3 shrink-0">
                    <ThemeSwitcher />
                    <NavAuthLink />
                    <Link href="/join" className="hidden md:inline-flex px-5 py-2 bg-white text-black font-bold text-sm rounded-full whitespace-nowrap hover:bg-neutral-200 transition-colors">
                        Join Us
                    </Link>

                    <button
                        className="lg:hidden text-white p-2"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-nav"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Nav — the same tree, flattened to two heading levels. */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        id="mobile-nav"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="lg:hidden glass-strong rounded-none border-x-0 border-t-0 overflow-hidden"
                    >
                        {/* Opaque like the desktop dropdowns — glass alone leaves a list
                            this long unreadable against the hero behind it. */}
                        <div className="px-4 py-6 flex flex-col gap-1 max-h-[calc(100vh-6rem)] overflow-y-auto bg-black/95 backdrop-blur-xl">
                            {menus.map((menu) => (
                                <Fragment key={menu.label}>
                                    <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                                        {menu.label}
                                    </div>
                                    {menu.sections.map((section, i) => (
                                        <Fragment key={section.heading ?? `section-${i}`}>
                                            {section.heading && (
                                                <div className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                                                    {section.heading}
                                                </div>
                                            )}
                                            {section.items.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className={`text-lg font-medium px-4 py-2.5 rounded-xl ${
                                                        pathname === item.href
                                                        ? 'bg-cyan-400/10 text-cyan-400'
                                                        : 'text-neutral-400'
                                                    }`}
                                                >
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </Fragment>
                                    ))}
                                </Fragment>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
