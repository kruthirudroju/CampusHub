import { IconMenu, IconX } from './icons';

/**
 * Permanent left sidebar navigation, grouped into labelled sections.
 * sections: [{ label?: string, items: [{ key, label, icon: Component }] }]
 */
export default function Sidebar({ institutionName, sections, active, onChange, mobileOpen, onCloseMobile }) {
  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={onCloseMobile} />}
      <nav className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="sidebar-brand-mark">C</span>
            <div>
              <div className="sidebar-brand-name">CampusHub</div>
              {institutionName && <div className="sidebar-inst">{institutionName}</div>}
            </div>
          </div>
          <button className="hamburger" onClick={onCloseMobile} style={{ background: 'transparent', border: 'none', color: '#fff' }}>
            <IconX />
          </button>
        </div>

        {sections.map((section, si) => (
          <div key={si}>
            {section.label && <div className="sidebar-group-label">{section.label}</div>}
            {section.items.map((item) => (
              <button
                key={item.key}
                className={`sidebar-item ${active === item.key ? 'active' : ''}`}
                onClick={() => { onChange(item.key); onCloseMobile?.(); }}
              >
                <item.icon className="ico" />
                {item.label}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-footer" />
      </nav>
    </>
  );
}
