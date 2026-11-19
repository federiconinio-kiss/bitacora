// Íconos de trazo simple, estilo dibujado a mano.
type P = { size?: number; className?: string };
const base = (size = 24) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const IconLogo = ({ size = 30 }: P) => (
  <svg {...base(size)} viewBox="0 0 64 64" strokeWidth={4.5}>
    <path d="M24 32h18" /><path d="M27 23v18M39 23v18" /><path d="M22 27.5v9M44 27.5v9" />
  </svg>
);
export const IconPlan = (p: P) => (<svg {...base(p.size)}><path d="M6 3.5h9.5L19 7v13.3c0 .4-.3.7-.7.7H6a.8.8 0 0 1-.8-.8V4.3c0-.5.4-.8.8-.8Z" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4.5" /></svg>);
export const IconChart = (p: P) => (<svg {...base(p.size)}><path d="M3.5 20.5h17" /><path d="M5 16.5l4.5-5 3.5 3 6-7.5" /><path d="M15.5 7h3.5v3.4" /></svg>);
export const IconUser = (p: P) => (<svg {...base(p.size)}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c.9-3.7 3.8-5.8 7.5-5.8s6.6 2.1 7.5 5.8" /></svg>);
export const IconUsers = (p: P) => (<svg {...base(p.size)}><circle cx="9" cy="8.5" r="3.3" /><path d="M3 19.5c.7-3.1 3-4.9 6-4.9s5.3 1.8 6 4.9" /><path d="M15.5 5.4a3.2 3.2 0 0 1 0 6.2M17.5 14.9c1.8.6 3 2.1 3.5 4.6" /></svg>);
export const IconBell = (p: P) => (<svg {...base(p.size)}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" /><path d="M10 20.8a2.2 2.2 0 0 0 4 0" /></svg>);
export const IconBook = (p: P) => (<svg {...base(p.size)}><path d="M4 5.5c2.8-1.3 5.5-1.3 8 .5 2.5-1.8 5.2-1.8 8-.5v13.5c-2.8-1.3-5.5-1.3-8 .5-2.5-1.8-5.2-1.8-8-.5Z" /><path d="M12 6v13.5" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p.size)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconSwap = (p: P) => (<svg {...base(p.size)}><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></svg>);
export const IconPlay = (p: P) => (<svg {...base(p.size)}><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5Z" fill="currentColor" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p.size)} strokeWidth={2.6}><path d="M4.5 12.8l4.6 4.4L19.5 6.5" /></svg>);
export const IconX = (p: P) => (<svg {...base(p.size)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconTrash = (p: P) => (<svg {...base(p.size)}><path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5" /></svg>);
export const IconUp = (p: P) => (<svg {...base(p.size)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconDown = (p: P) => (<svg {...base(p.size)}><path d="M12 5v14M6 13l6 6 6-6" /></svg>);
export const IconSearch = (p: P) => (<svg {...base(p.size)}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></svg>);
export const IconBack = (p: P) => (<svg {...base(p.size)}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconLogout = (p: P) => (<svg {...base(p.size)}><path d="M14 4.5H6.5v15H14M10 12h10M17 8.5l3.5 3.5-3.5 3.5" /></svg>);
export const IconEdit = (p: P) => (<svg {...base(p.size)}><path d="M4.5 19.5l1-4.2L16 4.8a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.7 18.5Z" /><path d="M14 7l3 3" /></svg>);
export const IconTrophy = (p: P) => (<svg {...base(p.size)}><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20.5h7M9.5 17h5" /></svg>);
export const IconApple = (p: P) => (<svg {...base(p.size)}><path d="M12 7.5c-1.6-1.2-4.6-1.4-6 .8-1.6 2.5-.6 7.5 1.8 10.4 1.2 1.4 2.3 1.6 4.2.6 1.9 1 3 .8 4.2-.6 2.4-2.9 3.4-7.9 1.8-10.4-1.4-2.2-4.4-2-6-.8Z" /><path d="M12 7.5c0-2 .8-3.3 2.5-4" /></svg>);
