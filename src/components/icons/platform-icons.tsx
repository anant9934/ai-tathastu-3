import type { SVGProps } from "react";

export function GitHubIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={colored ? "#24292F" : "currentColor"} className={className} aria-hidden {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
      />
    </svg>
  );
}

export function LinkedInIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#0A66C2" : "currentColor"}
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.222 0h.003z"
      />
    </svg>
  );
}

export function KaggleIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#20BEFF" : "currentColor"}
        d="M18.825 23.859c-.022.09-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.246l-4.757-6.046-1.195 1.148v4.839c0 .211-.105.305-.316.305H6.182c-.211 0-.316-.094-.316-.305V.305c0-.211.105-.305.316-.305h2.464c.211 0 .316.094.316.305v14.47L13.84 9.87c.141-.164.293-.246.457-.246h3.187c.141 0 .234.047.281.141.047.094.035.187-.035.281l-5.636 5.519 6.702 7.999c.07.094.082.199.035.295z"
      />
    </svg>
  );
}

export function LeetCodeIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#FFA116" : "currentColor"}
        d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.314c.015-.016.034-.027.05-.042l3.418-3.413a1.379 1.379 0 0 0 .003-1.95A1.37 1.37 0 0 0 13.483 0zm2.088 10.743H8.384a1.37 1.37 0 0 0-1.37 1.37c0 .756.614 1.37 1.37 1.37h7.187a1.37 1.37 0 0 0 1.37-1.37 1.37 1.37 0 0 0-1.37-1.37z"
      />
      <path
        fill={colored ? "#262626" : "currentColor"}
        d="M17.302 4.475a1.37 1.37 0 0 0-.968.402l-2.096 2.096a1.37 1.37 0 0 0 1.937 1.938l2.096-2.096a1.37 1.37 0 0 0-.969-2.34z"
      />
    </svg>
  );
}

export function HackerRankIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#00EA64" : "currentColor"}
        d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0zm-1.896 5.25H7.728v13.5h2.376v-5.498h3.792V18.75h2.376V5.25h-2.376v5.626h-3.792V5.25z"
      />
    </svg>
  );
}

export function HackerEarthIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <rect width="24" height="24" rx="5" fill={colored ? "#2C3454" : "currentColor"} />
      <path
        fill="#FFFFFF"
        d="M6 5h3v5.5h6V5h3v14h-3v-5.5H9V19H6V5z"
      />
    </svg>
  );
}

export function OrcidIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#A6CE39" : "currentColor"}
        d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"
      />
    </svg>
  );
}

export function GoogleScholarIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#4285F4" : "currentColor"}
        d="M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"
      />
    </svg>
  );
}

export function StackExchangeIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...props}>
      <path
        fill={colored ? "#F48024" : "currentColor"}
        d="M18.986 21.865v-6.404h2.134V24H1.84v-8.539h2.133v6.404h15.013zM6.111 19.731H16.85v-2.134H6.111v2.134zm.278-4.223 10.457 2.183.439-2.091-10.457-2.183-.439 2.091zm1.312-4.492 9.617 4.707.944-1.928-9.617-4.707-.944 1.928zm3.033-4.321 8.012 7.155 1.417-1.589-8.012-7.155-1.417 1.589zm5.556-4.664-1.748 1.218 6.136 8.799 1.748-1.218-6.136-8.799z"
      />
    </svg>
  );
}

export function PortfolioIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={colored ? "#8B5CF6" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function ResumeDocIcon({ className, colored = true, ...props }: SVGProps<SVGSVGElement> & { colored?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={colored ? "#FF5A5F" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function PlatformIcon({
  sourceId,
  className = "size-6",
  colored = true,
}: {
  sourceId: string;
  className?: string;
  colored?: boolean;
}) {
  switch (sourceId) {
    case "github":
      return <GitHubIcon className={className} colored={colored} />;
    case "linkedin":
      return <LinkedInIcon className={className} colored={colored} />;
    case "kaggle":
      return <KaggleIcon className={className} colored={colored} />;
    case "leetcode":
      return <LeetCodeIcon className={className} colored={colored} />;
    case "hackerrank":
      return <HackerRankIcon className={className} colored={colored} />;
    case "hackerearth":
      return <HackerEarthIcon className={className} colored={colored} />;
    case "orcid":
      return <OrcidIcon className={className} colored={colored} />;
    case "google_scholar":
      return <GoogleScholarIcon className={className} colored={colored} />;
    case "stack_exchange":
      return <StackExchangeIcon className={className} colored={colored} />;
    case "portfolio":
      return <PortfolioIcon className={className} colored={colored} />;
    case "resume":
      return <ResumeDocIcon className={className} colored={colored} />;
    default:
      return <PortfolioIcon className={className} colored={colored} />;
  }
}
