import type { Section } from "../../sections";

/** Placeholder until the section is ported from the old calculator */
export const SectionPage: React.FC<{ section: Section }> = ({ section }) => (
    <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
            {section.emoji} {section.title}
        </h1>
        <p className="text-muted">Coming soon</p>
    </div>
);
