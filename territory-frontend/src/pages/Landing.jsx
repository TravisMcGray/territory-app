import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HexBackground from '../components/HexBackground';

// ========== PHONE SHOWCASE ==========
function PhoneShowcase() {
    const [active, setActive] = useState('iphone');

    const iphoneActive = active === 'iphone';
    const androidActive = active === 'android';

    // Shared app screen content
    const AppScreen = ({ tint }) => (
        <div style={{ width: '100%', height: '100%', background: '#0f172a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* App header */}
            <div style={{ background: '#10b981', padding: '10px 14px 8px' }}>
                <div style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>Hex<span style={{ color: 'rgba(255,255,255,0.7)' }}>Capture</span></div>
            </div>
            {/* Map area */}
            <div style={{ flex: 1, background: '#e9ecf0', position: 'relative', overflow: 'hidden' }}>
                <svg width="100%" height="100%" viewBox="0 0 220 260">
                    <rect width="220" height="260" fill="#e9ecf0"/>
                    <rect x="0" y="80" width="220" height="10" fill="#fff" opacity="0.9"/>
                    <rect x="0" y="160" width="220" height="10" fill="#fff" opacity="0.9"/>
                    <rect x="70" y="0" width="10" height="260" fill="#fff" opacity="0.9"/>
                    <rect x="140" y="0" width="10" height="260" fill="#fff" opacity="0.9"/>
                    {[[75,45],[90,36],[90,54],[105,45],[75,54],[60,45],[60,36],[105,36],[75,63],[90,72],[60,63]].map(([cx,cy],i) => (
                        <polygon key={i} points={`${cx},${cy-11} ${cx+9.5},${cy-5.5} ${cx+9.5},${cy+5.5} ${cx},${cy+11} ${cx-9.5},${cy+5.5} ${cx-9.5},${cy-5.5}`}
                            fill="#10b981" opacity={0.9 - i*0.04} stroke="#fff" strokeWidth="1.2"/>
                    ))}
                    {[[148,120],[162,111],[162,129],[148,138],[134,129],[134,111]].map(([cx,cy],i) => (
                        <polygon key={i} points={`${cx},${cy-11} ${cx+9.5},${cy-5.5} ${cx+9.5},${cy+5.5} ${cx},${cy+11} ${cx-9.5},${cy+5.5} ${cx-9.5},${cy-5.5}`}
                            fill="#e879f9" opacity={0.85} stroke="#fff" strokeWidth="1.2"/>
                    ))}
                    {[[35,185],[50,176],[50,194]].map(([cx,cy],i) => (
                        <polygon key={i} points={`${cx},${cy-11} ${cx+9.5},${cy-5.5} ${cx+9.5},${cy+5.5} ${cx},${cy+11} ${cx-9.5},${cy+5.5} ${cx-9.5},${cy-5.5}`}
                            fill="#f59e0b" opacity={0.85} stroke="#fff" strokeWidth="1.2"/>
                    ))}
                    {/* GPS dot */}
                    <circle cx="90" cy="45" r="8" fill="rgba(16,185,129,0.2)"/>
                    <circle cx="90" cy="45" r="5" fill="#fff" stroke="#10b981" strokeWidth="2"/>
                    <circle cx="90" cy="45" r="2.5" fill="#10b981"/>
                </svg>
                {/* Legend pill */}
                <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(15,23,42,0.85)', borderRadius: 8, padding: '4px 10px' }}>
                    <span style={{ color: '#10b981', fontSize: 9, fontWeight: 800 }}>YOURS 11 </span>
                    <span style={{ color: '#94a3b8', fontSize: 9 }}>| OTHERS 9</span>
                </div>
            </div>
            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#1e293b' }}>
                {[['21','Tiles','#10b981'],['4.2','Miles','#3b82f6'],['#2','Rank','#f59e0b']].map(([v,l,c]) => (
                    <div key={l} style={{ background: '#0f172a', padding: '8px 4px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: c }}>{v}</div>
                        <div style={{ fontSize: 7, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, height: 520, perspective: '1200px', perspectiveOrigin: 'center center' }}>

            {/* iPhone */}
            <div
                onClick={() => setActive('iphone')}
                style={{
                    position: 'relative', zIndex: iphoneActive ? 10 : 4,
                    transform: iphoneActive
                        ? 'scale(1) translateX(40px) translateZ(60px) rotateY(0deg)'
                        : 'scale(0.78) translateX(80px) translateZ(-80px) rotateY(12deg)',
                    transition: 'all 0.55s cubic-bezier(0.34, 1.3, 0.64, 1)',
                    cursor: iphoneActive ? 'default' : 'pointer',
                    opacity: iphoneActive ? 1 : 0.65,
                    filter: iphoneActive ? 'none' : 'brightness(0.85)',
                }}
            >
                {/* iPhone frame */}
                <div style={{
                    width: 220, height: 440,
                    background: 'linear-gradient(145deg, #2d2d2d, #1a1a1a)',
                    borderRadius: 42,
                    padding: 3,
                    boxShadow: iphoneActive
                        ? '0 40px 80px rgba(0,0,0,0.4), 0 0 0 0.5px #444, inset 0 0 0 0.5px #555'
                        : '0 20px 40px rgba(0,0,0,0.25), 0 0 0 0.5px #333',
                }}>
                    {/* Screen */}
                    <div style={{ width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden', position: 'relative', background: '#000' }}>
                        <AppScreen tint="iphone"/>
                        {/* Dynamic Island */}
                        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 80, height: 24, background: '#000', borderRadius: 12, zIndex: 20 }}/>
                    </div>
                </div>
                {/* iPhone label */}
                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, fontWeight: 800, color: iphoneActive ? '#0f172a' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.3s' }}>
                    {iphoneActive ? '● iPhone' : '○ iPhone'}
                </div>
            </div>

            {/* Android */}
            <div
                onClick={() => setActive('android')}
                style={{
                    position: 'relative', zIndex: androidActive ? 10 : 4,
                    transform: androidActive
                        ? 'scale(1) translateX(-40px) translateZ(60px) rotateY(0deg)'
                        : 'scale(0.78) translateX(-80px) translateZ(-80px) rotateY(-12deg)',
                    transition: 'all 0.55s cubic-bezier(0.34, 1.3, 0.64, 1)',
                    cursor: androidActive ? 'default' : 'pointer',
                    opacity: androidActive ? 1 : 0.65,
                    filter: androidActive ? 'none' : 'brightness(0.85)',
                }}
            >
                {/* Android frame */}
                <div style={{
                    width: 228, height: 452,
                    background: 'linear-gradient(145deg, #222, #111)',
                    borderRadius: 32,
                    padding: 3,
                    boxShadow: androidActive
                        ? '0 40px 80px rgba(0,0,0,0.4), 0 0 0 0.5px #444, inset 0 0 0 0.5px #555'
                        : '0 20px 40px rgba(0,0,0,0.25), 0 0 0 0.5px #333',
                }}>
                    {/* Screen */}
                    <div style={{ width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', position: 'relative', background: '#000' }}>
                        <AppScreen tint="android"/>
                        {/* Punch hole camera */}
                        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: '#000', borderRadius: '50%', zIndex: 20 }}/>
                    </div>
                </div>
                {/* Android label */}
                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, fontWeight: 800, color: androidActive ? '#0f172a' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.3s' }}>
                    {androidActive ? '● Android' : '○ Android'}
                </div>
            </div>
        </div>
    );
}

// ========== SCROLL ANIMATION HOOK ==========
function useSlideIn(direction = 'up', delay = 0) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const offX = direction === 'left' ? '-56px' : direction === 'right' ? '56px' : '0';
        const offY = direction === 'up' ? '40px' : '0';
        el.style.opacity = '0';
        el.style.transform = `translateX(${offX}) translateY(${offY})`;
        el.style.transition = `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                el.style.opacity = '1';
                el.style.transform = 'translateX(0) translateY(0)';
            } else if (entry.boundingClientRect.top > 0) {
                // Element is below viewport — reset to off-screen (for if user scrolls back up past it)
                el.style.transition = 'none';
                el.style.opacity = '0';
                el.style.transform = `translateX(${offX}) translateY(${offY})`;
                // Re-enable transition after reset so next scroll-in animates
                requestAnimationFrame(() => {
                    el.style.transition = `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`;
                });
            } else {
                // Element scrolled above viewport — slide it back off the top
                el.style.opacity = '0';
                el.style.transform = direction === 'left'  ? 'translateX(56px) translateY(0)'
                                   : direction === 'right' ? 'translateX(-56px) translateY(0)'
                                   : 'translateX(0) translateY(-40px)';
            }
        }, { threshold: 0.12 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [direction, delay]);
    return ref;
}

// ========== PHONE MOCKUP SHELL ==========
function PhoneShell({ children, accentColor = '#10b981' }) {
    return (
        <div style={{
            width: 260, minHeight: 440,
            background: '#0f172a',
            borderRadius: 32,
            boxShadow: `0 40px 100px rgba(0,0,0,0.3), 0 0 0 1px #1e293b, 0 0 40px ${accentColor}22`,
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Status bar */}
            <div style={{ background: '#070d19', padding: '10px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>9:41</span>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <div style={{ width: 14, height: 6, border: '1px solid #475569', borderRadius: 2, position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 1, top: 1, bottom: 1, width: '70%', background: accentColor, borderRadius: 1 }}/>
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
}

// ========== MOCKUP 1: GPS TRACKING ==========
function TrackingMockup() {
    return (
        <PhoneShell accentColor="#3b82f6">
            {/* App header */}
            <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', padding: '14px 16px 12px' }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Walking</div>
                <div style={{ color: '#fff', fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
                    1.24 <span style={{ fontSize: 14, fontWeight: 600 }}>mi</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>14:32 elapsed</div>
            </div>
            {/* Live hex map */}
            <div style={{ background: '#f1f5f9', padding: 0 }}>
                <svg width="260" height="180" viewBox="0 0 260 180">
                    {/* Roads */}
                    <rect width="260" height="180" fill="#e2e8f0"/>
                    <rect x="0" y="75" width="260" height="14" fill="#f1f5f9"/>
                    <rect x="115" y="0" width="14" height="180" fill="#f1f5f9"/>
                    <rect x="0" y="140" width="260" height="10" fill="#f1f5f9"/>
                    {/* Captured hexes — blue for walk */}
                    {[
                        [75,55],[93,66],[75,77],[57,66],
                        [93,44],[111,55],[111,66],
                        [57,44],[75,33],
                    ].map(([cx,cy],i) => (
                        <polygon key={i}
                            points={`${cx},${cy-11} ${cx+9.5},${cy-5.5} ${cx+9.5},${cy+5.5} ${cx},${cy+11} ${cx-9.5},${cy+5.5} ${cx-9.5},${cy-5.5}`}
                            fill="#3b82f6" opacity={1 - i * 0.07} stroke="#fff" strokeWidth="1.5"/>
                    ))}
                    {/* Others' hexes */}
                    {[[170,90],[188,100],[170,111],[152,100]].map(([cx,cy],i) => (
                        <polygon key={i}
                            points={`${cx},${cy-11} ${cx+9.5},${cy-5.5} ${cx+9.5},${cy+5.5} ${cx},${cy+11} ${cx-9.5},${cy+5.5} ${cx-9.5},${cy-5.5}`}
                            fill="#e879f9" opacity={0.85 - i * 0.1} stroke="#fff" strokeWidth="1.5"/>
                    ))}
                    {/* GPS dot */}
                    <circle cx="93" cy="66" r="10" fill="rgba(59,130,246,0.2)"/>
                    <circle cx="93" cy="66" r="6" fill="#fff" stroke="#3b82f6" strokeWidth="2"/>
                    <circle cx="93" cy="66" r="3" fill="#3b82f6"/>
                </svg>
            </div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#1e293b' }}>
                {[['23','Hexagons','#3b82f6'],['142','Calories','#f59e0b'],['4:18','Pace','#94a3b8']].map(([v,l,c]) => (
                    <div key={l} style={{ background: '#0f172a', padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div>
                        <div style={{ fontSize: 8, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{l}</div>
                    </div>
                ))}
            </div>
            {/* Stop button */}
            <div style={{ padding: '14px 16px' }}>
                <div style={{ background: '#ef4444', borderRadius: 12, padding: '10px', textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                    ■ Finish Activity
                </div>
            </div>
        </PhoneShell>
    );
}

// ========== MOCKUP 2: TERRITORY MAP ==========
function MapMockup() {
    return (
        <PhoneShell accentColor="#10b981">
            <div style={{ background: '#10b981', padding: '12px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>Territory Map</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Live · 21 tiles owned</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                    + My Location
                </div>
            </div>
            {/* Map */}
            <svg width="260" height="280" viewBox="0 0 260 280">
                <rect width="260" height="280" fill="#e9ecf0"/>
                {/* Streets */}
                <rect x="0" y="90" width="260" height="12" fill="#fff" opacity="0.9"/>
                <rect x="0" y="170" width="260" height="12" fill="#fff" opacity="0.9"/>
                <rect x="90" y="0" width="12" height="280" fill="#fff" opacity="0.9"/>
                <rect x="170" y="0" width="12" height="280" fill="#fff" opacity="0.9"/>
                {/* My big territory cluster */}
                {[
                    [96,50],[114,39],[114,61],[132,50],[96,61],[78,50],[78,61],
                    [132,61],[96,72],[114,83],[78,83],[132,83],
                    [96,39],[114,28],[78,39],
                ].map(([cx,cy],i) => (
                    <polygon key={`m${i}`}
                        points={`${cx},${cy-12} ${cx+10},${cy-6} ${cx+10},${cy+6} ${cx},${cy+12} ${cx-10},${cy+6} ${cx-10},${cy-6}`}
                        fill="#10b981" opacity={0.9 - i * 0.03} stroke="#fff" strokeWidth="1.2"/>
                ))}
                {/* Rival territory */}
                {[[174,140],[192,129],[192,151],[174,162],[156,151],[156,129]].map(([cx,cy],i) => (
                    <polygon key={`r${i}`}
                        points={`${cx},${cy-12} ${cx+10},${cy-6} ${cx+10},${cy+6} ${cx},${cy+12} ${cx-10},${cy+6} ${cx-10},${cy-6}`}
                        fill="#e879f9" opacity={0.85 - i * 0.05} stroke="#fff" strokeWidth="1.2"/>
                ))}
                {/* Another player */}
                {[[50,200],[68,189],[68,211]].map(([cx,cy],i) => (
                    <polygon key={`p${i}`}
                        points={`${cx},${cy-12} ${cx+10},${cy-6} ${cx+10},${cy+6} ${cx},${cy+12} ${cx-10},${cy+6} ${cx-10},${cy-6}`}
                        fill="#f59e0b" opacity={0.85} stroke="#fff" strokeWidth="1.2"/>
                ))}
                {/* Legend pill */}
                <rect x="8" y="252" width="140" height="22" rx="8" fill="rgba(15,23,42,0.85)"/>
                <polygon points="20,263 26,260 26,266" fill="#10b981"/>
                <text x="30" y="267" fontSize="9" fill="#fff" fontWeight="700">YOURS 21</text>
                <text x="80" y="267" fontSize="9" fill="#94a3b8" fontWeight="600">| OTHERS 9</text>
            </svg>
        </PhoneShell>
    );
}

// ========== MOCKUP 3: LEADERBOARD / PROFILE ==========
function LeaderboardMockup() {
    return (
        <PhoneShell accentColor="#f59e0b">
            <div style={{ background: '#0f172a', padding: '10px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#10b981', fontSize: 13, fontWeight: 900 }}>Hex<span style={{ color: '#fff' }}>Capture</span></span>
                <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>Leaderboard</span>
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', background: '#070d19', borderBottom: '1px solid #1e293b' }}>
                {['Territory','Lifetime','Distance'].map((t,i) => (
                    <div key={t} style={{
                        flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 9, fontWeight: 800,
                        color: i === 0 ? '#10b981' : '#334155',
                        borderBottom: i === 0 ? '2px solid #10b981' : '2px solid transparent',
                    }}>{t}</div>
                ))}
            </div>
            {/* Leaderboard rows */}
            <div style={{ padding: '10px 12px' }}>
                {[
                    { rank: 1, name: 'TrailKing92', tiles: 847, stroke: '#ffb004', me: false },
                    { rank: 2, name: 'Peach204', tiles: 612, stroke: '#9daec5', me: true },
                    { rank: 3, name: 'NightRunner', tiles: 441, stroke: '#ad4d11', me: false },
                    { rank: 4, name: 'CityWalker', tiles: 298, stroke: '#334155', me: false },
                    { rank: 5, name: 'seananny', tiles: 187, stroke: '#334155', me: false },
                ].map(entry => (
                    <div key={entry.rank} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
                        marginBottom: 4, borderRadius: 10,
                        background: entry.me ? 'rgba(16,185,129,0.1)' : 'transparent',
                        border: `1px solid ${entry.me ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
                    }}>
                        <svg width="24" height="24" viewBox="0 0 28 28">
                            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="#0a0f1a" stroke={entry.stroke} strokeWidth="2"/>
                            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#fff" fontWeight="800">{entry.rank}</text>
                        </svg>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: entry.me ? '#10b981' : '#e2e8f0' }}>
                                {entry.name}
                                {entry.me && <span style={{ fontSize: 8, color: '#f59e0b', marginLeft: 4 }}>you</span>}
                            </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: entry.me ? '#10b981' : '#475569' }}>
                            {entry.tiles}
                        </span>
                    </div>
                ))}
            </div>
            {/* Tier badge */}
            <div style={{ margin: '0 12px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 100 100">
                    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="#10b981"/>
                </svg>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981' }}>TIER 2 · SCOUT</span>
                <div style={{ flex: 1, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden', marginLeft: 4 }}>
                    <div style={{ width: '68%', height: '100%', background: '#10b981', borderRadius: 2 }}/>
                </div>
            </div>
        </PhoneShell>
    );
}

// ========== LANDING PAGE ==========
export default function Landing() {
    const navigate = useNavigate();
    const [activeDot, setActiveDot] = useState(0);

    const feat1Ref = useRef(null);
    const feat2Ref = useRef(null);
    const feat3Ref = useRef(null);

    // Progress dots — track which feature section is in view
    useEffect(() => {
        const refs = [feat1Ref, feat2Ref, feat3Ref];
        const handleScroll = () => {
            refs.forEach((ref, i) => {
                if (!ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                if (rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.3) {
                    setActiveDot(i);
                }
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Slide-in animation refs
    const heroRef    = useSlideIn('up');
    const whoRef     = useSlideIn('up');
    const f1Text     = useSlideIn('left');
    const f1Vis      = useSlideIn('right', 0.1);
    const f2Text     = useSlideIn('right');
    const f2Vis      = useSlideIn('left', 0.1);
    const f3Text     = useSlideIn('left');
    const f3Vis      = useSlideIn('right', 0.1);
    const tagRef     = useSlideIn('up');
    const sp1Ref     = useSlideIn('left');
    const sp2Ref     = useSlideIn('right');
    const sp3Ref     = useSlideIn('left');
    const g1Ref      = useSlideIn('up', 0);
    const g2Ref      = useSlideIn('up', 0.1);
    const g3Ref      = useSlideIn('up', 0.2);
    const privacyRef  = useSlideIn('up');
    const ctaRef     = useSlideIn('up');

    const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return (
        <div style={{ background: '#f1f5f9', overflowX: 'hidden' }}>

            {/* ========== NAV ========== */}
            <nav className="lp-nav" style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
                borderBottom: '1px solid #e2e8f0',
                padding: '14px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                    Hex<span style={{ color: '#10b981' }}>Capture</span>
                </span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button onClick={() => navigate('/login')}
                        style={{ background: 'none', border: 'none', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        Log In
                    </button>
                    <button onClick={() => navigate('/login')}
                        style={{
                            background: '#10b981', color: '#fff', fontWeight: 800,
                            fontSize: 14, padding: '9px 22px', borderRadius: 12,
                            border: 'none', cursor: 'pointer',
                        }}>
                        Sign Up Free
                    </button>
                </div>
            </nav>

            {/* ========== HERO ========== */}
            <div style={{
                minHeight: '100vh', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: '#0f172a', position: 'relative', overflow: 'hidden',
            }}>
                <HexBackground fadeColor="#0f172a" />
                {/* Spinning globe keyframe */}
                <style>{`
                    @keyframes bounceCue { 0%,100%{transform:translateY(0)} 50%{transform:translateY(10px)} }
                    @media (max-width: 700px) {
                        .lp-feature-card { grid-template-columns: 1fr !important; }
                        .lp-feature-vis { display: none !important; }
                        .lp-split-panel { grid-template-columns: 1fr !important; }
                        .lp-split-vis { display: none !important; }
                        .lp-grid-3 { grid-template-columns: 1fr !important; gap: 32px !important; }
                        .lp-tier-labels { grid-template-columns: 1fr 1fr !important; }
                        .lp-privacy-grid { grid-template-columns: 1fr !important; }
                        .lp-nav { padding: 12px 16px !important; }
                        .lp-who { padding: 60px 20px !important; }
                        .lp-tagline { padding: 48px 20px !important; }
                        .lp-cta { padding: 60px 20px !important; }
                        .lp-hero-btns { flex-direction: column !important; align-items: center !important; }
                        .lp-privacy { padding: 60px 20px !important; }
                        .lp-tier { padding: 60px 20px !important; }
                    }
                `}</style>

                <div ref={heroRef} style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px', maxWidth: 800 }}>

                    <div style={{
                        display: 'inline-block', background: 'rgba(16,185,129,0.12)',
                        border: '1px solid rgba(16,185,129,0.35)', borderRadius: 20,
                        padding: '5px 16px', fontSize: 11, fontWeight: 800,
                        color: '#10b981', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 24,
                    }}>
                        The Fitness Territory Game
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(38px, 6vw, 68px)', fontWeight: 900,
                        color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1px',
                    }}>
                        Claim the World.<br/>
                        <span style={{ color: '#10b981' }}>One Hex at a Time.</span>
                    </h1>

                    <p style={{
                        fontSize: 18, color: '#94a3b8', fontWeight: 600,
                        lineHeight: 1.7, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px',
                    }}>
                        Walk and run to capture hexagonal territory on a live world map. Defend your turf. Steal from rivals. Own your city.
                    </p>

                    <div className="lp-hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => navigate('/login')}
                            style={{
                                background: '#10b981', color: '#fff', fontWeight: 900,
                                fontSize: 16, padding: '15px 40px', borderRadius: 14,
                                border: 'none', cursor: 'pointer',
                                boxShadow: '0 0 40px rgba(16,185,129,0.45)',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background='#059669'; e.currentTarget.style.transform='translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='#10b981'; e.currentTarget.style.transform='translateY(0)'; }}
                        >
                            › Start Capturing Free
                        </button>
                        <button
                            onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
                            style={{
                                background: 'transparent', color: '#cbd5e1', fontWeight: 700,
                                fontSize: 16, padding: '15px 32px', borderRadius: 14,
                                border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                                transition: 'all 0.25s ease',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.color = '#f5a623';
                                e.currentTarget.style.borderColor = '#f5a623';
                                e.currentTarget.style.background = 'rgba(245,166,35,0.08)';
                                e.currentTarget.style.boxShadow = '0 0 16px rgba(245,166,35,0.35), inset 0 0 16px rgba(245,166,35,0.08)';
                                e.currentTarget.style.textShadow = '0 0 12px rgba(245,166,35,0.8)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = '#cbd5e1';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.textShadow = 'none';
                            }}
                        >
                            How it works ↓
                        </button>
                    </div>
                </div>

                {/* Scroll cue */}
                <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                    <div style={{
                        color: '#f5a623', fontSize: 10, fontWeight: 800,
                        letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
                        textShadow: '0 0 12px rgba(245,166,35,0.8), 0 0 24px rgba(245,166,35,0.4)',
                    }}>Explore HexCapture</div>
                    <div style={{
                        color: '#f5a623', fontSize: 32,
                        animation: 'bounceCue 2s ease-in-out infinite',
                        textShadow: '0 0 12px rgba(245,166,35,0.8), 0 0 24px rgba(245,166,35,0.4)',
                        lineHeight: 1,
                    }}>↓</div>
                </div>
            </div>

            {/* ======= LIGHT SECTIONS WRAPPER — one shared hex background ======= */}
            <div style={{ position: 'relative', background: '#f1f5f9' }}>
                <HexBackground fadeColor="#f1f5f9" />

            {/* ========== WHO WE ARE ========== */}
            <div className="lp-who" style={{ background: 'transparent', padding: '100px 24px', textAlign: 'center', position: 'relative' }}>
                <div ref={whoRef} style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20 }}>
                        What is HexCapture
                    </div>
                    <p style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 700, color: '#0f172a', lineHeight: 1.6 }}>
                        HexCapture turns every walk and run into a live battle for territory. Step through a hexagon and it's yours. Build your empire street by street, or steal it straight from someone else!
                    </p>
                </div>
            </div>

            {/* ========== FEATURE WALKTHROUGH ========== */}
            <div id="how-it-works" style={{ background: 'transparent', padding: '60px 0 100px', position: 'relative' }}>

                {/* Cards grouped in a single connected block */}
                <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 10, clear: 'both' }}>
                    <div style={{
                        borderRadius: 24, border: '1px solid #e2e8f0',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
                        overflow: 'hidden',
                    }}>

                        {/* Card 1 — Lace up and go */}
                        <div ref={feat1Ref} className="lp-feature-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                            <div ref={f1Text} style={{ padding: 'clamp(28px, 5vw, 56px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 01</div>
                                <h2 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, marginBottom: 14 }}>
                                    Lace up and go.
                                </h2>
                                <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, fontWeight: 500 }}>
                                    Open the app, pick Walk or Run, and hit Start. Your GPS tracks every step in real time and hexagons light up the moment you move through them. No setup, no gear, no excuses. Just your phone and your legs.
                                </p>
                            </div>
                            <div ref={f1Vis} className="lp-feature-vis" style={{ background: 'rgba(59,130,246,0.05)', borderLeft: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
                                <TrackingMockup />
                            </div>
                        </div>

                        {/* Card 2 — Own your turf */}
                        <div ref={feat2Ref} className="lp-feature-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                            <div ref={f2Vis} className="lp-feature-vis" style={{ background: 'rgba(16,185,129,0.05)', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
                                <MapMockup />
                            </div>
                            <div ref={f2Text} style={{ padding: 'clamp(28px, 5vw, 56px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 02</div>
                                <h2 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, marginBottom: 14 }}>
                                    Own your turf.
                                </h2>
                                <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, fontWeight: 500 }}>
                                    Walkers lock down territory permanently. Once it's yours, it stays yours. Runners play offense and sprint through rival hexagons to steal them. Every route is a calculated attack.
                                </p>
                            </div>
                        </div>

                        {/* Card 3 — Rise through the ranks */}
                        <div ref={feat3Ref} className="lp-feature-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#ffffff' }}>
                            <div ref={f3Text} style={{ padding: 'clamp(28px, 5vw, 56px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step 03</div>
                                <h2 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.2, marginBottom: 14 }}>
                                    Rise through the ranks.
                                </h2>
                                <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, fontWeight: 500 }}>
                                    A live global leaderboard tracks territory owned, miles logged, and total tiles captured. Earn tier ranks from Recruit to Overlord. The map never stops updating. Someone is probably stealing your hexagons right now.
                                </p>
                            </div>
                            <div ref={f3Vis} className="lp-feature-vis" style={{ background: 'rgba(245,158,11,0.05)', borderLeft: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
                                <LeaderboardMockup />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ========== TAGLINE BREAK ========== */}
            <div className="lp-tagline" style={{ background: '#fff', padding: '72px 24px', textAlign: 'center', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', position: 'relative', zIndex: 10 }}>
                <p ref={tagRef} style={{ fontSize: 'clamp(20px, 3.5vw, 34px)', fontWeight: 800, color: '#0f172a' }}>
                    Walk for the tiles,{' '}
                    <span style={{ color: '#10b981' }}>stay for the rivalry.</span>
                </p>
            </div>

            {/* ========== SPLIT PANELS ========== */}
            <div style={{ background: 'transparent', padding: '80px 24px', position: 'relative' }}>
                <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Panel A */}
                    <div ref={sp1Ref} className="lp-split-panel" style={{
                        background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden',
                    }}>
                        <div style={{ padding: 'clamp(28px, 5vw, 56px)' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Step outside</div>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 12, lineHeight: 1.3 }}>Open, walk, conquer.</h3>
                            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, fontWeight: 500 }}>
                                No expensive equipment. No gym membership. Just your phone and wherever your feet take you. Your morning commute, a lunch break, a late night run. Every single step counts.
                            </p>
                        </div>
                        <div className="lp-split-vis" style={{ background: 'rgba(16,185,129,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderLeft: '1px solid #e2e8f0' }}>
                            <svg width="160" height="160" viewBox="0 0 160 160">
                                <polygon points="80,8 148,46 148,114 80,152 12,114 12,46" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.3"/>
                                <polygon points="80,24 132,54 132,106 80,136 28,106 28,54" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.5"/>
                                <polygon points="80,40 116,62 116,98 80,120 44,98 44,62" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="2.5"/>
                                <ellipse cx="96" cy="96" rx="6" ry="10" fill="#10b981" transform="rotate(-35 96 96)"/>
                                <ellipse cx="80" cy="86" rx="6" ry="10" fill="#10b981" opacity="0.7" transform="rotate(-35 80 86)"/>
                                <ellipse cx="88" cy="72" rx="6" ry="10" fill="#10b981" opacity="0.45" transform="rotate(-35 88 72)"/>
                                <ellipse cx="72" cy="64" rx="6" ry="10" fill="#10b981" opacity="0.2" transform="rotate(-35 72 64)"/>
                            </svg>
                        </div>
                    </div>

                    {/* Panel B */}
                    <div ref={sp2Ref} className="lp-split-panel" style={{
                        background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden',
                    }}>
                        <div className="lp-split-vis" style={{ background: 'rgba(232,121,249,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderRight: '1px solid #e2e8f0' }}>
                            <svg width="200" height="130" viewBox="0 0 200 130">
                                {[
                                    [30,65,'#10b981'],[50,51,'#10b981'],[50,79,'#10b981'],
                                    [70,65,'#10b981'],[70,37,'#10b981'],[90,51,'#10b981'],
                                    [115,65,'#e879f9'],[135,51,'#e879f9'],[135,79,'#e879f9'],
                                    [155,65,'#f59e0b'],[175,51,'#f59e0b'],
                                ].map(([cx,cy,color],i) => (
                                    <polygon key={i}
                                        points={`${cx},${cy-13} ${cx+11},${cy-6.5} ${cx+11},${cy+6.5} ${cx},${cy+13} ${cx-11},${cy+6.5} ${cx-11},${cy-6.5}`}
                                        fill={color} opacity={0.85} stroke="rgba(255,255,255,0.8)" strokeWidth="2"/>
                                ))}
                            </svg>
                        </div>
                        <div style={{ padding: 'clamp(28px, 5vw, 56px)' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#e879f9', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Live map</div>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 12, lineHeight: 1.3 }}>Your city is the battlefield.</h3>
                            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, fontWeight: 500 }}>
                                Every hexagon on the live world map belongs to someone, or nobody yet. Multiple players, multiple colors, one map. See exactly where your empire ends and the fight begins.
                            </p>
                        </div>
                    </div>

                    {/* Panel C */}
                    <div ref={sp3Ref} className="lp-split-panel" style={{
                        background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden',
                    }}>
                        <div style={{ padding: 'clamp(28px, 5vw, 56px)' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Compete</div>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 12, lineHeight: 1.3 }}>The leaderboard never sleeps.</h3>
                            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.8, fontWeight: 500 }}>
                                Rankings update the second anyone finishes an activity. Follow friends, drop kudos, talk trash in the comments. Climb from Recruit to Overlord while someone two blocks away is already planning their revenge run.
                            </p>
                        </div>
                        <div className="lp-split-vis" style={{ background: 'rgba(245,158,11,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderLeft: '1px solid #e2e8f0' }}>
                            <svg width="160" height="120" viewBox="0 0 160 120">
                                {[{x:10,h:70,c:'#94a3b8'},{x:54,h:105,c:'#f59e0b'},{x:98,h:52,c:'#94a3b8'}].map(({x,h,c},i) => (
                                    <g key={i}>
                                        <rect x={x} y={115-h} width="44" height={h} rx="6" fill={c} opacity={i===1?1:0.45}/>
                                        <text x={x+22} y={110} textAnchor="middle" fontSize="11" fill={i===1?'#92400e':'#64748b'} fontWeight="900">#{[2,1,3][i]}</text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>

                </div>
            </div>

            {/* ========== 3-COLUMN FEATURE GRID ========== */}
            <div style={{ background: '#fff', padding: '100px 24px', position: 'relative', zIndex: 10 }}>
                <div style={{ maxWidth: 900, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 64 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Everything you need</div>
                        <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, color: '#0f172a' }}>Built for competitors who move.</h2>
                    </div>
                    <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
                        {[
                            {
                                ref: g1Ref,
                                color: '#3b82f6',
                                icon: <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                                    {/* Neon glow backdrop */}
                                    <polygon points="42,22 32,4.68 12,4.68 2,22 12,39.32 32,39.32" fill="rgba(16,185,129,0.28)"/>
                                    {/* Outer neon green */}
                                    <polygon points="42,22 32,4.68 12,4.68 2,22 12,39.32 32,39.32" fill="#10b981"/>
                                    {/* White ring */}
                                    <polygon points="38,22 30,8.14 14,8.14 6,22 14,35.86 30,35.86" fill="white"/>
                                    {/* Inner green */}
                                    <polygon points="34,22 28,11.61 16,11.61 10,22 16,32.39 28,32.39" fill="#10b981"/>
                                </svg>,
                                title: 'Capture & Claim',
                                desc: 'Walk any hex to claim it forever. Your tiles are permanent proof of every street you\'ve conquered and every mile you\'ve put in.',
                            },
                            {
                                ref: g2Ref,
                                color: '#ef4444',
                                icon: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><polygon points="22,2 40,12 40,32 22,42 4,32 4,12" stroke="#ef4444" strokeWidth="2" fill="rgba(239,68,68,0.08)"/><polygon points="22,10 30,15 30,29 22,34 14,29 14,15" fill="#ef4444" opacity="0.7"/></svg>,
                                title: 'Battle & Steal',
                                desc: 'Runners steal territory from other runners only. Every route is a raid. Plan it right and you can flip an entire neighborhood in one go.',
                            },
                            {
                                ref: g3Ref,
                                color: '#f59e0b',
                                icon: <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><polygon points="22,2 40,12 40,32 22,42 4,32 4,12" stroke="#f59e0b" strokeWidth="2" fill="rgba(245,158,11,0.08)"/><text x="22" y="27" textAnchor="middle" fontSize="16" fill="#f59e0b" fontWeight="900">#1</text></svg>,
                                title: 'Track & Rank',
                                desc: 'Live leaderboards, tier progression, weekly activity rings, kudos, and a social feed to see what your rivals are up to.',
                            },
                        ].map(({ ref, color, icon, title, desc }) => (
                            <div key={title} ref={ref}>
                                <div style={{ marginBottom: 16 }}>{icon}</div>
                                <h4 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>{title}</h4>
                                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, fontWeight: 500 }}>{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========== TIER PROGRESSION ========== */}
            <div className="lp-tier" style={{ background: 'transparent', padding: '80px 24px', position: 'relative' }}>
                <div style={{ maxWidth: 660, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                        Hex Tier System
                    </div>
                    <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 900, color: '#0f172a', marginBottom: 10, letterSpacing: '-0.5px' }}>
                        Every hex has a tier. Earn yours.
                    </h2>
                    <p style={{ fontSize: 15, color: '#64748b', marginBottom: 52, fontWeight: 500, lineHeight: 1.7 }}>
                        Run the same hex multiple times to level it up. Higher tiers burn brighter on the map and become nearly impossible for rivals to take back.
                    </p>

                    {/* Zigzag connected hex chain */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <svg width="100%" viewBox="0 0 248 100" fill="none" style={{ maxWidth: 520, overflow: 'visible' }}>
                            <defs>
                                <filter id="tier-glow" x="-60%" y="-60%" width="220%" height="220%">
                                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur"/>
                                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                </filter>
                            </defs>
                            {[
                                { cx: 45,    cy: 64,   color: '#39ff14', label: 'T1' },
                                { cx: 97.5,  cy: 33.7, color: '#00ccff', label: 'T2' },
                                { cx: 150,   cy: 64,   color: '#f5a623', label: 'T3' },
                                { cx: 202.5, cy: 33.7, color: '#ff00aa', label: 'T4' },
                            ].map(({ cx, cy, color, label }) => {
                                const r = 35, h = 30.31;
                                const pts = `${cx+r},${cy} ${cx+r/2},${cy-h} ${cx-r/2},${cy-h} ${cx-r},${cy} ${cx-r/2},${cy+h} ${cx+r/2},${cy+h}`;
                                return (
                                    <g key={label}>
                                        <polygon points={pts} fill="none" stroke={color} strokeWidth="8" opacity="0.3" filter="url(#tier-glow)"/>
                                        <polygon points={pts} fill="white" stroke={color} strokeWidth="2.5"/>
                                        <text x={cx} y={cy+5} textAnchor="middle" fontSize="15" fontWeight="900" fill={color} fontFamily="-apple-system,sans-serif">{label}</text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* Tier labels */}
                    <div className="lp-tier-labels" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 40, position: 'relative', zIndex: 10 }}>
                        {[
                            { color: '#39ff14', name: 'First Claim', range: '1–3 walks & runs' },
                            { color: '#00ccff', name: 'Scout',       range: '4–6 walks & runs' },
                            { color: '#f5a623', name: 'Fortified',   range: '7–9 walks & runs' },
                            { color: '#ff00aa', name: 'Overlord',    range: '10+ walks & runs' },
                        ].map(({ color, name, range }) => (
                            <div key={name} style={{ borderLeft: `4px solid ${color}`, paddingLeft: 14, textAlign: 'left' }}>
                                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>{name}</div>
                                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{range}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========== PRIVACY ========== */}
            <div className="lp-privacy" style={{ background: '#fff', padding: '80px 24px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', position: 'relative', zIndex: 10 }}>
                <div ref={privacyRef} style={{ maxWidth: 720, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', marginBottom: 16 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Your privacy</div>
                        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 900, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.5px' }}>
                            We only keep what you give us.
                        </h2>
                        <p style={{ fontSize: 16, color: '#64748b', fontWeight: 500, lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
                            HexCapture is a location-based app, so we want to be completely straight with you about what gets saved and what doesn't.
                        </p>
                    </div>

                    <div className="lp-privacy-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[
                            {
                                saved: false,
                                title: 'My Location button',
                                body: 'Reads your GPS to fly the map to your position. Never sent to our servers, never stored anywhere.',
                            },
                            {
                                saved: false,
                                title: 'Address search',
                                body: 'Your search goes directly to OpenStreetMap\'s geocoding service and returns a map coordinate. We never see the address you typed.',
                            },
                            {
                                saved: false,
                                title: 'Loading the map',
                                body: 'We fetch nearby hex tiles using your coordinates, but those coordinates are used only to query the database and are never saved.',
                            },
                            {
                                saved: true,
                                title: 'Logging an activity',
                                body: 'The GPS path from an activity you explicitly start and finish is saved so your territory shows on the map. That\'s the only location data we ever store.',
                            },
                        ].map(({ saved, title, body }) => (
                            <div key={title} style={{
                                background: saved ? 'rgba(16,185,129,0.04)' : '#f8fafc',
                                border: `1px solid ${saved ? 'rgba(16,185,129,0.2)' : '#e2e8f0'}`,
                                borderRadius: 16,
                                padding: '24px 28px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: saved ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        {saved ? (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                        ) : (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                            </svg>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: saved ? '#10b981' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {saved ? 'Saved' : 'Not saved'}
                                    </div>
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{title}</div>
                                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, fontWeight: 500 }}>{body}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========== FOOTER CTA ========== */}
            <div className="lp-cta" style={{ background: 'transparent', padding: '80px 24px', textAlign: 'center', position: 'relative' }}>
                <div ref={ctaRef} style={{ position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
                        Free to join · Free to play
                    </div>
                    <h2 style={{ fontSize: 'clamp(26px, 4.5vw, 46px)', fontWeight: 900, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.5px' }}>
                        Ready to claim your first hex?
                    </h2>
                    <p style={{ fontSize: 16, color: '#64748b', marginBottom: 36, fontWeight: 500 }}>
                        Your neighborhood is sitting there unclaimed. Go take it before someone else does.
                    </p>
                    <button onClick={() => navigate('/login')}
                        style={{
                            background: '#10b981', color: '#fff', fontWeight: 900,
                            fontSize: 17, padding: '16px 48px', borderRadius: 16,
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='#059669'; e.currentTarget.style.transform='translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#10b981'; e.currentTarget.style.transform='translateY(0)'; }}
                    >
                        › Join HexCapture Free
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginTop: 48, flexWrap: 'wrap' }}>
                        {['Works on Android','GPS-powered','Live global map'].map(item => (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, fontWeight: 600 }}>
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path d="M2.5 7.5l3.5 3.5L12.5 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            </div>{/* end light sections wrapper */}

            {/* ========== FOOTER ========== */}
            <div style={{ background: '#0f172a', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Hex<span style={{ color: '#10b981' }}>Capture</span></span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Built by Travis McGray</span>
            </div>
        </div>
    );
}
